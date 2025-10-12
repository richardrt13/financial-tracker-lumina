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
  query_type: 'filter' | 'semantic' | 'general';
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

    // --- ETAPA 1: LLM ANALISTA - Extrair a intenção do usuário ---
    const currentDate = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const analystPrompt = `
      Você é um sistema inteligente que analisa a pergunta de um usuário sobre suas finanças e a converte em um objeto JSON.
      A data atual é ${currentDate}.

      Instruções:
      1. Determine o 'query_type':
         - Use 'filter' se a pergunta puder ser respondida com filtros exatos (tipo, categoria, mês, ano). Ex: "quanto gastei com comida em junho?".
         - Use 'semantic' se a pergunta for aberta ou baseada em descrições vagas. Ex: "quais foram minhas compras em lojas de fast food?".
         - Use 'general' para saudações, perguntas gerais que não envolvem dados de transações ou perguntas que você não entende. Ex: "Olá, tudo bem?", "qual a cotação do dólar?".
      2. Preencha o campo 'filters' com os valores extraídos da pergunta. Os valores possíveis para 'type' são "receita" ou "despesa".
      3. Se 'query_type' for 'semantic', preencha o campo 'semantic_search_term' com o texto que deve ser usado na busca por similaridade.
      4. Se um período de tempo não for especificado (ex: "esse mês", "ano passado"), use a data atual como referência.
      5. Retorne APENAS o objeto JSON, sem nenhum texto adicional.

      Exemplos:
      - Pergunta: "quanto ganhei de salário esse mês?" -> {"query_type": "filter", "filters": {"type": "receita", "category": "Salário", "month": "Outubro", "year": "2025"}}
      - Pergunta: "mostre meus gastos com almoços no ifood" -> {"query_type": "semantic", "semantic_search_term": "almoço no ifood", "filters": {"type": "despesa"}}
      - Pergunta: "quais transações eu já fiz?" -> {"query_type": "filter", "filters": {}}
      - Pergunta: "oi, quem é você?" -> {"query_type": "general"}

      ---
      Pergunta do Usuário: "${message}"
    `;

    const analystResult = await generationModel.generateContent(analystPrompt);
    // Limpa a resposta do modelo para garantir que seja um JSON válido
    const cleanedJsonString = analystResult.response.text().replace(/```json|```/g, '').trim();
    const queryParams: QueryParams = JSON.parse(cleanedJsonString);
    console.log("Parâmetros da Consulta Extraídos:", queryParams);


    // --- ETAPA 2: BUSCA DE DADOS (As "Ferramentas") ---
    let foundTransactions: any[] | null = null;
    
    if (queryParams.query_type === 'filter') {
      let query = supabaseAdmin.from('transactions').select('*');
      const filters = queryParams.filters || {};
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.category) query = query.eq('category', filters.category);
      if (filters.month) query = query.eq('month', filters.month);
      if (filters.year) query = query.eq('year', filters.year);
      
      const { data, error } = await query.limit(50); // Limita para não sobrecarregar
      if (error) throw new Error(`Erro na busca com filtros: ${error.message}`);
      foundTransactions = data;

    } else if (queryParams.query_type === 'semantic' && queryParams.semantic_search_term) {
      const { data: embeddingData, error: embeddingError } = await supabaseAdmin.functions.invoke(
        'generate-embedding', { body: { input: queryParams.semantic_search_term } }
      );
      if (embeddingError) throw new Error(`Erro ao gerar embedding: ${embeddingError.message}`);
      
      const { data, error: rpcError } = await supabaseAdmin.rpc('search_transactions', {
          query_embedding: embeddingData.embedding,
          similarity_threshold: 0.3, // Limiar ajustado para busca semântica
          match_count: 10,
        }
      );
      if (rpcError) throw new Error(`Erro na busca semântica: ${rpcError.message}`);
      foundTransactions = data;
    }

    console.log("Transações Encontradas:", foundTransactions);

    // --- ETAPA 3: LLM APRESENTADOR - Gerar a resposta final ---
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const conversationHistory = rawHistory.reverse().join('\n');

    const presenterPrompt = `
      Você é "Spendly", um assistente financeiro especialista. Sua tarefa é responder à pergunta do usuário de forma clara, amigável e direta, usando as informações fornecidas.

      **Histórico da Conversa Anterior:**
      ${conversationHistory || "Nenhum."}

      **Dados Relevantes Encontrados no Banco de Dados:**
      ${foundTransactions ? JSON.stringify(foundTransactions, null, 2) : "Nenhuma transação foi encontrada para esta pergunta."}

      **INSTRUÇÕES:**
      - Baseie sua resposta EXCLUSIVAMENTE nos "Dados Relevantes Encontrados".
      - Se a lista de dados estiver vazia, informe educadamente que não encontrou as informações solicitadas.
      - Se a pergunta for geral (saudações, etc.) e não houver dados, responda de forma apropriada sem mencionar as transações.
      - Realize cálculos como somas ou médias se a pergunta do usuário pedir.
      - Responda sempre em português do Brasil.

      ---
      **Pergunta Original do Usuário:** "${message}"
      **Sua Resposta:**
    `;

    const presenterResult = await generationModel.generateContent(presenterPrompt);
    const aiResponse = presenterResult.response.text();

    // --- ETAPA 4: ATUALIZAR MEMÓRIA (Redis) ---
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
