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
const generationModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

    // --- ETAPA 1: RAG (Busca de Dados Aumentada por Recuperação) ---
    
    // 1.1 Invocar a Edge Function para gerar o embedding da pergunta do usuário
    const { data: embeddingData, error: embeddingError } = await supabaseAdmin.functions.invoke(
      'generate-embedding',
      { body: { input: message } }
    );

    if (embeddingError) {
      throw new Error(`Erro ao invocar a função de embedding: ${embeddingError.message}`);
    }
    const queryEmbedding = embeddingData.embedding;

    // 1.2 Chamar a função do banco de dados para encontrar transações relevantes
    const { data: relevantTransactions, error: rpcError } = await supabaseAdmin.rpc(
      'search_transactions',
      {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.7, // Limiar de similaridade
        match_count: 10,           // Quantidade de resultados
      }
    );

    // Adicionamos um log detalhado aqui para o erro que você viu
    if (rpcError) {
      console.error('Erro na chamada RPC para search_transactions:', rpcError);
      throw new Error(`Falha na busca RAG: ${rpcError.message}`);
    }
    
    const ragContext = relevantTransactions && relevantTransactions.length > 0
      ? `Aqui estão algumas transações financeiras relevantes do histórico do usuário que podem ajudar a responder a pergunta:\n${JSON.stringify(relevantTransactions, null, 2)}`
      : "Nenhuma transação financeira específica foi encontrada no histórico do usuário para esta pergunta.";

    // --- ETAPA 2: MEMÓRIA CONVERSACIONAL (leitura do Redis) ---
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const conversationHistory = rawHistory.reverse().join('\n');

    // --- ETAPA 3: GERAÇÃO DO PROMPT E RESPOSTA ---
    const prompt = `
      Você é "Spendly", um assistente financeiro especialista. Responda à pergunta do usuário de forma direta, usando as informações fornecidas.

      **INFORMAÇÕES DISPONÍVEIS:**
      1.  **Histórico da Conversa:**
          ${conversationHistory || "Nenhum."}
      2.  **Dados Relevantes Encontrados:**
          ${ragContext}

      **INSTRUÇÕES:**
      - Use as informações acima para responder à pergunta do usuário.
      - Se os dados encontrados não forem suficientes, informe que não encontrou as informações.
      - Responda em português do Brasil.

      ---
      **Pergunta do Usuário:** "${message}"
      **Sua Resposta:**
    `;

    const result = await generationModel.generateContent(prompt);
    const aiResponse = result.response.text();

    // --- ETAPA 4: ESCRITA NO REDIS ---
    // Como a função não vai mais quebrar, este código agora será executado.
    await redis.lpush(historyKey, `Usuário: ${message}`);
    await redis.lpush(historyKey, `Assistente: ${aiResponse}`);
    await redis.ltrim(historyKey, 0, 19);

    return new Response(JSON.stringify({ response: aiResponse }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log aprimorado para vermos o erro exato no console da Vercel
    console.error('Erro fatal na API /api/chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro no servidor.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
