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
const generationModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// =================================================================
// --- ETAPA 1: DEFINIÇÃO DAS FERRAMENTAS (Tools) ---
// Cada ferramenta é uma função que executa uma tarefa específica e confiável.
// =================================================================

/**
 * Busca transações com base em filtros precisos.
 */
async function tool_fetchTransactions(filters: any) {
  const COLUMNS_TO_SELECT = 'id, amount, type, category, month, year, description, created_at';
  let query = supabaseAdmin.from('transactions').select(COLUMNS_TO_SELECT);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.month) query = query.eq('month', filters.month);
  if (filters.year) query = query.eq('year', filters.year);
  if (filters.category) query = query.ilike('category', `%${filters.category}%`);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Erro na busca com filtros: ${error.message}`);
  return data;
}

/**
 * Calcula o tempo necessário para atingir uma meta de economia.
 */
async function tool_calculateSavingsGoal(goal_amount: number) {
  const { data: allTransactions, error } = await supabaseAdmin.from('transactions').select('amount, type, month, year');
  if (error) throw new Error(`Erro ao buscar todas as transações: ${error.message}`);
  
  const monthlySummary: { [key: string]: { receita: number; despesa: number } } = {};
  for (const t of allTransactions!) {
    const key = `${t.year}-${t.month}`;
    if (!monthlySummary[key]) monthlySummary[key] = { receita: 0, despesa: 0 };
    if (t.type === 'receita') monthlySummary[key].receita += t.amount;
    else if (t.type === 'despesa') monthlySummary[key].despesa += t.amount;
  }

  const months = Object.keys(monthlySummary);
  if (months.length === 0) return { error: "Não há dados suficientes para calcular a média." };
  
  const totalIncome = months.reduce((acc, key) => acc + monthlySummary[key].receita, 0);
  const totalExpense = months.reduce((acc, key) => acc + monthlySummary[key].despesa, 0);
  
  const averageMonthlyIncome = totalIncome / months.length;
  const averageMonthlyExpense = totalExpense / months.length;
  const averageMonthlySavings = averageMonthlyIncome - averageMonthlyExpense;

  if (averageMonthlySavings <= 0) {
    return { error: "Sua média de gastos é maior ou igual à sua média de receitas. Não é possível juntar dinheiro com essa média." };
  }

  const monthsToReachGoal = Math.ceil(goal_amount / averageMonthlySavings);
  return {
    goalAmount: goal_amount,
    averageMonthlyIncome,
    averageMonthlyExpense,
    averageMonthlySavings,
    monthsToReachGoal,
    yearsToReachGoal: parseFloat((monthsToReachGoal / 12).toFixed(1)),
  };
}


// --- FUNÇÃO PRINCIPAL DA API ---
export default async function handler(req: Request) {
  try {
    const { userId, message } = await req.json();
    if (!userId || !message) throw new Error('userId e message são obrigatórios.');

    const historyKey = `chat_history:${userId}`;

    // --- ETAPA 2: LLM ORQUESTRADOR - Decide qual ferramenta usar ---
    const rawHistoryForAnalyst = await redis.lrange(historyKey, 0, 5);
    const conversationHistoryForAnalyst = rawHistoryForAnalyst.reverse().join('\n');

    const orchestratorPrompt = `
      Você é um orquestrador de IA que analisa uma pergunta do usuário e decide qual ferramenta usar para respondê-la.

      **Ferramentas Disponíveis:**
      - **fetchTransactions**: Use para perguntas que pedem uma lista de transações ou um cálculo simples sobre um subconjunto de dados (ex: "quanto gastei com comida em abril?"). Argumentos: \`filters\` (com type, category, month, year).
      - **calculateSavingsGoal**: Use para perguntas complexas sobre projeções e metas financeiras que requerem uma análise completa de receitas e despesas (ex: "em quanto tempo junto X?"). Argumentos: \`goal_amount\`.
      - **generalConversation**: Use para saudações, perguntas gerais ou quando nenhuma outra ferramenta se aplica. Argumentos: nenhum.
      
      **Instruções:**
      1. Analise o histórico e a pergunta do usuário.
      2. Escolha a ferramenta MAIS ADEQUADA.
      3. Extraia os argumentos necessários para a ferramenta.
      4. Retorne APENAS um objeto JSON com 'tool_name' e 'arguments'.

      **Exemplos:**
      - Pergunta: "quanto gastei com cartão esse ano?" -> {"tool_name":"fetchTransactions","arguments":{"filters":{"type":"despesa","category":"Cartão","year":"2025"}}}
      - Pergunta: "em quanto tempo consigo juntar 100 mil?" -> {"tool_name":"calculateSavingsGoal","arguments":{"goal_amount":100000}}
      - Pergunta: "oi, tudo bem?" -> {"tool_name":"generalConversation","arguments":{}}

      ---
      **Histórico da Conversa:**
      ${conversationHistoryForAnalyst || "Nenhuma."}
      ---
      **Pergunta do Usuário:** "${message}"
    `;

    const orchestratorResult = await generationModel.generateContent(orchestratorPrompt);
    const toolCall = JSON.parse(orchestratorResult.response.text().replace(/```json|```/g, '').trim());
    console.log("Decisão do Orquestrador:", toolCall);

    // --- ETAPA 3: DISPATCHER E EXECUÇÃO DA FERRAMENTA ---
    let toolResult: any = null;
    if (toolCall.tool_name === 'fetchTransactions') {
      toolResult = await tool_fetchTransactions(toolCall.arguments.filters);
    } else if (toolCall.tool_name === 'calculateSavingsGoal') {
      toolResult = await tool_calculateSavingsGoal(toolCall.arguments.goal_amount);
    } else {
      toolResult = "Nenhuma ferramenta necessária.";
    }
    console.log("Resultado da Ferramenta:", toolResult);

    // --- ETAPA 4: LLM APRESENTADOR ---
    const fullHistoryForPresenter = await redis.lrange(historyKey, 0, 9);
    const presenterConversationHistory = fullHistoryForPresenter.reverse().join('\n');

    const presenterPrompt = `
      **Persona:** Você é "Spendly", um especialista financeiro humano, amigável e competente.
      **Tarefa:** Sua tarefa é pegar o resultado de uma ferramenta interna e apresentá-lo ao usuário de forma clara e conversacional.

      **Contexto:**
      - Histórico da Conversa: ${presenterConversationHistory || "Nenhuma."}
      - Pergunta Original do Usuário: "${message}"
      - Resultado da Ferramenta Interna: ${JSON.stringify(toolResult, null, 2)}

      **Regras:**
      1.  Traduza o JSON do "Resultado da Ferramenta" em uma resposta humana e útil.
      2.  Se o resultado for uma lista, resuma os dados. Se for um cálculo, explique o resultado.
      3.  Mantenha o tom natural e seja proativo.
      
      ---
      **Sua Resposta:**
    `;

    const presenterResult = await generationModel.generateContent(presenterPrompt);
    const aiResponse = presenterResult.response.text();

    // --- ETAPA 5: ATUALIZAR MEMÓRIA ---
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
