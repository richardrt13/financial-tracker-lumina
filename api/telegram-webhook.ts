import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, InlineDataPart } from '@google/generative-ai';

// A constante 'months' é definida localmente para evitar erros de importação no ambiente serverless.
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Interfaces para a estrutura de dados do Telegram
interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type: string; // Geralmente 'audio/ogg'
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; is_bot: boolean; first_name: string; username: string; };
  chat: { id: number; first_name: string; username: string; type: 'private'; };
  date: number;
  text?: string;
  voice?: TelegramVoice;
}

interface TelegramPayload {
  update_id: number;
  message?: TelegramMessage;
}

// Inicialização de Clientes
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY!;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET!;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey || !telegramBotToken || !webhookSecret) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente faltando. Verifique a configuração na Vercel.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genai = new GoogleGenerativeAI(geminiApiKey);

async function sendTelegramMessage(chat_id: number, text: string) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar mensagem para o Telegram:", errorData);
    }
  } catch (error) {
      console.error("Falha de rede ao contatar a API do Telegram:", error);
  }
}

async function extractTransaction(text: string): Promise<any> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const currentYear = new Date().getFullYear();
  const currentMonthName = months[new Date().getMonth()];

  const prompt = `
    Analise o texto a seguir para extrair uma transação financeira: "${text}".
    Retorne APENAS um objeto JSON com os campos: type, category, amount, description, month, year.
    - 'type' deve ser 'receita', 'despesa' ou 'investimento'.
    - 'category' deve ser uma categoria adequada.
    - 'amount' deve ser um número.
    - 'description' é a descrição completa.
    - 'month' é o nome do mês em português (Ex: "Junho"). Se não especificado, use "${currentMonthName}".
    - 'year' é o ano com 4 dígitos. Se não especificado, use "${currentYear}".
    
    Exemplo de saída:
    { "type": "despesa", "category": "Alimentação", "amount": 55.40, "description": "Lanche no iFood", "month": "${currentMonthName}", "year": "${currentYear}" }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Erro na API Gemini (extração de texto):', error);
    return null;
  }
}

function bufferToGenerativePart(buffer: Buffer, mimeType: string): InlineDataPart {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

async function transcribeAudioWithGemini(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const audioPart = bufferToGenerativePart(audioBuffer, mimeType);
  const prompt = "Transcreva este áudio para texto em português. Responda apenas com a transcrição.";
  
  try {
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Erro na API Gemini (transcrição de áudio):", error);
    throw new Error('Falha ao transcrever o áudio com a IA.');
  }
}


// O handler principal da Vercel Function
async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (secret !== webhookSecret) {
    return response.status(401).send('Unauthorized');
  }

  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  const payload: TelegramPayload = request.body;
  const message = payload.message;

  if (!message) {
    return response.status(200).send('OK: No message payload');
  }

  const { chat } = message;
  let commandText = message.text; // Pode ser undefined

  try {
    // Processamento de Áudio
    if (message.voice) {
      await sendTelegramMessage(chat.id, 'Recebi seu áudio, vou transcrever...');
      const fileInfoUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${message.voice.file_id}`;
      const fileInfoResponse = await fetch(fileInfoUrl);
      const fileInfo = await fileInfoResponse.json();
      if (!fileInfo.ok || !fileInfo.result.file_path) {
        throw new Error("Não foi possível obter informações do arquivo de áudio.");
      }
      
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
      const audioResponse = await fetch(fileUrl);
      const audioArrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);
      
      const transcribedText = await transcribeAudioWithGemini(audioBuffer, message.voice.mime_type || 'audio/ogg');
      if (!transcribedText) {
        await sendTelegramMessage(chat.id, "Não consegui entender o que foi dito no áudio.");
        return response.status(200).send('Transcription failed');
      }
      await sendTelegramMessage(chat.id, `Entendi: "_${transcribedText}_"\n\nAgora vou processar...`);
      commandText = transcribedText;
    }

    if (!commandText) {
        return response.status(200).send('OK: No text command to process');
    }

    // Lógica para comando /start (Vinculação de Conta)
    if (commandText.startsWith('/start')) {
      const parts = commandText.split(' ');
      if (parts.length > 1 && parts[1]) {
        const userIdFromCommand = parts[1];
        let defaultBudgetIdToSet: string | null = null;
        let botResponseMessage = '✅ Conta vinculada com sucesso!';

        const { data: userBudgets, error: budgetError } = await supabase
            .from('budgets')
            .select('id, name')
            .eq('user_id', userIdFromCommand)
            .order('order_position', { ascending: true })
            .limit(1);

        if (budgetError) {
            console.error("Erro ao buscar orçamentos durante a vinculação:", budgetError);
            botResponseMessage += '\n\nConfigure um orçamento padrão no app em "Minha Conta".';
        } else if (userBudgets && userBudgets.length > 0) {
            defaultBudgetIdToSet = userBudgets[0].id;
            botResponseMessage += `\n\nO orçamento *"${userBudgets[0].name}"* foi definido como padrão. Você pode alterar isso no app.`;
        } else {
             botResponseMessage += `\n\nLembre-se de criar seu primeiro orçamento no aplicativo!`;
        }

        const { error: upsertError } = await supabase
          .from('telegram_links')
          .upsert({ chat_id: chat.id, user_id: userIdFromCommand, default_budget_id: defaultBudgetIdToSet }, { onConflict: 'chat_id' });

        if (upsertError) throw new Error(`Não foi possível salvar a vinculação: ${upsertError.message}`);
        
        await sendTelegramMessage(chat.id, botResponseMessage);
        return response.status(200).send('Link successful');
      } else {
        await sendTelegramMessage(chat.id, 'Bem-vindo! Para vincular sua conta, acesse a seção "Minha Conta" no app Spendly.');
        return response.status(200).send('Welcome message sent');
      }
    }

    // Lógica para Ações Pendentes (Criar Categoria)
    const { data: pendingAction, error: pendingError } = await supabase
        .from('pending_telegram_actions')
        .select('*').eq('chat_id', chat.id).single();
    if (pendingError && pendingError.code !== 'PGRST116') throw pendingError;

    if (pendingAction) {
        await supabase.from('pending_telegram_actions').delete().eq('id', pendingAction.id);
        if (commandText.toLowerCase().trim() === 'sim') {
            if (pendingAction.action_type === 'create_category') {
                const transactionPayload = pendingAction.payload as any;
                await supabase.from('categories').insert({ user_id: transactionPayload.user_id, name: transactionPayload.category, type: transactionPayload.type });
                await supabase.from('transactions').insert(transactionPayload);
                await sendTelegramMessage(chat.id, `✅ Categoria *"${transactionPayload.category}"* criada e transação registrada com sucesso!`);
                supabase.functions.invoke('process-queue').catch(console.error);
                return response.status(200).send('Pending action resolved: YES');
            }
        } else {
            await sendTelegramMessage(chat.id, 'Ok, a operação foi cancelada.');
            return response.status(200).send('Pending action resolved: NO');
        }
    }
    
    // Lógica para transações normais
    const { data: userData, error: userError } = await supabase.from('telegram_links').select('user_id, default_budget_id').eq('chat_id', chat.id).single();
    if (userError || !userData) {
      await sendTelegramMessage(chat.id, `Sua conta do Telegram não está vinculada. Acesse o app para fazer a vinculação.`);
      return response.status(200).send('User not linked');
    }

    const { user_id, default_budget_id } = userData;
    if (!default_budget_id) {
        await sendTelegramMessage(chat.id, `Você precisa definir um orçamento padrão no app (em "Minha Conta") para criar transações.`);
        return response.status(200).send('Default budget not set');
    }

    if (!message.voice) await sendTelegramMessage(chat.id, 'Analisando seu comando...');
    const transactionData = await extractTransaction(commandText);
    if (!transactionData || !transactionData.amount || !transactionData.category || !transactionData.type) {
      await sendTelegramMessage(chat.id, 'Não consegui extrair os detalhes da transação. Tente ser mais específico.');
      return response.status(200).send('AI extraction failed');
    }

    // Validação da Categoria
    const { data: categoryData, error: categoryError } = await supabase.from('categories').select('name').eq('user_id', user_id).ilike('name', transactionData.category).single();
    if (categoryError && categoryError.code !== 'PGRST116') throw categoryError;
    
    if (!categoryData) {
        const pendingPayload = { user_id, budget_id: default_budget_id, ...transactionData, is_completed: false };
        await supabase.from('pending_telegram_actions').insert({ chat_id: chat.id, action_type: 'create_category', payload: pendingPayload });
        await sendTelegramMessage(chat.id, `A categoria *"${transactionData.category}"* não foi encontrada. Deseja criá-la e registrar a transação?\n\nResponda com *sim* ou *não*.`);
        return response.status(200).send('Pending category creation');
    }
    
    // Salvar transação com categoria existente
    const { error: insertError } = await supabase.from('transactions').insert({ user_id, budget_id: default_budget_id, ...transactionData, is_completed: false });
    if (insertError) throw insertError;
    supabase.functions.invoke('process-queue').catch(console.error);
    const confirmationText = `✅ Transação registrada na categoria existente *"${transactionData.category}"*!`;
    await sendTelegramMessage(chat.id, confirmationText);

    return response.status(200).send('Success');

  } catch (error: any) {
    console.error('Erro no webhook do Telegram:', error);
    await sendTelegramMessage(chat.id, `Ocorreu um erro ao processar sua solicitação.`);
    return response.status(200).send('Error processed');
  }
}

export default handler;
