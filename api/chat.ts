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

    // --- ETAPA 1: LLM ANALISTA (COM MEMÓRIA E NOVA FERRAMENTA DE ANÁLISE) ---
    // Puxamos o histórico aqui para que o Analista tenha contexto
    const rawHistory = await redis.lrange(historyKey, 0, 5); // Um histórico menor é suficiente para o analista
    const conversationHistory = rawHistory.reverse().join('\n');

    const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const analystPrompt = `
      Você é um sistema especialista em analisar perguntas sobre finanças e convertê-las em um objeto JSON estruturado para consulta.
      A data atual é ${currentDate}.

      **Instruções Detalhadas:**
      1.  **Considere o Histórico:** Use o "Histórico da Conversa Recente" para entender perguntas de acompanhamento e preencher filtros que estejam faltando na pergunta atual.
      2.  **Analisar o 'type' da Transação:** Inferir "despesa" ou "receita" de verbos e substantivos. Lembre-se, 'type' só pode ser "receita" ou "despesa".
      3.  **Analisar a 'category':** É o substantivo principal da transação (ex: "cartão", "alimentação", "salário").
      4.  **Analisar o 'query_type':**
          - Use 'filter': para perguntas que pedem uma lista de transações. Ex: "quais foram meus gastos com comida em junho?".
          - Use 'analysis': para perguntas que requerem um cálculo ou comparação (total, média, maior/menor, etc). Ex: "quanto gastei no total?", "em qual mês gastei mais?".
          - Use 'semantic': para perguntas abertas baseadas em descrições vagas. Ex: "compras em lojas de fast food".
          - Use 'general': para saudações ou perguntas que não se referem a transações.
      5.  **Montar o JSON:** Para 'analysis' e 'filter', é crucial extrair TODOS os filtros aplicáveis (da pergunta atual + do histórico) para buscar os dados corretos.
      6.  **Formato de Saída:** Retorne APENAS o objeto JSON.

      **Exemplos Chave:**
      - Histórico: Usuário: "quanto gastei com cartão nesse ano?" / Pergunta: "e no mês de abril?" -> {"query_type":"analysis","filters":{"type":"despesa","category":"Cartão","year":"2025", "month":"Abril"}}
      - Pergunta: "em qual mês desse ano eu gastei mais com cartão?" -> {"query_type":"analysis","filters":{"type":"despesa","category":"Cartão","year":"2025"}}
      - Pergunta: "quais foram minhas receitas de salário?" -> {"query_type":"filter","filters":{"type":"receita","category":"Salário"}}

      ---
      **Histórico da Conversa Recente:**
      ${conversationHistory || "Nenhuma."}
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

    // Trata 'filter' e 'analysis' da mesma forma para buscar os dados brutos
    if ((queryParams.query_type === 'filter' || queryParams.query_type === 'analysis') && queryParams.filters) {
      let query = supabaseAdmin.from('transactions').select(COLUMNS_TO_SELECT);
      const filters = queryParams.filters;
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.month) query = query.eq('month', filters.month);
      if (filters.year) query = query.eq('year', filters.year);
      if (filters.category) {
        query = query.ilike('category', `%${filters.category}%`);
      }
      const { data, error } = await query.limit(100); // Aumenta o limite para análises anuais
      if (error) throw new Error(`Erro na busca com filtros: ${error.message}`);
      foundTransactions = data;
    } else if (queryParams.query_type === 'semantic' && queryParams.semantic_search_term) {
      // Lógica da busca semântica (inalterada)
    }

    console.log("Transações Encontradas (sem embedding):", foundTransactions);

    // --- ETAPA 3: LLM APRESENTADOR ---
    const fullHistoryForPresenter = await redis.lrange(historyKey, 0, 9);
    const presenterConversationHistory = fullHistoryForPresenter.reverse().join('\n');

    const presenterPrompt = `
      Você é "Spendly", um assistente financeiro especialista. Responda à pergunta do usuário de forma clara, amigável e direta, usando as informações fornecidas.

      **Histórico da Conversa Anterior:**
      ${presenterConversationHistory || "Nenhum."}

      **Dados Relevantes Encontrados no Banco de Dados:**
      ${foundTransactions ? JSON.stringify(foundTransactions, null, 2) : "Nenhuma transação foi encontrada para esta pergunta."}

      **INSTRUÇÕES:**
      - Baseie sua resposta EXCLUSIVAMENTE nos "Dados Relevantes Encontrados".
      - Se a pergunta do usuário pede uma análise (como "qual o maior", "qual o total"), realize o cálculo necessário com os dados fornecidos antes de responder.
      - Se os dados estiverem vazios, informe que não encontrou as informações.
      - Responda em português do Brasil.

      ---
      **Pergunta Original do Usuário:** "${message}"
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
