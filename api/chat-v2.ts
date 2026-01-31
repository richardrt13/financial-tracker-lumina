import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '../src/lib/supabase-admin';

export const config = {
  runtime: 'edge',
  maxDuration: 60, // Aumentar timeout
};

// --- CONFIGURAÇÃO DOS CLIENTES ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// =====================================================
// SISTEMA DE AGENTES ESPECIALIZADOS
// =====================================================

/**
 * Agente Analisador - Análises quantitativas de dados financeiros
 */
async function analyzerAgent(query: string, context: any): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.3 }
  });

  const prompt = `
Você é um analista financeiro expert. Analise os dados com profundidade.

**Dados Financeiros:**
- Receita Média Mensal: R$ ${context.profile.averageIncome.toFixed(2)}
- Despesa Média Mensal: R$ ${context.profile.averageExpense.toFixed(2)}
- Taxa de Economia: ${context.profile.savingsRate.toFixed(1)}%
- Saúde Financeira: ${context.profile.financialHealth}

**Top Categorias de Gastos:**
${context.profile.topCategories.map((c: any) => `- ${c.category}: R$ ${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join('\n')}

**Transações Recentes (últimas 20):**
${JSON.stringify(context.recentTransactions.slice(0, 20), null, 2)}

**Pergunta:** ${query}

**Instruções:**
1. Analise os dados quantitativamente com precisão
2. Identifique padrões, tendências e anomalias
3. Compare com benchmarks financeiros (ex: 50/30/20 rule)
4. Use formatação Markdown rica (tabelas, listas, negrito)
5. Seja específico com números e percentuais
6. Forneça insights acionáveis

**Estrutura da Resposta:**
### 📊 Análise Financeira

**Resumo Executivo:**
[2-3 linhas principais]

**Análise Detalhada:**
[breakdown dos dados]

**Principais Insights:**
- Insight 1
- Insight 2
- Insight 3

**Recomendações:**
1. Ação específica 1
2. Ação específica 2
  `;

  const result = await model.generateContent(prompt);
  return {
    content: result.response.text(),
    confidence: 0.85,
    toolsUsed: ['data_analysis', 'trend_detection']
  };
}

/**
 * Agente Preditor - Projeções e previsões financeiras
 */
async function predictorAgent(query: string, context: any): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.4 }
  });

  // Calcular histórico mensal
  const monthlyData = calculateMonthlyHistory(context.recentTransactions);

  const prompt = `
Você é um especialista em modelagem financeira e previsões.

**Dados Históricos (últimos meses):**
${JSON.stringify(monthlyData, null, 2)}

**Perfil Atual:**
- Receita Média: R$ ${context.profile.averageIncome.toFixed(2)}
- Despesa Média: R$ ${context.profile.averageExpense.toFixed(2)}
- Economia Mensal: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}
- Taxa de Crescimento: ${context.profile.monthlyGrowth.toFixed(1)}%

**Pergunta:** ${query}

**Instruções:**
1. Analise as tendências históricas usando os dados mensais
2. Calcule médias móveis e variações
3. Projete 3 cenários: otimista (+10%), realista (base), pessimista (-10%)
4. Forneça intervalos de tempo específicos
5. Use fórmulas matemáticas quando relevante
6. Indique grau de confiança nas previsões

**Estrutura:**
### 🔮 Projeção Financeira

**Análise de Tendências:**
[análise do histórico]

**Cenários Projetados:**

**🟢 Otimista:**
- [projeção]

**🟡 Realista:**
- [projeção]

**🔴 Pessimista:**
- [projeção]

**Recomendações:**
[ações baseadas nas projeções]
  `;

  const result = await model.generateContent(prompt);
  return {
    content: result.response.text(),
    confidence: 0.75,
    toolsUsed: ['trend_analysis', 'forecasting']
  };
}

/**
 * Agente Executor - Detecção de intenções e ações
 */
async function executorAgent(query: string, context: any): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1 }
  });

  const prompt = `
Analise se a mensagem requer execução de ações no sistema.

**Mensagem:** "${query}"

**Ações Possíveis:**
- create_transaction: Criar receita, despesa ou investimento
- update_budget: Alterar orçamento
- set_goal: Definir meta de economia
- create_alert: Criar alerta de gastos
- none: Apenas conversa

**Retorne APENAS JSON válido:**
{
  "isExecutable": boolean,
  "action": "create_transaction" | "update_budget" | "set_goal" | "create_alert" | "none",
  "params": {
    "type": "receita|despesa|investimento",
    "amount": number,
    "category": "string",
    "description": "string",
    "date": "YYYY-MM-DD"
  },
  "confidence": number (0-1),
  "needsConfirmation": boolean,
  "confirmationMessage": "string"
}

**Exemplos:**
- "gastei 50 reais no almoço" -> create_transaction com despesa
- "recebi 3000 de salário" -> create_transaction com receita
- "quero economizar para comprar um carro" -> set_goal
- "me avise se gastar mais de 500 em lazer" -> create_alert
- "oi, tudo bem?" -> none
  `;

  const result = await model.generateContent(prompt);
  const intentJson = result.response.text().replace(/```json|```/g, '').trim();
  const intent = JSON.parse(intentJson);

  if (!intent.isExecutable || intent.action === 'none') {
    return {
      content: "Esta mensagem não requer ações específicas.",
      confidence: 0.9,
      toolsUsed: ['intent_detection']
    };
  }

  // Formatar resposta com ação sugerida
  const actionResponse = formatActionResponse(intent);

  return {
    content: actionResponse,
    confidence: intent.confidence,
    toolsUsed: ['intent_detection', 'action_generation'],
    suggestedActions: [
      {
        type: intent.action,
        label: getActionLabel(intent.action),
        description: intent.confirmationMessage || 'Executar ação',
        params: intent.params,
        priority: 'high'
      }
    ]
  };
}

/**
 * Agente de Insights - Descoberta proativa de padrões
 */
async function insightAgent(context: any): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7 }
  });

  const prompt = `
Você é um consultor financeiro experiente. Analise o perfil e descubra insights valiosos.

**Perfil Financeiro:**
${JSON.stringify(context.profile, null, 2)}

**Transações dos Últimos 30 Dias:**
${JSON.stringify(context.recentTransactions.slice(0, 30), null, 2)}

**Missão:**
1. Identificar padrões de comportamento (horários, categorias recorrentes, etc)
2. Detectar anomalias ou gastos atípicos
3. Encontrar oportunidades concretas de economia
4. Sugerir otimizações específicas e mensuráveis
5. Alertar sobre riscos ou problemas emergentes

**Estrutura:**
### 💡 Insights Financeiros Descobertos

**🔍 Padrões Identificados:**
- [padrão 1 com dados específicos]
- [padrão 2 com dados específicos]

**⚡ Oportunidades de Economia:**
- [oportunidade 1 com valor estimado]
- [oportunidade 2 com valor estimado]

**⚠️ Alertas e Riscos:**
- [alerta se houver]

**📈 Sugestões de Crescimento:**
- [sugestão prática]

Seja extremamente específico. Use números reais do contexto. Quantifique as oportunidades.
  `;

  const result = await model.generateContent(prompt);
  return {
    content: result.response.text(),
    confidence: 0.8,
    toolsUsed: ['pattern_recognition', 'anomaly_detection', 'opportunity_finding']
  };
}

/**
 * Agente de Conversação Geral
 */
async function generalAgent(query: string, context: any, history: any[]): Promise<any> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.8 }
  });

  const healthEmoji = {
    'excellent': '🌟',
    'good': '✅',
    'fair': '⚠️',
    'poor': '🔴'
  };

  const prompt = `
Você é **Spendly**, um assistente financeiro inteligente, amigável e proativo.

**Contexto do Usuário:**
- 💰 Economia Mensal: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}
- ${healthEmoji[context.profile.financialHealth as keyof typeof healthEmoji]} Saúde Financeira: ${context.profile.financialHealth}
- 📊 Taxa de Economia: ${context.profile.savingsRate.toFixed(1)}%

**Histórico da Conversa:**
${history.slice(-3).map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Você'}: ${m.content}`).join('\n')}

**Mensagem Atual:** ${query}

**Instruções:**
1. Responda de forma natural, amigável e empática
2. Use emojis apropriados para dar vida à conversa
3. Quando apropriado, mencione funcionalidades úteis
4. Se o usuário parecer perdido, ofereça sugestões do que pode perguntar
5. Seja proativa - sugira ações que podem ajudar
6. Use formatação Markdown para clareza

**Exemplos de Perguntas que Você Pode Sugerir:**
- "Quanto gastei este mês?"
- "Em quanto tempo consigo juntar R$ 10.000?"
- "Quais são minhas maiores despesas?"
- "Como está minha saúde financeira?"
- "Me dê insights sobre meus gastos"

Responda de forma personalizada e útil!
  `;

  const result = await model.generateContent(prompt);
  return {
    content: result.response.text(),
    confidence: 0.9,
    toolsUsed: ['general_conversation']
  };
}

// =====================================================
// ORQUESTRADOR PRINCIPAL
// =====================================================

async function orchestrateAgents(message: string, context: any, history: any[]): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2 }
    });

    const recentHistory = history.slice(-3).map((m: any) => 
      `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content.substring(0, 100)}`
    ).join('\n');

    const prompt = `
Você é um orquestrador de IA. Decida qual agente especializado deve responder.

**Agentes Disponíveis:**
1. **analyzer**: Análises quantitativas, métricas, comparações, relatórios detalhados
2. **predictor**: Projeções futuras, previsões, metas de tempo, cenários
3. **executor**: Criar/modificar transações, orçamentos, metas, alertas
4. **insight**: Descobrir padrões ocultos, oportunidades, sugestões proativas
5. **general**: Conversação casual, saudações, perguntas simples, ajuda

**Histórico Recente:**
${recentHistory}

**Mensagem:** "${message}"

**Critérios de Escolha:**
- Perguntas com "quanto", "qual total", "comparar" → analyzer
- Perguntas com "quando", "em quanto tempo", "projeção", "juntar" → predictor
- Frases com "criar", "registrar", "adicionar", "quero" → executor
- Solicitações de "insights", "dicas", "oportunidades", "melhorias" → insight
- Saudações, dúvidas gerais, conversação → general

**Retorne APENAS JSON válido, sem texto adicional:**
{
  "agent": "analyzer|predictor|executor|insight|general",
  "confidence": 0.9,
  "reasoning": "breve explicação"
}
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Limpar possíveis problemas de formatação
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Se a resposta começar com texto, tentar extrair apenas o JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    const decision = JSON.parse(responseText);
    return decision;
  } catch (error) {
    console.error('Erro no orquestrador:', error);
    // Fallback: decidir baseado em palavras-chave
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('quanto') || lowerMessage.includes('qual') || lowerMessage.includes('total')) {
      return { agent: 'analyzer', confidence: 0.7, reasoning: 'Fallback: palavra-chave de análise' };
    } else if (lowerMessage.includes('quando') || lowerMessage.includes('tempo') || lowerMessage.includes('juntar') || lowerMessage.includes('projeção')) {
      return { agent: 'predictor', confidence: 0.7, reasoning: 'Fallback: palavra-chave de previsão' };
    } else if (lowerMessage.includes('insight') || lowerMessage.includes('dica') || lowerMessage.includes('sugestão')) {
      return { agent: 'insight', confidence: 0.7, reasoning: 'Fallback: palavra-chave de insight' };
    } else {
      return { agent: 'general', confidence: 0.5, reasoning: 'Fallback: padrão' };
    }
  }
}

// =====================================================
// HELPERS
// =====================================================

function calculateMonthlyHistory(transactions: any[]): any {
  const monthlyData: Record<string, { income: number; expense: number; count: number }> = {};

  transactions.forEach((t: any) => {
    const date = new Date(t.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[key]) {
      monthlyData[key] = { income: 0, expense: 0, count: 0 };
    }

    if (t.type === 'receita') {
      monthlyData[key].income += Number(t.amount);
    } else if (t.type === 'despesa') {
      monthlyData[key].expense += Number(t.amount);
    }
    monthlyData[key].count++;
  });

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // Últimos 6 meses
    .map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense,
      transactions: data.count
    }));
}

function formatActionResponse(intent: any): string {
  let response = "### 🎯 Ação Detectada\n\n";
  
  if (intent.needsConfirmation) {
    response += "⚠️ **Preciso confirmar com você:**\n\n";
  } else {
    response += "✅ **Ação Pronta para Executar:**\n\n";
  }

  response += `**${intent.confirmationMessage}**\n\n`;
  
  if (intent.params) {
    response += "**Detalhes:**\n";
    if (intent.params.type) response += `- Tipo: ${intent.params.type}\n`;
    if (intent.params.amount) response += `- Valor: R$ ${intent.params.amount}\n`;
    if (intent.params.category) response += `- Categoria: ${intent.params.category}\n`;
    if (intent.params.description) response += `- Descrição: ${intent.params.description}\n`;
  }

  response += "\n_Você pode confirmar clicando no botão abaixo_";
  
  return response;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'create_transaction': 'Criar Transação',
    'update_budget': 'Atualizar Orçamento',
    'set_goal': 'Definir Meta',
    'create_alert': 'Criar Alerta'
  };
  return labels[action] || 'Executar Ação';
}

async function buildFinancialContext(userId: string): Promise<any> {
  try {
    // ✅ SEGURANÇA: Buscar APENAS transações do usuário logado
    // ✅ PERFORMANCE: Limitar a 100 transações mais recentes (reduzido de 200)
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, type, category, created_at') // Selecionar apenas campos necessários
      .eq('user_id', userId) // 🔒 ISOLAMENTO: Apenas dados do usuário
      .order('created_at', { ascending: false })
      .limit(100); // Reduzir para melhorar performance

    if (error) {
      console.error('Erro ao buscar transações:', error);
      throw error;
    }

    // Verificar se há dados
    if (!transactions || transactions.length === 0) {
      console.log(`Usuário ${userId} não tem transações`);
      return {
        profile: getDefaultProfile(),
        recentTransactions: []
      };
    }

    // Calcular perfil
    const profile = calculateFinancialProfile(transactions);

    console.log(`Contexto carregado para usuário ${userId}: ${transactions.length} transações`);

    return {
      profile,
      recentTransactions: transactions
    };
  } catch (error) {
    console.error('Error building context:', error);
    return {
      profile: getDefaultProfile(),
      recentTransactions: []
    };
  }
}

function calculateFinancialProfile(transactions: any[]): any {
  if (transactions.length === 0) return getDefaultProfile();

  // Últimos 3 meses
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const recent = transactions.filter(t => new Date(t.created_at) >= threeMonthsAgo);

  const monthlyData: Record<string, { income: number; expense: number }> = {};
  recent.forEach(t => {
    const key = `${new Date(t.created_at).getFullYear()}-${new Date(t.created_at).getMonth()}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type === 'receita') monthlyData[key].income += Number(t.amount);
    else if (t.type === 'despesa') monthlyData[key].expense += Number(t.amount);
  });

  const months = Object.values(monthlyData);
  const avgIncome = months.reduce((sum, m) => sum + m.income, 0) / (months.length || 1);
  const avgExpense = months.reduce((sum, m) => sum + m.expense, 0) / (months.length || 1);
  const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;

  // Top categorias
  const categoryTotals: Record<string, number> = {};
  let totalExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'despesa') {
      const cat = t.category || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
      totalExpense += Number(t.amount);
    }
  });

  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / totalExpense) * 100,
      trend: 'stable' as const
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Saúde financeira
  let financialHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  if (savingsRate >= 30) financialHealth = 'excellent';
  else if (savingsRate >= 20) financialHealth = 'good';
  else if (savingsRate >= 10) financialHealth = 'fair';

  return {
    averageIncome: avgIncome,
    averageExpense: avgExpense,
    savingsRate,
    topCategories,
    financialHealth,
    monthlyGrowth: 0
  };
}

function getDefaultProfile(): any {
  return {
    averageIncome: 0,
    averageExpense: 0,
    savingsRate: 0,
    topCategories: [],
    financialHealth: 'poor',
    monthlyGrowth: 0
  };
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

export default async function handler(req: Request) {
  const startTime = Date.now(); // Medir tempo de execução
  
  try {
    const { userId, message } = await req.json();
    
    // ✅ SEGURANÇA: Validar userId obrigatório
    if (!userId || !message) {
      return new Response(JSON.stringify({ 
        error: 'userId e message são obrigatórios.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ✅ ISOLAMENTO: Cada usuário tem sua própria chave de histórico
    const historyKey = `chat_history:${userId}`;
    console.log(`[${userId}] Processando mensagem: "${message.substring(0, 50)}..."`);

    // 1. Buscar contexto financeiro (APENAS do usuário logado)
    const contextStart = Date.now();
    const context = await buildFinancialContext(userId);
    console.log(`[${userId}] Contexto carregado em ${Date.now() - contextStart}ms`);

    // 2. Buscar histórico de conversa (APENAS do usuário logado)
    const historyStart = Date.now();
    const rawHistory = await redis.lrange(historyKey, 0, 9);
    const history = rawHistory.reverse().map((item: any) => {
      try {
        return JSON.parse(item);
      } catch {
        return { role: 'assistant', content: String(item) };
      }
    });
    console.log(`[${userId}] Histórico carregado em ${Date.now() - historyStart}ms`);

    // 3. Orquestrar - decidir qual agente usar
    const orchestratorStart = Date.now();
    const decision = await orchestrateAgents(message, context, history);
    console.log(`[${userId}] Orquestrador decidiu: ${decision.agent} em ${Date.now() - orchestratorStart}ms`);

    // 4. Executar agente apropriado
    const agentStart = Date.now();
    let response: any;
    
    switch (decision.agent) {
      case 'analyzer':
        response = await analyzerAgent(message, context);
        break;
      case 'predictor':
        response = await predictorAgent(message, context);
        break;
      case 'executor':
        response = await executorAgent(message, context);
        break;
      case 'insight':
        response = await insightAgent(context);
        break;
      case 'general':
      default:
        response = await generalAgent(message, context, history);
        break;
    }
    console.log(`[${userId}] Agente ${decision.agent} respondeu em ${Date.now() - agentStart}ms`);

    // 5. Atualizar histórico (ISOLADO por usuário)
    const userMsg = JSON.stringify({ role: 'user', content: message, timestamp: Date.now() });
    const assistantMsg = JSON.stringify({ 
      role: 'assistant', 
      content: response.content, 
      timestamp: Date.now(),
      metadata: {
        agent: decision.agent,
        confidence: response.confidence
      }
    });

    await redis.lpush(historyKey, userMsg);
    await redis.lpush(historyKey, assistantMsg);
    await redis.ltrim(historyKey, 0, 29); // Manter últimas 30 mensagens

    const totalTime = Date.now() - startTime;
    console.log(`[${userId}] Resposta completa em ${totalTime}ms`);

    // 6. Retornar resposta
    return new Response(JSON.stringify({ 
      response: response.content,
      metadata: {
        agent: decision.agent,
        confidence: response.confidence,
        toolsUsed: response.toolsUsed,
        suggestedActions: response.suggestedActions || [],
        executionTime: totalTime
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro fatal na API /api/chat:', error);
    return new Response(JSON.stringify({ 
      error: 'Ocorreu um erro ao processar sua mensagem.',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
