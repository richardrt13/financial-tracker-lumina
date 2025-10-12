// Importações de pacotes, sem 'next/server'
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configuração do Vercel Edge Runtime (isto é lido pela Vercel no momento do build)
export const config = {
  runtime: 'edge',
};

// --- CONFIGURAÇÃO DOS CLIENTES (sem alterações) ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!, // Lembre-se que no Vite, as variáveis de ambiente do cliente precisam do prefixo VITE_
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Esta é uma variável de servidor, então o nome está correto
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const generationModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });

// --- FUNÇÃO PRINCIPAL DA API (usando Request e Response padrão) ---

export default async function handler(req: Request) { // Usamos a interface 'Request' padrão
  // O método POST é o padrão para essa lógica
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
      ? `Aqui estão algumas transações financeiras relevantes...\n${JSON.stringify(relevantTransactions, null, 2)}`
      : "Nenhuma transação financeira específica foi encontrada...";

    // --- ETAPA 2: MEMÓRIA CONVERSACIONAL ---
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const conversationHistory = rawHistory.reverse().join('\n');

    // --- ETAPA 3: GERAÇÃO DA RESPOSTA (PROMPT ENGINEERING) ---
    const prompt = `
      Você é "Spendly", um assistente financeiro pessoal...

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

    // --- ETAPA 4: GERENCIAMENTO DO HISTÓRICO ---
    // Usamos `await` diretamente pois o runtime Edge pode não lidar bem com `Promise.all` sem um `context.waitUntil`
    await redis.lpush(historyKey, `Usuário: ${message}`);
    await redis.lpush(historyKey, `Assistente: ${aiResponse}`);
    await redis.ltrim(historyKey, 0, 19);

    // --- ETAPA 5: ENVIAR A RESPOSTA ---
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