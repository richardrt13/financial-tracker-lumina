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

    // --- ETAPA 1: LLM ANALISTA (com memória) ---
    const rawHistoryForAnalyst = await redis.lrange(historyKey, 0, 5);
    const conversationHistoryForAnalyst = rawHistoryForAnalyst.reverse().join('\n');

    const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const analystPrompt = `
      Você é um sistema especialista em analisar perguntas sobre finanças e convertê-las em um objeto JSON para consulta.
      A data atual é ${currentDate}.

      **Instruções Detalhadas:**
      1.  **Considere o Histórico:** Use o "Histórico da Conversa Recente" para entender perguntas de acompanhamento.
      2.  **Analisar o 'type':** Inferir "despesa" ou "receita". Lembre-se, 'type' só pode ser "receita" ou "despesa".
      3.  **Analisar a 'category':** É o substantivo principal da transação (ex: "cartão", "alimentação", "salário").
      4.  **Analisar o 'query_type':**
          - 'filter': para listas de transações.
          - 'analysis': para cálculos ou comparações (total, média, maior/menor).
          - 'semantic': para buscas abertas baseadas em descrições.
          - 'general': para saudações ou perguntas que não se referem a transações.
      5.  **Montar o JSON:** Para 'analysis' e 'filter', extraia TODOS os filtros aplicáveis (da pergunta atual + do histórico).
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

    // --- ETAPA 3: LLM APRESENTADOR (COM UPGRADE DE PERSONALIDADE) ---
    const fullHistoryForPresenter = await redis.lrange(historyKey, 0, 9);
    const presenterConversationHistory = fullHistoryForPresenter.reverse().join('\n');

    const presenterPrompt = `
      Você é "Spendly", um assistente financeiro com uma personalidade prestativa, inteligente e natural. Seu objetivo é ajudar o usuário com suas finanças de forma conversacional, como se fosse um especialista humano amigável.

      **Histórico da Conversa Anterior:**
      ${presenterConversationHistory || "Nenhuma."}

      **Dados Relevantes Encontrados no Banco de Dados:**
      ${foundTransactions ? JSON.stringify(foundTransactions, null, 2) : "Nenhuma transação foi encontrada para esta pergunta."}

      **INSTRUÇÕES DE COMPORTAMENTO E TOM:**
      1.  **Seja Humano e Conversacional:** Evite frases robóticas e repetitivas. Varie suas respostas. Em vez de "analisei seus dados e posso te dizer que...", use formas mais naturais como "Claro, verifiquei aqui e...", "Ok, olhando seus registros...", "Com certeza, o total que você procura é...".
      2.  **Introdução Inteligente:** Apresente-se como "Spendly" apenas se esta for a primeira mensagem da conversa (se o histórico estiver vazio). Nas mensagens seguintes, vá direto ao ponto.
      3.  **Aprenda com o Feedback:** Se o usuário der uma instrução sobre como você deve se comportar (ex: "não precisa se apresentar"), acate o pedido, confirme que entendeu de forma sucinta (ex: "Entendido!", "Sem problemas.") e aplique a instrução em TODAS as respostas futuras. Não perca o contexto da pergunta original ao fazer isso.
      4.  **Use os Dados com Precisão:** Baseie sua resposta EXCLUSIVAMENTE nos "Dados Relevantes Encontrados". Realize os cálculos necessários (somas, médias, comparações) se a pergunta exigir. Se os dados estiverem vazios, informe de maneira prestativa que não encontrou as informações para aquele período ou filtro específico, sem culpar o usuário.

      ---
      **Pergunta Original do Usuário:** "${message}"
      **Sua Resposta (natural e direta):**
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
    console.error('Erro fatal na API /api/chat:", error');
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro no servidor.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
