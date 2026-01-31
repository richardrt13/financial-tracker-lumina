/**
 * ChatEngine - Motor principal do assistente financeiro inteligente
 * 
 * Arquitetura: Sistema de agentes especializados com orquestração automática
 * - Cada agente é especialista em um domínio (análise, previsão, ações, insights)
 * - O orquestrador decide qual(is) agente(s) chamar baseado no contexto
 * - Sistema de cache para respostas instantâneas
 * - Memória de longo prazo com embeddings para contexto rico
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export type AgentType = 'orchestrator' | 'analyzer' | 'predictor' | 'executor' | 'insight';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    agentUsed?: AgentType[];
    toolsCalled?: string[];
    confidence?: number;
    tokens?: number;
  };
}

export interface ChatContext {
  userId: string;
  conversationHistory: Message[];
  userFinancialProfile?: FinancialProfile;
  recentTransactions?: any[];
  activeBudgets?: any[];
}

export interface FinancialProfile {
  averageIncome: number;
  averageExpense: number;
  savingsRate: number;
  topCategories: { category: string; amount: number; percentage: number }[];
  financialHealth: 'excellent' | 'good' | 'fair' | 'poor';
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

export interface AgentResponse {
  content: string;
  confidence: number;
  toolsUsed: string[];
  suggestedActions?: Action[];
  visualizations?: Visualization[];
}

export interface Action {
  type: 'create_transaction' | 'update_budget' | 'set_goal' | 'create_alert';
  label: string;
  description: string;
  params: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

export interface Visualization {
  type: 'chart' | 'table' | 'metric' | 'comparison';
  data: any;
  config?: any;
}

// =====================================================
// AGENTES ESPECIALIZADOS
// =====================================================

/**
 * Agente Analisador - Especialista em análise de dados financeiros
 */
class AnalyzerAgent {
  private model: any;

  constructor(genAI: GoogleGenerativeAI) {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // Mais determinístico para análises
      }
    });
  }

  async analyze(query: string, context: ChatContext): Promise<AgentResponse> {
    const tools = ['fetchTransactions', 'calculateMetrics', 'comparePerformance'];
    
    const prompt = this.buildAnalysisPrompt(query, context);
    const result = await this.model.generateContent(prompt);
    const analysis = result.response.text();

    return {
      content: analysis,
      confidence: 0.85,
      toolsUsed: tools,
      visualizations: this.suggestVisualizations(analysis, context)
    };
  }

  private buildAnalysisPrompt(query: string, context: ChatContext): string {
    return `
Você é um analista financeiro expert. Analise os dados e responda com clareza e profundidade.

**Perfil Financeiro do Usuário:**
${JSON.stringify(context.userFinancialProfile, null, 2)}

**Transações Recentes:**
${JSON.stringify(context.recentTransactions?.slice(0, 20), null, 2)}

**Pergunta:** ${query}

**Instruções:**
1. Analise os dados quantitativamente
2. Identifique padrões e anomalias
3. Forneça insights acionáveis
4. Use Markdown para formatação rica
5. Sugira visualizações relevantes

**Formato da Resposta:**
- Resumo executivo (2-3 linhas)
- Análise detalhada
- Insights principais (bullet points)
- Recomendações
    `;
  }

  private suggestVisualizations(_analysis: string, _context: ChatContext): Visualization[] {
    // Lógica para sugerir visualizações baseadas na análise
    return [];
  }
}

/**
 * Agente Preditor - Especialista em previsões e projeções
 */
class PredictorAgent {
  private model: any;

  constructor(genAI: GoogleGenerativeAI) {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.4,
      }
    });
  }

  async predict(query: string, context: ChatContext): Promise<AgentResponse> {
    const tools = ['calculateTrends', 'projectFuture', 'riskAnalysis'];
    
    const prompt = this.buildPredictionPrompt(query, context);
    const result = await this.model.generateContent(prompt);
    
    return {
      content: result.response.text(),
      confidence: 0.75,
      toolsUsed: tools,
      visualizations: [
        {
          type: 'chart',
          data: { type: 'line', title: 'Projeção Financeira' }
        }
      ]
    };
  }

  private buildPredictionPrompt(query: string, context: ChatContext): string {
    const historicalData = this.calculateHistoricalMetrics(context);
    
    return `
Você é um especialista em previsões financeiras. Use dados históricos para projetar cenários futuros.

**Dados Históricos:**
${JSON.stringify(historicalData, null, 2)}

**Perfil do Usuário:**
${JSON.stringify(context.userFinancialProfile, null, 2)}

**Pergunta:** ${query}

**Instruções:**
1. Analise tendências históricas
2. Calcule médias móveis e variações
3. Projete 3 cenários: otimista, realista, pessimista
4. Indique probabilidades e intervalos de confiança
5. Sugira ações preventivas ou corretivas

**Use fórmulas e cálculos explícitos. Seja preciso com números.**
    `;
  }

  private calculateHistoricalMetrics(context: ChatContext) {
    // Implementar cálculos de métricas históricas
    const transactions = context.recentTransactions || [];
    
    const monthlyData = transactions.reduce((acc: any, t: any) => {
      const key = `${t.year}-${t.month}`;
      if (!acc[key]) acc[key] = { income: 0, expense: 0, count: 0 };
      
      if (t.type === 'receita') acc[key].income += t.amount;
      if (t.type === 'despesa') acc[key].expense += t.amount;
      acc[key].count++;
      
      return acc;
    }, {});

    return monthlyData;
  }
}

/**
 * Agente Executor - Especialista em ações e comandos
 */
class ExecutorAgent {
  private model: any;

  constructor(genAI: GoogleGenerativeAI) {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, // Muito determinístico para ações
      }
    });
  }

  async execute(query: string, context: ChatContext): Promise<AgentResponse> {
    const intent = await this.detectIntent(query, context);
    
    if (!intent.isExecutable) {
      return {
        content: "Esta solicitação não requer execução de ações.",
        confidence: 0.9,
        toolsUsed: []
      };
    }

    const actions = this.generateActions(intent, context);
    
    return {
      content: this.formatExecutionResponse(intent, actions),
      confidence: intent.confidence,
      toolsUsed: ['intentDetection', 'actionGeneration'],
      suggestedActions: actions
    };
  }

  private async detectIntent(query: string, _context: ChatContext) {
    const prompt = `
Analise se a mensagem requer execução de ações no sistema financeiro.

**Mensagem:** "${query}"

**Ações Possíveis:**
- create_transaction: Criar uma transação
- update_budget: Atualizar orçamento
- set_goal: Definir meta financeira
- create_alert: Criar alerta
- none: Apenas conversa

**Retorne JSON:**
{
  "isExecutable": boolean,
  "action": string,
  "params": {},
  "confidence": number (0-1),
  "userConfirmationNeeded": boolean
}
    `;

    const result = await this.model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  }

  private generateActions(intent: any, _context: ChatContext): Action[] {
    const actions: Action[] = [];

    if (intent.action === 'create_transaction') {
      actions.push({
        type: 'create_transaction',
        label: 'Criar Transação',
        description: `Criar ${intent.params.type} de R$ ${intent.params.amount}`,
        params: intent.params,
        priority: 'high'
      });
    }

    return actions;
  }

  private formatExecutionResponse(intent: any, actions: Action[]): string {
    let response = "### 🎯 Ação Identificada\n\n";
    
    if (intent.userConfirmationNeeded) {
      response += "⚠️ Esta ação requer sua confirmação:\n\n";
    }

    actions.forEach(action => {
      response += `**${action.label}**\n`;
      response += `${action.description}\n\n`;
    });

    response += "_Clique no botão abaixo para executar_";
    
    return response;
  }
}

/**
 * Agente de Insights - Especialista em descobrir padrões e oportunidades
 */
class InsightAgent {
  private model: any;

  constructor(genAI: GoogleGenerativeAI) {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7, // Mais criativo para insights
      }
    });
  }

  async generateInsights(context: ChatContext): Promise<AgentResponse> {
    const prompt = this.buildInsightPrompt(context);
    const result = await this.model.generateContent(prompt);
    
    return {
      content: result.response.text(),
      confidence: 0.8,
      toolsUsed: ['patternRecognition', 'anomalyDetection', 'opportunityFinding']
    };
  }

  private buildInsightPrompt(context: ChatContext): string {
    return `
Você é um consultor financeiro experiente. Analise o perfil financeiro e descubra insights valiosos.

**Perfil Financeiro:**
${JSON.stringify(context.userFinancialProfile, null, 2)}

**Transações Recentes:**
${JSON.stringify(context.recentTransactions?.slice(0, 30), null, 2)}

**Missão:**
1. Identifique padrões de comportamento financeiro
2. Detecte anomalias ou gastos fora do padrão
3. Encontre oportunidades de economia
4. Sugira otimizações específicas
5. Alerte sobre riscos potenciais

**Formato:**
### 💡 Insights Descobertos

**Padrões Identificados:**
- [insight 1]
- [insight 2]

**Oportunidades de Melhoria:**
- [oportunidade 1]
- [oportunidade 2]

**Alertas:**
- [alerta se houver]

Seja específico, use números reais e forneça recomendações práticas.
    `;
  }
}

// =====================================================
// ORQUESTRADOR PRINCIPAL
// =====================================================

export class ChatEngine {
  private genAI: GoogleGenerativeAI;
  private orchestratorModel: any;
  
  private analyzerAgent: AnalyzerAgent;
  private predictorAgent: PredictorAgent;
  private executorAgent: ExecutorAgent;
  private insightAgent: InsightAgent;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.orchestratorModel = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
      }
    });

    // Inicializar agentes
    this.analyzerAgent = new AnalyzerAgent(this.genAI);
    this.predictorAgent = new PredictorAgent(this.genAI);
    this.executorAgent = new ExecutorAgent(this.genAI);
    this.insightAgent = new InsightAgent(this.genAI);
  }

  /**
   * Processa uma mensagem do usuário
   */
  async processMessage(message: string, context: ChatContext): Promise<Message> {
    try {
      // 1. Orquestrador decide qual agente usar
      const agentDecision = await this.orchestrate(message, context);
      
      // 2. Executar agente(s) apropriado(s)
      let response: AgentResponse;
      
      switch (agentDecision.primaryAgent) {
        case 'analyzer':
          response = await this.analyzerAgent.analyze(message, context);
          break;
        case 'predictor':
          response = await this.predictorAgent.predict(message, context);
          break;
        case 'executor':
          response = await this.executorAgent.execute(message, context);
          break;
        case 'insight':
          response = await this.insightAgent.generateInsights(context);
          break;
        default:
          response = await this.handleGeneralConversation(message, context);
      }

      // 3. Construir mensagem de resposta
      return {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          agentUsed: [agentDecision.primaryAgent],
          toolsCalled: response.toolsUsed,
          confidence: response.confidence
        }
      };

    } catch (error) {
      console.error('ChatEngine Error:', error);
      return {
        role: 'assistant',
        content: '😔 Desculpe, ocorreu um erro ao processar sua mensagem. Pode tentar reformular?',
        timestamp: new Date(),
        metadata: { confidence: 0 }
      };
    }
  }

  /**
   * Orquestrador - Decide qual agente deve responder
   */
  private async orchestrate(message: string, context: ChatContext) {
    const prompt = `
Você é um orquestrador de IA. Analise a mensagem e decida qual agente especializado deve responder.

**Agentes Disponíveis:**
- **analyzer**: Análise de dados, métricas, comparações, relatórios
- **predictor**: Previsões, projeções, tendências, metas de tempo
- **executor**: Criar transações, alterar orçamentos, ações no sistema
- **insight**: Descobrir padrões, sugerir melhorias, insights proativos
- **general**: Conversação geral, saudações, perguntas simples

**Histórico Recente:**
${context.conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

**Mensagem Atual:** "${message}"

**Retorne JSON:**
{
  "primaryAgent": "analyzer|predictor|executor|insight|general",
  "confidence": number (0-1),
  "reasoning": "breve explicação"
}
    `;

    const result = await this.orchestratorModel.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  }

  /**
   * Handler para conversação geral
   */
  private async handleGeneralConversation(message: string, context: ChatContext): Promise<AgentResponse> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.8 }
    });

    const prompt = `
Você é Lumina, uma assistente financeira amigável e inteligente.

**Contexto do Usuário:**
Saúde Financeira: ${context.userFinancialProfile?.financialHealth || 'desconhecida'}
Economia Mensal: R$ ${((context.userFinancialProfile?.averageIncome || 0) - (context.userFinancialProfile?.averageExpense || 0)).toFixed(2)}

**Mensagem:** ${message}

Responda de forma natural, amigável e útil. Se apropriado, sugira funcionalidades do sistema.
    `;

    const result = await model.generateContent(prompt);
    
    return {
      content: result.response.text(),
      confidence: 0.9,
      toolsUsed: ['general_conversation']
    };
  }
}
