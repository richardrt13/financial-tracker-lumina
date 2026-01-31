import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '../src/lib/supabase-admin';
import { generateText } from './ai-adapter-edge';

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

// --- CONFIGURAÇÃO DOS CLIENTES ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// =====================================================
// SISTEMA DE AGENTES ESPECIALIZADOS
// =====================================================

/**
 * Agente Analisador - Análises quantitativas de dados financeiros
 */
async function analyzerAgent(query: string, context: any): Promise<any> {
  // Detectar se é pergunta simples ou análise detalhada
  const isSimpleQuery = /^(quanto|qual|quais|quantos)\s+(gastei|ganhei|tenho|foi)/i.test(query.trim());
  
  const prompt = `
Você é Spendly, assistente financeiro. Responda de forma ${isSimpleQuery ? 'DIRETA e OBJETIVA' : 'detalhada e profissional'}.

**Dados do Mês Atual (${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):**
- Receitas: R$ ${context.profile.averageIncome.toFixed(2)}
- Despesas: R$ ${context.profile.averageExpense.toFixed(2)}
- Saldo: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}
- Taxa de Economia: ${context.profile.savingsRate.toFixed(1)}%
- Saúde Financeira: ${context.profile.financialHealth}

**Top 3 Categorias de Gasto Este Mês:**
${context.profile.topCategories.slice(0, 3).map((c: any) => `- ${c.category}: R$ ${c.amount.toFixed(2)}`).join('\n')}

**Últimas 10 Transações:**
${context.recentTransactions.slice(0, 10).map((t: any) => 
  `- ${t.amount > 0 ? '+' : ''}R$ ${t.amount.toFixed(2)} (${t.category}) - ${new Date(t.date || t.created_at).toLocaleDateString('pt-BR')}`
).join('\n')}

**Pergunta:** ${query}

**IMPORTANTE:** 
${isSimpleQuery 
  ? '⚡ Responda em 2-3 LINHAS, direto ao ponto. Use no máximo 1 emoji. Foque em números concretos. Exemplo: "Você gastou R$ 1.234,50 este mês. As maiores despesas foram Alimentação (R$ 450) e Transporte (R$ 300)."'
  : '📊 Forneça análise completa com insights e recomendações práticas. Seja profissional e objetivo.'
}

Responda em português brasileiro com emojis apropriados.
  `;

  const response = await generateText(prompt, 'simple', 0.3, 500);

  return {
    content: response.content,
    confidence: 0.85,
    toolsUsed: ['data_analysis', isSimpleQuery ? 'quick_answer' : 'trend_detection']
  };
}

/**
 * Agente Preditor - Projeções e previsões financeiras
 */
async function predictorAgent(query: string, context: any): Promise<any> {
  // Calcular histórico mensal
  const monthlyData = calculateMonthlyHistory(context.recentTransactions);

  const prompt = `
Você é Spendly, especialista em projeções financeiras. Seja DIRETO e PRÁTICO.

**Dados do Mês Atual:**
- Receitas: R$ ${context.profile.averageIncome.toFixed(2)}
- Despesas: R$ ${context.profile.averageExpense.toFixed(2)}
- Economia Este Mês: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}

**Pergunta:** ${query}

**REGRAS:**
1. ⚡ Responda em 4-5 linhas no máximo
2. 📊 Use a economia do mês atual para cálculos
3. 🎯 Forneça tempo estimado e valor
4. ⚠️ Mencione riscos se relevante

**Exemplo de resposta boa:**
"Com sua economia atual de R$ 1.200/mês, você juntará R$ 10.000 em cerca de 8-9 meses. Se aumentar a economia em 20%, pode chegar lá em 7 meses. 🎯"

Responda em português brasileiro.
  `;

  const response = await generateText(prompt, 'simple', 0.4, 400);
  return {
    content: response.content,
    confidence: 0.75,
    toolsUsed: ['forecasting']
  };
}

/**
 * Agente Executor - Detecção de intenções e ações
 */
async function executorAgent(query: string, context: any): Promise<any> {
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

  const response = await generateText(prompt, 'simple', 0.1, 500);
  const intentJson = response.content.replace(/```json|```/g, '').trim();
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
  const prompt = `
Você é Spendly, consultor financeiro. Descubra insights PRÁTICOS e ACIONÁVEIS.

**Perfil Financeiro (Mês Atual):**
- Receitas: R$ ${context.profile.averageIncome.toFixed(2)}
- Despesas: R$ ${context.profile.averageExpense.toFixed(2)}
- Saldo: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}
- Saúde: ${context.profile.financialHealth}

**Top 5 Categorias Este Mês:**
${context.profile.topCategories.slice(0, 5).map((c: any) => 
  `- ${c.category}: R$ ${c.amount.toFixed(2)}`
).join('\n')}

**Últimas 20 Transações:**
${context.recentTransactions.slice(0, 20).map((t: any) => 
  `R$ ${t.amount.toFixed(2)} - ${t.category} (${new Date(t.date || t.created_at).toLocaleDateString('pt-BR')})`
).join('\n')}

**REGRAS:**
1. ⚡ Máximo 5-6 linhas
2. 💡 Foque em 2-3 insights PRÁTICOS do MÊS ATUAL
3. 💰 Quantifique economia potencial
4. 🎯 Sugira ações específicas

**Exemplo bom:**
"💡 Você gastou R$ 450 em Alimentação este mês. Reduzindo 20% (cozinhando mais em casa), economizaria R$ 90/mês. Também notei 3 assinaturas pequenas (R$ 50 total) que podem ser canceladas. 🎯"

Responda em português brasileiro.
  `;

  const response = await generateText(prompt, 'simple', 0.7, 400);
  return {
    content: response.content,
    confidence: 0.8,
    toolsUsed: ['pattern_recognition', 'opportunity_finding']
  };
}

/**
 * Agente de Conversação Geral
 */
async function generalAgent(query: string, context: any, history: any[]): Promise<any> {
  const healthEmoji = {
    'excellent': '🌟',
    'good': '✅',
    'fair': '⚠️',
    'poor': '🔴'
  };

  const prompt = `
Você é **Spendly**, um assistente financeiro profissional e objetivo.

**Contexto do Usuário (Mês Atual):**
- Saldo: R$ ${(context.profile.averageIncome - context.profile.averageExpense).toFixed(2)}
- Saúde Financeira: ${context.profile.financialHealth}

**Conversa Recente:**
${history.slice(-2).map((m: any) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content.substring(0, 80)}`).join('\n')}

**Mensagem:** ${query}

**REGRAS:**
1. Seja BREVE e DIRETO - máximo 3 linhas
2. Use tom profissional e claro
3. Use NO MÁXIMO 1 emoji por resposta, apenas se essencial
4. Sugira ações específicas quando apropriado
5. NÃO faça análises longas (isso é trabalho do analyzer)

**Exemplos de respostas adequadas:**
- "Quanto gastei este mês?"
- "Quais minhas maiores despesas?"
- "Em quanto tempo junto R$ 10.000?"

Responda em português brasileiro.
  `;

  const response = await generateText(prompt, 'simple', 0.8, 300);
  return {
    content: response.content,
    confidence: 0.9,
    toolsUsed: ['general_conversation']
  };
}

// =====================================================
// ORQUESTRADOR PRINCIPAL
// =====================================================

async function orchestrateAgents(message: string, context: any, history: any[]): Promise<any> {
  try {
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

    const response = await generateText(prompt, 'simple', 0.2, 300);
    let responseText = response.content;
    
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
    // ✅ Calcular intervalo do mês atual (IGUAL AO TELEGRAM)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // ✅ Buscar transações do MÊS ATUAL usando campo 'date' (IGUAL AO TELEGRAM)
    const { data: currentMonthTxs, error: currentError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, type, category, date, created_at')
      .eq('user_id', userId) // 🔒 ISOLAMENTO
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false });

    if (currentError) {
      console.error('Erro ao buscar transações do mês:', currentError);
      throw currentError;
    }

    // ✅ Buscar transações dos últimos 3 meses para histórico
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsDate = threeMonthsAgo.toISOString().split('T')[0];

    const { data: historicalTxs, error: histError } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, date')
      .eq('user_id', userId)
      .gte('date', threeMonthsDate)
      .order('date', { ascending: false });

    if (histError) {
      console.error('Erro ao buscar histórico:', histError);
    }

    // Verificar se há dados do mês atual
    if (!currentMonthTxs || currentMonthTxs.length === 0) {
      console.log(`Usuário ${userId} não tem transações este mês`);
      return {
        profile: getDefaultProfile(),
        recentTransactions: [],
        currentMonth: { income: 0, expense: 0 }
      };
    }

    // Calcular perfil baseado no mês atual E histórico
    const profile = calculateFinancialProfile(currentMonthTxs, historicalTxs || []);

    console.log(`Contexto: ${currentMonthTxs.length} txs este mês para usuário ${userId}`);

    return {
      profile,
      recentTransactions: currentMonthTxs.slice(0, 20), // Últimas 20 do mês
      currentMonth: {
        income: currentMonthTxs.filter(t => t.type === 'receita').reduce((sum, t) => sum + Number(t.amount), 0),
        expense: currentMonthTxs.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Number(t.amount), 0)
      }
    };
  } catch (error) {
    console.error('Error building context:', error);
    return {
      profile: getDefaultProfile(),
      recentTransactions: [],
      currentMonth: { income: 0, expense: 0 }
    };
  }
}

function calculateFinancialProfile(currentMonthTxs: any[], historicalTxs: any[]): any {
  if (currentMonthTxs.length === 0) return getDefaultProfile();

  // ✅ CALCULAR MÊS ATUAL (igual ao Telegram)
  const currentIncome = currentMonthTxs.filter(t => t.type === 'receita').reduce((sum, t) => sum + Number(t.amount), 0);
  const currentExpense = currentMonthTxs.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Calcular média dos últimos 3 meses (para contexto adicional)
  const monthlyData: Record<string, { income: number; expense: number }> = {};
  historicalTxs.forEach(t => {
    const key = `${new Date(t.date).getFullYear()}-${new Date(t.date).getMonth()}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (t.type === 'receita') monthlyData[key].income += Number(t.amount);
    else if (t.type === 'despesa') monthlyData[key].expense += Number(t.amount);
  });

  const months = Object.values(monthlyData);
  const avgIncome = months.length > 0 ? months.reduce((sum, m) => sum + m.income, 0) / months.length : currentIncome;
  const avgExpense = months.length > 0 ? months.reduce((sum, m) => sum + m.expense, 0) / months.length : currentExpense;
  
  // ✅ USAR MÊS ATUAL para savings rate (não média)
  const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpense) / currentIncome) * 100 : 0;

  // ✅ Top categorias DO MÊS ATUAL (igual ao Telegram)
  const categoryTotals: Record<string, number> = {};
  let totalExpense = 0;
  currentMonthTxs.forEach(t => {
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
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      trend: 'stable' as const
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Saúde financeira baseada no mês atual
  let financialHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
  if (savingsRate >= 30) financialHealth = 'excellent';
  else if (savingsRate >= 20) financialHealth = 'good';
  else if (savingsRate >= 10) financialHealth = 'fair';

  return {
    // ✅ Retornar valores do MÊS ATUAL (não média) - igual ao Telegram
    averageIncome: currentIncome,
    averageExpense: currentExpense,
    savingsRate,
    topCategories,
    financialHealth,
    monthlyGrowth: 0,
    // Contexto adicional para previsões
    historicalAvgIncome: avgIncome,
    historicalAvgExpense: avgExpense
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
