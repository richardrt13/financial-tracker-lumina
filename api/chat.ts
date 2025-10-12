import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '../src/lib/supabase-admin';

export const config = {
  runtime: 'edge',
};

// --- CONFIGURAÇÃO DOS CLIENTES ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const generationModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// --- TIPOS E INTERFACES ---
interface QueryParams {
  query_type: 'filter' | 'semantic' | 'analysis' | 'general';
  filters?: {
    type?: 'receita' | 'despesa';
    category?: string;
    month?: string;
    year?: string;
  };
  semantic_search_term?: string;
}

// --- FUNÇÃO PRINCIPAL DA API ---
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, message } = await req.json();
    if (!userId || !message) {
      throw new Error('userId e message são obrigatórios.');
    }

    const historyKey = `chat_history:${userId}`;

    // --- ETAPA 1: LLM ANALISTA (COM REGRA DE PRIORIDADE) ---
    const rawHistoryForAnalyst = await redis.lrange(historyKey, 0, 5);
    const conversationHistoryForAnalyst = rawHistoryForAnalyst.reverse().join('\n');

    const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const analystPrompt = `
      Você é um sistema especialista que analisa a pergunta de um usuário sobre finanças e a converte em um objeto JSON para consulta.
      A data atual é ${currentDate}.

      **Instruções Detalhadas:**
      1.  **PRIORIZE A PERGUNTA ATUAL:** Se a "Pergunta do Usuário" for completa e fizer sentido por si só, baseie sua análise nela. Use o "Histórico da Conversa" apenas para resolver ambiguidades ou entender perguntas de acompanhamento curtas (ex: "e no mês passado?"). Não deixe o histórico confundir a análise de uma pergunta nova e completa.
      2.  **Analisar 'type':** Inferir "despesa" ou "receita". 'type' só pode ser "receita" ou "despesa".
      3.  **Analisar 'category':** É o substantivo principal da transação (ex: "cartão", "alimentação", "salário").
      4.  **Analisar 'query_type':**
          - 'filter': para listas de transações.
          - 'analysis': para cálculos ou comparações (total, média, maior/menor).
          - 'semantic': para buscas abertas baseadas em descrições.
          - 'general': para saudações ou perguntas que não se referem a transações.
      5.  **Montar o JSON:** Para 'analysis' e 'filter', extraia TODOS os filtros aplicáveis.
      6.  **Formato de Saída:** Retorne APENAS o objeto JSON.

      ---
      **Histórico da Conversa Recente:**
      ${conversationHistoryForAnalyst || "Nenhuma."}
      ---
      **Pergunta do Usuário a ser Analisada:** "${message}"
    `;

    const analystResult = await generationModel.generateContent(analystPrompt);
    const cleanedJsonString = analystResult.response.text().replace(/```json|```/g, '').trim();
    const queryParams: QueryParams = JSON.parse(cleanedJsonString);
    console.log("Parâmetros da Consulta Extraídos:", queryParams);

    // --- ETAPA 2: BUSCA DE DADOS ---
    let foundTransactions: any[] | null = null;
    const COLUMNS_TO_SELECT = 'id, amount, type, category, month, year, description, created_at';

    if ((queryParams.query_type === 'filter' || queryParams.query_type === 'analysis') && queryParams.filters) {
      let query = supabaseAdmin.from('transactions').select(COLUMNS_TO_SELECT);
      const filters = queryParams.filters;
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.month) query = query.eq('month', filters.month);
      if (filters.year) query = query.eq('year', filters.year);
      if (filters.category) {
        query = query.ilike('category', `%${filters.category}%`);
      }
      const { data, error } = await query.limit(100);
      if (error) throw new Error(`Erro na busca com filtros: ${error.message}`);
      foundTransactions = data;
    } else if (queryParams.query_type === 'semantic' && queryParams.semantic_search_term) {
       // Lógica da busca semântica
    }

    console.log("Transações Encontradas (sem embedding):", foundTransactions);

    // --- ETAPA 3: LLM APRESENTADOR (COM PERSONA DEFINIDA) ---
    const fullHistoryForPresenter = await redis.lrange(historyKey, 0, 9);
    const presenterConversationHistory = fullHistoryForPresenter.reverse().join('\n');

    const presenterPrompt = `
      **Persona:** Você é "Spendly", um especialista financeiro humano, amigável e extremamente competente. Sua comunicação é clara, direta e proativa. Você antecipa as necessidades do usuário e fornece detalhes úteis sem que ele precise pedir.

      **Contexto:**
      - Histórico da Conversa Anterior: ${presenterConversationHistory || "Nenhuma."}
      - Pergunta do Usuário: "${message}"
      - Dados Encontrados: ${foundTransactions ? JSON.stringify(foundTransactions, null, 2) : "Nenhuma transação encontrada."}

      **Regras de Comportamento e Resposta:**
      1.  **Tom:** Mantenha um tom natural e prestativo. Varie suas saudações e frases.
      2.  **Introdução:** Apresente-se apenas na primeira mensagem da conversa. Depois, seja direto.
      3.  **Proatividade e Detalhe:** Ao responder uma pergunta de análise (soma, média, etc.), SEMPRE forneça o resultado principal (ex: o total) e, se os dados agregarem múltiplas sub-categorias (ex: "Cartão Inter" e "Cartão C6" dentro da categoria "Cartão"), **SEMPRE** apresente um resumo com o detalhamento desses valores. Isso não é opcional.
      4.  **Precisão:** Baseie-se ESTRITAMENTE nos "Dados Encontrados". Não invente informações.
      5.  **Dados Vazios:** Se não encontrar dados, informe de forma útil, sugerindo o que pode ter acontecido (ex: "Não encontrei registros de despesas com 'alimentação' em julho. Pode ser que não tenha havido nenhuma, ou que foram categorizadas de outra forma.").
      6.  **Feedback:** Se o usuário der feedback ("não faça X") siga a nova instrução.


      ---
      **Sua Resposta:**
    `;

    const presenterResult = await generationModel.generateContent(presenterPrompt);
    const aiResponse = presenterResult.response.text();

    // --- ETAPA 4: ATUALIZAR MEMÓRIA ---
    await redis.lpush(historyKey, `Usuário: ${message}`);
    await redis.lpush(historyKey, `Assistente: ${aiResponse}`);
    await redis.ltrim(historyKey, 0, 19);

    return new Response(JSON.stringify({ response: aiResponse }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro fatal na API /api/chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro no servidor.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
