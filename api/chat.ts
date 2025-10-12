import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
// O supabaseAdmin ainda é útil para a chamada RPC, então o mantemos.
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
const generationModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      return new Response(JSON.stringify({ error: 'Faltando userId ou mensagem' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const historyKey = `chat_history:${userId}`;

    // --- ETAPA 1: RAG (com `fetch` para a Edge Function) ---
    
    // 1.1 Invocar a Edge Function 'generate-embedding' usando fetch
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variáveis de ambiente do Supabase não encontradas.');
    }

    const embeddingResponse = await fetch(`${supabaseUrl}/functions/v1/generate-embedding`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // A autenticação requer a service_role key como Bearer token
            'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ input: message })
    });

    if (!embeddingResponse.ok) {
        // Se houver um erro, agora podemos ver o status e a mensagem exata
        const errorBody = await embeddingResponse.text();
        throw new Error(`Erro ao gerar embedding: Status ${embeddingResponse.status} - ${errorBody}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding;

    // 1.2 Chamar a função RPC (esta parte continua igual)
    const { data: relevantTransactions, error: rpcError } = await supabaseAdmin.rpc(
      'search_transactions',
      {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.7,
        match_count: 10,
      }
    );

    if (rpcError) {
      console.error('Erro na busca RAG com Supabase RPC:', rpcError);
    }
    
    const ragContext = relevantTransactions && relevantTransactions.length > 0
      ? `Aqui estão algumas transações financeiras relevantes...\n${JSON.stringify(relevantTransactions, null, 2)}`
      : "Nenhuma transação financeira específica foi encontrada no histórico do usuário para esta pergunta.";

    // --- ETAPAS RESTANTES (sem alterações) ---
    // ... (resto do seu código)
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const conversationHistory = rawHistory.reverse().join('\n');
    const prompt = `...`; // Seu prompt aqui
    const result = await generationModel.generateContent(prompt);
    const aiResponse = result.response.text();
    // ... (salvar no Redis)

    return new Response(JSON.stringify({ response: aiResponse }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro na API de chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Ocorreu um erro.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
