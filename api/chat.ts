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

    // --- ETAPA 1: LLM ANALISTA (COM CORREÇÃO DE IDIOMA) ---
    const rawHistoryForAnalyst = await redis.lrange(historyKey, 0, 5);
    const conversationHistoryForAnalyst = rawHistoryForAnalyst.reverse().join('\n');

    const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const analystPrompt = `
      Você é um sistema especialista que analisa a pergunta de um usuário sobre finanças e a converte em um objeto JSON para consulta.
      A data atual é ${currentDate}.

      **Instruções Críticas:**
      1.  **IDIOMA DO MÊS:** Ao extrair um mês, use sempre o nome completo e em **PORTUGUÊS** (ex: "Janeiro", "Fevereiro", "Outubro"). Esta regra é fundamental.
      2.  **PRIORIZE A PERGUNTA ATUAL:** Use o histórico da conversa apenas para resolver ambiguidades em perguntas curtas. Se a pergunta atual for completa, foque nela.
      3.  **Analisar 'type':** Inferir "despesa" ou "receita". 'type' só pode ter um desses dois valores.
      4.  **Analisar 'category':** É o substantivo principal da transação (ex: "cartão", "alimentação", "salário").
      5.  **Analisar 'query_type':**
          - 'filter': para listas de transações.
          - 'analysis': para cálculos ou comparações (total, média, maior/menor).
          - 'semantic': para buscas abertas baseadas em descrições.
          - 'general': para saudações ou perguntas que não se referem a transações.
      6.  **Formato de Saída:** Retorne APENAS o objeto JSON.

      **Exemplos Chave:**
      - Pergunta: "quanto gastei com alimentação nesse mês?" -> {"query_type":"analysis","filters":{"type":"despesa","category":"Alimentação","month":"Outubro","year":"2025"}}
      - Pergunta: "e em janeiro?" -> {"query_type":"analysis","filters":{"type":"despesa","category":"Alimentação","month":"Janeiro","year":"2025"}}

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

    // --- ETAPA 3: LLM APRESENTADOR ---
    const fullHistoryForPresenter = await redis.lrange(historyKey, 0, 9);
    const presenterConversationHistory = fullHistoryForPresenter.reverse().join('\n');

    const presenterPrompt = `
      **Persona:** Você é "Spendly", um especialista financeiro humano, amigável e extremamente competente. Sua comunicação é clara, direta e proativa.

      **Contexto:**
      - Histórico da Conversa: ${presenterConversationHistory || "Nenhuma."}
      - Pergunta do Usuário: "${message}"
      - Dados Encontrados: ${foundTransactions ? JSON.stringify(foundTransactions, null, 2) : "Nenhuma transação encontrada."}

      **Regras de Comportamento e Resposta:**
      1.  **Tom:** Natural e prestativo. Varie suas saudações e frases.
      2.  **Introdução:** Apresente-se apenas na primeira mensagem da conversa.
      3.  **Proatividade e Detalhe:** Ao responder uma pergunta de análise (soma, etc.), SEMPRE forneça o resultado principal e, se apropriado, detalhe os valores que o compõem.
      4.  **Precisão:** Baseie-se ESTRITAMENTE nos "Dados Encontrados".
      5.  **Dados Vazios:** Se não encontrar dados, informe de forma útil (ex: "Não encontrei registros de despesas com 'alimentação' em outubro...").
      6.  **Feedback:** Se o usuário der feedback, confirme que entendeu ("Entendido.") e siga a nova instrução.

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
