import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '../src/lib/supabase-admin';

export const config = {
  runtime: 'edge',
};

// --- CONFIGURAÇÃO DOS CLIENTES (agora mais limpo) ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const generationModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

// --- FUNÇÃO PRINCIPAL DA API ---
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, message } = await req.json();

    if (!userId || !message) {
      return new Response(JSON.stringify({ error: 'Faltando userId ou mensagem' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const historyKey = `chat_history:${userId}`;

    // --- ETAPA 1: RAG (Retrieval-Augmented Generation) ---
    const queryEmbeddingResult = await embeddingModel.embedContent(message);
    const queryEmbedding = queryEmbeddingResult.embedding.values;

    // Passo 2: Usar o cliente importado diretamente
    // O erro "supabaseKey is required" não acontecerá mais aqui, pois a verificação já foi feita no módulo.
    const { data: relevantTransactions, error: rpcError } = await supabaseAdmin.rpc(
      'search_transactions',
      {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.75,
        match_count: 10,
      }
    );

    if (rpcError) {
      console.error('Erro na busca RAG com Supabase:', rpcError);
    }

    const ragContext = relevantTransactions && relevantTransactions.length > 0
      ? `Aqui estão algumas transações financeiras relevantes encontradas no histórico do usuário que podem ajudar a responder a pergunta:\n${JSON.stringify(relevantTransactions, null, 2)}`
      : "Nenhuma transação financeira específica foi encontrada no histórico do usuário para esta pergunta.";

    // --- ETAPAS 2, 3, 4 e 5 (sem alterações) ---
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const conversationHistory = rawHistory.reverse().join('\n');

    const prompt = `
      Você é "Spendly", um assistente financeiro pessoal, amigável e especialista...
      (O resto do seu prompt continua aqui)
      
      **Contexto da Conversa Anterior:**
      ${conversationHistory}

      **Dados Relevantes do Histórico Financeiro:**
      ${ragContext}
      
      **Pergunta Atual do Usuário:**
      "${message}"

      **Sua Resposta:**
    `;

    const result = await generationModel.generateContent(prompt);
    const aiResponse = result.response.text();

    await redis.lpush(historyKey, `Usuário: ${message}`);
    await redis.lpush(historyKey, `Assistente: ${aiResponse}`);
    await redis.ltrim(historyKey, 0, 19);

    return new Response(JSON.stringify({ response: aiResponse }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro na API de chat:', error);
    return new Response(JSON.stringify({ error: 'Ocorreu um erro ao processar sua solicitação.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
