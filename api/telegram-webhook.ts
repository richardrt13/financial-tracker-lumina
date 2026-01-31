import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { generateText, transcribeAudio as groqTranscribeAudio, analyzeImage } from './ai-adapter-edge';

// --- CONFIGURAÇÃO E CONSTANTES ---
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Interfaces Telegram
interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type: string;
  file_size?: number;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string };
  chat: { id: number; type: string };
  text?: string;
  voice?: TelegramVoice;
  photo?: TelegramPhoto[];
}

interface TelegramPayload {
  message?: TelegramMessage;
}

// Interface auxiliar para o retorno da IA
interface TransactionIntention {
    isTransaction: boolean;
    transactionData?: {
        type: 'receita' | 'despesa';
        category: string;
        amount: number;
        description: string;
        date?: string; // YYYY-MM-DD
        installments?: number; // Número de parcelas/recorrências (padrão 1)
        recurrenceType?: 'mensal' | 'anual'; // (Opcional, assumindo mensal por padrão)
    } | null;
    isQuery: boolean;
    queryTopics?: string[];
}

// Inicialização Clientes
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ✅ Redis para histórico de conversas
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// --- FUNÇÕES REDIS ---
async function getTelegramHistory(chatId: number): Promise<any[]> {
  try {
    const key = `telegram_history:${chatId}`;
    const rawHistory = await redis.lrange(key, 0, 9); // Últimas 10 mensagens
    return rawHistory.reverse().map((item: any) => {
      try {
        return JSON.parse(item);
      } catch {
        return { role: 'assistant', content: String(item) };
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico do Telegram:', error);
    return [];
  }
}

async function saveTelegramMessage(chatId: number, role: 'user' | 'assistant', content: string) {
  try {
    const key = `telegram_history:${chatId}`;
    const message = JSON.stringify({ role, content, timestamp: Date.now() });
    await redis.lpush(key, message);
    await redis.ltrim(key, 0, 19); // Manter últimas 20 mensagens
    await redis.expire(key, 86400); // Expira em 24h
  } catch (error) {
    console.error('Erro ao salvar mensagem do Telegram:', error);
  }
}

// --- FUNÇÕES AUXILIARES ---

async function sendTelegramMessage(chat_id: number, text: string, parse_mode: 'Markdown' | 'HTML' = 'Markdown') {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode }),
    });
    if (!response.ok) {
        console.error("Erro ao enviar mensagem Telegram:", await response.text());
    }
  } catch (error) {
      console.error("Falha de rede (Telegram):", error);
  }
}

async function getTelegramFileBuffer(file_id: string): Promise<Buffer> {
    const fileInfoUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${file_id}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error("Não foi possível obter informações do arquivo.");
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
    const fileResponse = await fetch(fileUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// --- INTELIGÊNCIA ARTIFICIAL ---

async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Convert Buffer to ArrayBuffer for Groq Whisper
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const transcription = await groqTranscribeAudio(arrayBuffer, mimeType);
    return transcription.content.trim();
  } catch (error) {
    console.error("Erro Transcrição:", error);
    return "";
  }
}

async function analyzeImageForTransaction(imageBuffer: Buffer): Promise<any> {
    try {
        const imageBase64 = imageBuffer.toString('base64');
        const currentYear = new Date().getFullYear();
        const currentMonthName = months[new Date().getMonth()];
        
        const prompt = `
            Analise esta imagem (cupom fiscal, fatura ou nota). Extraia os dados da transação.
            Retorne APENAS um JSON:
            { 
               "type": "despesa", 
               "category": "String (ex: Alimentação, Transporte, Saúde)", 
               "amount": Number, 
               "description": "Resumo do que é (ex: Restaurante X)", 
               "date": "YYYY-MM-DD" (Busque data de emissão. Se não achar, não envie ou envie null)
            }
            Se não for possível identificar, retorne null.
        `;
        
        const response = await analyzeImage(prompt, imageBase64, 'image/jpeg');
        const text = response.content.replace(/^```json\s*|```\s*$/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Erro Vision:", error);
        return null;
    }
}

// Função Unificada de Entendimento de Intenção
async function understandIntention(text: string, userId: string): Promise<{
    isTransaction: boolean;
    transactionData?: any;
    isQuery: boolean;
    queryResponse?: string;
    queryTopics?: string[]; // Adicionando para suportar a lógica principal
}> {
    // 1. Buscar contexto básico financeiro para responder perguntas (se for o caso)
    // Para economizar tokens e tempo, faremos isso apenas se o modelo pedir ou podemos fazer uma injeção de dados sumarizados.
    // Vamos fazer uma abordagem de duas etapas simples: O modelo decide se é transação ou pergunta.
    
    // Obter data atual
    const now = new Date();
    const currentContext = `Data hoje: ${now.toLocaleDateString('pt-BR')}. Ano: ${now.getFullYear()}.`;

    const prompt = `
    ${currentContext}
    Texto do usuário: "${text}"
    
    Você é um assistente financeiro pessoal. Analise o texto e decida:
    1. É um registro de transação? (Ex: "Gastei 50 no mercado", "Netflix mensal 20 reais").
       - Se mencionar recorrência (ex: "parcelado em 3x", "por 12 meses", "mensalmente"), extraia 'installments'.
       - Se mencionar data específica (ex: "dia 15", "ontem", "mês passado"), calcule e preencha 'date' (YYYY-MM-DD).
    2. É uma pergunta sobre finanças? (Ex: "Quanto gastei esse mês?", "Qual meu saldo?", "Resumo da semana").
    
    Retorne APENAS JSON.
    Formato:
    {
        "isTransaction": boolean,
        "transactionData": { 
            "type": "receita"|"despesa", 
            "category": "String", 
            "amount": number, 
            "description": "String",
            "date": "YYYY-MM-DD" (Obrigatório se mencionado, senão null),
            "installments": number (Padrão 1. Se for '3x' ou '3 meses', é 3)
        } (ou null se não for transação),
        "isQuery": boolean,
        "queryTopics": ["saldo" | "gastos_categoria" | "resumo_mensal" | "geral"]
    }
    Para categorias, use padrões como: Alimentação, Transporte, Casa, Lazer, Saúde, Educação, Trabalho.
    `;

    try {
        const response = await generateText(prompt, 'simple', 0.3, 500);
        const jsonText = response.content.replace(/^```json\s*|```\s*$/g, '').trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Erro na classificação de intenção:", e);
        return { isTransaction: false, isQuery: false }; // Fallback
    }
}

async function generateQueryResponse(userId: string, topics: string[], chatId?: number): Promise<string> {
    // Busca dados no Supabase baseado nos tópicos
    const now = new Date();
    
    // Ajuste para competência: USAR NOVA COLUNA DATE
    // Se for resumo mensal, buscar intervalo do mes atual
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    let contextData = "";

    // Queries comuns
    if (topics.includes('saldo') || topics.includes('resumo_mensal') || topics.includes('geral')) {
         const { data: transactions, error } = await supabase
            .from('transactions')
            .select('type, amount, category, date')
            .eq('user_id', userId)
            .gte('date', firstDay)
            .lte('date', lastDay);

        if (error) {
            console.error('Erro ao buscar transações:', error);
        }

        if (transactions && transactions.length > 0) {
            const despesas = transactions.filter(t => t.type === 'despesa').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const receitas = transactions.filter(t => t.type === 'receita').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const refMonth = months[now.getMonth()];
            contextData += `Resumo (${refMonth}): Receitas R$ ${receitas.toFixed(2)}, Despesas R$ ${despesas.toFixed(2)}. Saldo do mês: R$ ${(receitas - despesas).toFixed(2)}. Total de transações: ${transactions.length}. `;
        }
    }
    
    if (topics.includes('gastos_categoria')) {
        const { data: byCategory, error } = await supabase
             .from('transactions')
             .select('category, amount')
             .eq('user_id', userId)
             .eq('type', 'despesa')
             .gte('date', firstDay)
             .lte('date', lastDay);
        
        if (error) {
            console.error('Erro ao buscar gastos por categoria:', error);
        }
             
        if (byCategory && byCategory.length > 0) {
            const catTotals: Record<string, number> = {};
            byCategory.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount); });
            contextData += `Gastos por Categoria este mês: ${JSON.stringify(catTotals)}. `;
        }
    }

    // ✅ Buscar histórico de conversa se chatId fornecido
    let historyContext = "";
    if (chatId) {
        const history = await getTelegramHistory(chatId);
        if (history.length > 0) {
            historyContext = `\n\nHistórico recente:\n${history.slice(-3).map(h => 
                `${h.role === 'user' ? 'Usuário' : 'Você'}: ${h.content.substring(0, 100)}`
            ).join('\n')}`;
        }
    }

    // Log para debug
    console.log(`[Telegram Query] userId: ${userId}, topics: ${topics.join(',')}, contextData length: ${contextData.length}`);
    
    // Se não encontrou dados, retornar mensagem mais útil
    if (!contextData || contextData.trim() === "") {
        return "Ainda não há transações registradas no mês atual. Registre suas transações (exemplo: 'Almoço 50 reais') para começar a receber análises financeiras.";
    }

    // Gerar resposta final com LLM
    const prompt = `
        Você é Spendly, assistente financeiro profissional do Telegram.
        
        Dados financeiros: ${contextData}${historyContext}
        
        Responda de forma profissional, clara e objetiva (2-3 linhas).
        Use no máximo 1 emoji por resposta, apenas se muito relevante.
        Foque em dados concretos e informações acionáveis.
    `;
    const llmResponse = await generateText(prompt, 'simple', 0.7, 300);
    return llmResponse.content;
}


// --- PROCESSAMENTO PRINCIPAL ---

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // Autenticação Webhook
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (secret !== webhookSecret) return response.status(401).send('Unauthorized');
  if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

  const payload: TelegramPayload = request.body;
  const message = payload.message;

  if (!message) return response.status(200).send('OK: No message');
  
  const chat = message.chat;
  const chatId = chat.id;

  try {
    // 0. Verificar Vinculação do Usuário
    
    // Check rápido para /start com parametro
    if (message.text?.startsWith('/start ')) {
        // Lógica de vinculação
        const parts = message.text.split(' ');
        const userIdFromCommand = parts[1];
        
        const { data: userBudgets } = await supabase.from('budgets').select('id, name').eq('user_id', userIdFromCommand).limit(1);
        const defaultBudgetId = userBudgets?.[0]?.id || null;

        await supabase.from('telegram_links').upsert({ 
            chat_id: chatId, 
            user_id: userIdFromCommand, 
            default_budget_id: defaultBudgetId 
        }, { onConflict: 'chat_id' });

        await sendTelegramMessage(chatId, `✅ *Conta Vinculada!* \n\nAgora você pode:\n- Escrever gastos ("Almoço 20 reais")\n- Mandar áudios\n- Mandar fotos de comprovantes\n- Perguntar "Quanto gastei esse mês?"`);
        return response.status(200).send('Linked');
    }

    // Buscar usuário vinculado
    const { data: linkData } = await supabase.from('telegram_links').select('*').eq('chat_id', chatId).single();
    
    if (!linkData) {
        await sendTelegramMessage(chatId, "⚠️ Sua conta não está vinculada. Acesse o app Lumina > Minha Conta > Telegram para obter o link.");
        return response.status(200).send('Not Linked');
    }
    const userData = linkData; // Explicit assignment to help TS inference flow or just use linkData direct
    const userId = userData.user_id;
    const budgetId = userData.default_budget_id;

    if (!budgetId) {
        await sendTelegramMessage(chatId, "⚠️ Você precisa definir um orçamento padrão no App para registrar transações.");
        return response.status(200).send('No Budget');
    }

    // 1. Comandos Especiais (/desfazer, /resumo)
    
    // --- DESFAZER ---
    if (message.text?.trim().toLowerCase() === '/desfazer') {
        // Buscar ultima transação deste usuário criada recentemente (ex: ultimos 10 min)
         const { data: lastTrans } = await supabase
            .from('transactions')
            .select('id, description, amount, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

         if (lastTrans) {
             await supabase.from('transactions').delete().eq('id', lastTrans.id);
             await sendTelegramMessage(chatId, `🗑️ Transação *"${lastTrans.description}"* (R$ ${lastTrans.amount}) apagada.`);
         } else {
             await sendTelegramMessage(chatId, "Não encontrei transações recentes para apagar.");
         }
         return response.status(200).send('Undo');
    }

    // --- RESUMO ---
    if (message.text?.trim().toLowerCase() === '/resumo') {
        await saveTelegramMessage(chatId, 'user', '/resumo'); // ✅ Salvar no histórico
        const resposta = await generateQueryResponse(userId, ['resumo_mensal'], chatId);
        await sendTelegramMessage(chatId, `📊 *Resumo Rápido:*\n${resposta}`);
        await saveTelegramMessage(chatId, 'assistant', resposta); // ✅ Salvar resposta
        return response.status(200).send('Summary');
    }

    // --- AÇÃO DE PENDENCIA (SIM/NÃO) ---
    const { data: pendingAction } = await supabase.from('pending_telegram_actions').select('*').eq('chat_id', chatId).single();
    if (pendingAction) {
        await supabase.from('pending_telegram_actions').delete().eq('id', pendingAction.id);
        const textLimpo = message.text?.toLowerCase().trim();
        if (textLimpo === 'sim' || textLimpo === 's' || textLimpo === 'yes') {
             if (pendingAction.action_type === 'create_category') {
                const payload = pendingAction.payload as any;
                // Criar categoria e transação
                await supabase.from('categories').insert({ user_id: userId, name: payload.category, type: payload.type });
                await supabase.from('transactions').insert(payload);
                await sendTelegramMessage(chatId, `✅ Categoria *Create* e transação registrada!`);
             }
        } else {
            await sendTelegramMessage(chatId, "❌ Operação cancelada.");
        }
        return response.status(200).send('Pending Resolved');
    }


    // 2. INPUT DE MÍDIA (Voz ou Imagem)
    let processedText = message.text;
    let transactionFromImage = null;

    if (message.voice) {
        await sendTelegramMessage(chatId, "🎧 Ouvindo...");
        const buffer = await getTelegramFileBuffer(message.voice.file_id);
        processedText = await transcribeAudio(buffer, message.voice.mime_type);
        await sendTelegramMessage(chatId, `🗣️ Entendi: _"${processedText}"_`);
    }

    else if (message.photo && message.photo.length > 0) {
        await sendTelegramMessage(chatId, "📸 Analisando imagem...");
        // Pegar a maior imagem (ultimo item do array)
        const photo = message.photo[message.photo.length - 1];
        const buffer = await getTelegramFileBuffer(photo.file_id);
        transactionFromImage = await analyzeImageForTransaction(buffer);
        
        if (!transactionFromImage) {
            await sendTelegramMessage(chatId, "⚠️ Não consegui ler os dados da imagem.");
            return response.status(200).send('Image Fail');
        }
    }

    // Se não tem texto nem dados de imagem, encerra
    if (!processedText && !transactionFromImage) {
        return response.status(200).send('Nothing to process');
    }

    // 3. INTENÇÃO & EXECUÇÃO
    
    // Se veio de imagem, já temos os dados da transação
    if (transactionFromImage) {
        await registerTransaction(userId, budgetId, chatId, transactionFromImage);
        return response.status(200).send('Image Transaction Saved');
    }

    // Se é texto (original ou transcrito), analisa a intenção
    if (processedText) {
        // ✅ Salvar mensagem do usuário no histórico
        await saveTelegramMessage(chatId, 'user', processedText);
        
        const intention = await understandIntention(processedText, userId);
        
        if (intention.isTransaction && intention.transactionData) {
            await registerTransaction(userId, budgetId, chatId, intention.transactionData);
        } else if (intention.isQuery && intention.queryTopics) {
             await sendTelegramMessage(chatId, "🔍 Consultando dados...");
             const answer = await generateQueryResponse(userId, intention.queryTopics, chatId); // ✅ Passar chatId
             await sendTelegramMessage(chatId, answer);
             await saveTelegramMessage(chatId, 'assistant', answer); // ✅ Salvar resposta
        } else {
            const fallbackMsg = "🤔 Não entendi se isso é um gasto ou uma pergunta. Tente ser mais claro. Ex: 'Gastei 15 na padaria' ou 'Qual meu saldo?'";
            await sendTelegramMessage(chatId, fallbackMsg);
            await saveTelegramMessage(chatId, 'assistant', fallbackMsg); // ✅ Salvar resposta
        }
    }

    return response.status(200).send('Done');
    
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    if(message?.chat?.id) await sendTelegramMessage(message.chat.id, "😵 Ocorreu um erro interno. Tente novamente mais tarde.");
    return response.status(500).send('Error');
  }
}


// Função auxiliar para Registrar e Validar Transação (COM SUPORTE A RECORRÊNCIA)
async function registerTransaction(userId: string, budgetId: string, chatId: number, data: any) {
    if(!data.amount || !data.category) {
         await sendTelegramMessage(chatId, "⚠️ Dados incompletos. Tente novamente.");
         return;
    }

    // Verificar Categoria
    const { data: catData } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', userId)
        .ilike('name', data.category)
        .single();
    
    // Definir data base
    const baseDateStr = data.date || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);

    // Preparar dados comuns com tipagem any para flexibilidade no loop de insercao
    const transactionBase: any = {
        user_id: userId,
        budget_id: budgetId,
        type: data.type || 'despesa',
        // categoria será ajustada abaixo
        amount: data.amount,
        // description será ajustada se for parcelado
        status: 'verified', // Padrão para input direto do usuário ("Gastei...")
        // is_completed: true // <-- REMOVIDO
    };

    if (!catData) {
        // Fluxo de criar categoria pendente (simplificado para não lidar com loop aqui ainda)
        // Se for nova categoria, só salvamos a primeira parcela como pendente por segurança UX
        transactionBase.category = data.category;
        transactionBase.description = data.description || 'Gasto via Telegram';
        transactionBase.date = baseDateStr;
        transactionBase.year = baseDate.getFullYear().toString();
        transactionBase.month = months[baseDate.getMonth()];

        await supabase.from('pending_telegram_actions').insert({
            chat_id: chatId,
            action_type: 'create_category',
            payload: transactionBase
        });
        await sendTelegramMessage(chatId, `A categoria *"${data.category}"* é nova. Deseja criá-la e salvar o gasto? (Sim/Não)`);
        return;
    }
    
    // Ajustar nome da categoria
    transactionBase.category = catData.name;

    // Loop de Inserção (Recorrência/Parcelamento)
    const installments = data.installments || 1;
    const transactionsToInsert: any[] = []; // Explicitamente tipado como any[]

    for (let i = 0; i < installments; i++) {
        // Clonar objeto base
        const trans = { ...transactionBase };
        
        // Calcular Data da Parcela
        const currentDate = new Date(baseDate);
        currentDate.setMonth(baseDate.getMonth() + i); // Adiciona i meses
        
        trans.date = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        trans.year = currentDate.getFullYear().toString();
        trans.month = months[currentDate.getMonth()];
        
        // Ajustar descrição se for parcelado
        if (installments > 1) {
            trans.description = `${data.description || 'Gasto Parcelado'} (${i + 1}/${installments})`;
        } else {
            trans.description = data.description || 'Gasto via Telegram';
        }

        transactionsToInsert.push(trans);
    }
        
    const { error } = await supabase.from('transactions').insert(transactionsToInsert);
    
    if (error) {
        console.error("Erro insert:", error);
        await sendTelegramMessage(chatId, "Erro ao salvar no banco de dados.");
    } else {
        const msgRecorrencia = installments > 1 ? `\n🗓️ Repetido por ${installments} meses` : '';
        const msgDate = data.date ? `\n📅 Data: ${data.date.split('-').reverse().join('/')}` : '';
        await sendTelegramMessage(chatId, `✅ *R$ ${data.amount}* em ${data.category}\n"${data.description}"${msgRecorrencia}${msgDate}\n\n(/desfazer para cancelar o último)`);
    }
}
