import { useState, useRef, useEffect } from 'react';
import { genai } from '@/lib/genai';
import { SummaryData, TransactionsData, CompletionData } from './Dashboard';
import { Loader2, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

interface FinancialAssistantChatProps {
  summaryData: SummaryData;
  completionData: CompletionData;
}

type Message = {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

export function FinancialAssistantChat({
  summaryData,
  completionData
}: FinancialAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      content: 'Olá! Sou seu assistente financeiro. Como posso ajudar você a entender melhor seus dados financeiros?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionsData, setTransactionsData] = useState<TransactionsData>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Verificar se o usuário está autenticado
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
        console.log(`Usuário autenticado: ${session.user.id}`);
      } else {
        console.error("Usuário não autenticado");
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive"
        });
      }
    };
    
    checkUser();
  }, []);

  // Buscar transações do Supabase filtrando pelo user_id
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!userId) {
        console.error('ID de usuário não disponível para buscar transações');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(200);

        if (error) {
          console.error('Erro ao buscar transações:', error);
          toast({
            title: "Erro ao carregar dados",
            description: "Não foi possível carregar suas transações.",
            variant: "destructive"
          });
        } else {
          setTransactionsData(data || []);
          console.log(`Carregadas ${data?.length || 0} transações para o usuário ID: ${userId}`);
          // Processar os dados imediatamente após carregá-los
          if (data && data.length > 0) {
            const processed = processTransactionsForAnalysis(data);
            setProcessedData(processed);
          }
        }
      } catch (e) {
        console.error('Exceção ao buscar transações:', e);
      }
    };

    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Processar transações para análise - Versão melhorada
  const processTransactionsForAnalysis = (transactions: TransactionsData) => {
    if (!transactions || transactions.length === 0) {
      return {
        categorySummary: {},
        monthlySpending: {},
        recentTransactions: []
      };
    }

    // Agrupar transações por categoria
    const categorySummary = transactions.reduce((acc, transaction) => {
      const category = transaction.category || 'Sem categoria';
      if (!acc[category]) {
        acc[category] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }
      acc[category].total += transaction.amount;
      acc[category].count += 1;
      acc[category].transactions.push({
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date
      });
      return acc;
    }, {} as Record<string, { total: number; count: number; transactions: any[] }>);

    // Obter últimos 12 meses para análise mais completa
    const today = new Date();
    const monthsData: Record<string, { 
      total: number, 
      income: number, 
      expenses: number,
      transactions: any[] 
    }> = {};
    
    // Inicializar dados para os últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(today);
      monthDate.setMonth(today.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      
      monthsData[monthKey] = { 
        total: 0, 
        income: 0, 
        expenses: 0, 
        transactions: [],
        monthName: monthName 
      };
    }

    // Processar transações e organizá-las por mês
    transactions.forEach(transaction => {
      const txDate = new Date(transaction.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Verificar se o mês está no nosso período de análise
      if (monthsData[monthKey]) {
        // Adicionar transação aos dados do mês
        monthsData[monthKey].transactions.push({
          id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category || 'Sem categoria',
          date: transaction.date
        });
        
        // Atualizar totais
        monthsData[monthKey].total += transaction.amount;
        
        // Separar receitas (valores positivos) e despesas (valores negativos)
        if (transaction.amount > 0) {
          monthsData[monthKey].income += transaction.amount;
        } else {
          monthsData[monthKey].expenses += Math.abs(transaction.amount);
        }
      }
    });

    // Calcular saldo de cada mês
    const balanceByMonth = Object.entries(monthsData).reduce((acc, [month, data]) => {
      acc[month] = {
        balance: data.income - data.expenses,
        income: data.income,
        expenses: data.expenses,
        monthName: data.monthName
      };
      return acc;
    }, {} as Record<string, { balance: number, income: number, expenses: number, monthName: string }>);

    // Dados gerais para análise rápida
    const quickStats = {
      totalTransactions: transactions.length,
      totalIncome: transactions.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0),
      totalExpenses: Math.abs(transactions.reduce((sum, tx) => sum + (tx.amount < 0 ? tx.amount : 0), 0)),
      topExpenseCategories: Object.entries(categorySummary)
        .filter(([_, data]) => data.total < 0)
        .sort((a, b) => a[1].total - b[1].total)
        .slice(0, 5)
        .map(([category, data]) => ({ 
          category, 
          total: Math.abs(data.total), 
          count: data.count 
        })),
      topIncomeCategories: Object.entries(categorySummary)
        .filter(([_, data]) => data.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([category, data]) => ({ 
          category, 
          total: data.total, 
          count: data.count 
        }))
    };

    return {
      categorySummary,
      monthlySpending: monthsData,
      balanceByMonth,
      quickStats,
      recentTransactions: transactions.slice(0, 10)
    };
  };

  // Determinar o tipo de consulta para ajustar a resposta
  const determineQueryType = (query: string): string => {
    query = query.toLowerCase().trim();
    
    // Checar se é uma saudação simples
    if (/^(oi|olá|e aí|bom dia|boa tarde|boa noite|hi|hello)$/i.test(query)) {
      return 'greeting';
    }
    
    // Checar se é uma consulta sobre um mês específico
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const hasMonth = months.some(month => query.includes(month));
    
    if (hasMonth) {
      return 'month_specific';
    }
    
    // Checar se é sobre uma categoria específica
    const categoryKeywords = ['categoria', 'gastei com', 'gasto em', 'despesa com'];
    if (categoryKeywords.some(keyword => query.includes(keyword))) {
      return 'category_specific';
    }
    
    // Checar se é uma solicitação de resumo
    if (query.includes('resumo') || query.includes('resumir') || query.includes('panorama')) {
      return 'summary';
    }
    
    // Checar se é sobre dicas ou sugestões
    if (query.includes('dica') || query.includes('sugestão') || query.includes('conselho') || query.includes('como posso')) {
      return 'advice';
    }
    
    // Caso padrão
    return 'general';
  };

  // Criar prompt adaptativo baseado no tipo de consulta
  const createAdaptivePrompt = (userQuery: string, queryType: string) => {
    if (!processedData) {
      return `Você é um assistente financeiro pessoal. O usuário perguntou: "${userQuery}", mas não temos dados financeiros disponíveis para análise. Por favor, peça ao usuário para cadastrar suas transações financeiras primeiro.`;
    }
    
    // Prompt base para todos os tipos de consulta
    let basePrompt = `Você é um assistente financeiro pessoal para o usuário ${userId}.`;
    
    // Ajuste do prompt de acordo com o tipo de consulta
    switch (queryType) {
      case 'greeting':
        return `${basePrompt} O usuário apenas enviou uma saudação: "${userQuery}". Responda de forma amigável e sucinta, sem fornecer detalhes financeiros específicos. Apenas diga olá e pergunte como você pode ajudar com informações financeiras.`;
        
      case 'month_specific':
        return `${basePrompt}
          O usuário está perguntando sobre um mês específico: "${userQuery}".
          
          Dados financeiros por mês:
          ${JSON.stringify(processedData.balanceByMonth, null, 2)}
          
          Por favor, identifique o mês mencionado na pergunta e forneça informações específicas sobre esse período.
          Responda de forma sucinta, com no máximo 2 parágrafos, destacando:
          - Total de despesas do mês
          - Total de receitas do mês
          - Saldo final do mês
          - Principais categorias de despesa, se relevante para a pergunta
        `;
        
      case 'category_specific':
        return `${basePrompt}
          O usuário está perguntando sobre uma categoria específica: "${userQuery}".
          
          Dados por categoria:
          ${JSON.stringify(processedData.categorySummary, null, 2)}
          
          Por favor, identifique a categoria mencionada na pergunta e forneça informações específicas.
          Responda em um único parágrafo, destacando o total gasto na categoria e quando ocorreram os principais gastos.
        `;
        
      case 'summary':
        return `${basePrompt}
          O usuário está pedindo um resumo financeiro: "${userQuery}".
          
          Dados gerais:
          ${JSON.stringify(processedData.quickStats, null, 2)}
          
          Principais gastos por mês:
          ${JSON.stringify(Object.entries(processedData.balanceByMonth).slice(0, 3), null, 2)}
          
          Forneça um resumo conciso em até 3 parágrafos, destacando:
          - Rendimentos e despesas recentes
          - Principais categorias de gastos
          - Tendências observadas nos últimos meses
        `;
        
      case 'advice':
        return `${basePrompt}
          O usuário está pedindo conselhos financeiros: "${userQuery}".
          
          Dados gerais:
          ${JSON.stringify(processedData.quickStats, null, 2)}
          
          Dados de metas:
          ${JSON.stringify(completionData, null, 2)}
          
          Forneça no máximo 3 sugestões práticas e personalizadas baseadas nos dados financeiros do usuário.
          Seja específico e evite conselhos genéricos. Limite sua resposta a 3 parágrafos curtos.
        `;
        
      default:
        // Para consultas gerais, forneça um prompt mais completo mas específico
        return `${basePrompt}
          O usuário perguntou: "${userQuery}".
          
          ### DADOS FINANCEIROS RELEVANTES
          
          # Resumo rápido
          ${JSON.stringify(processedData.quickStats, null, 2)}
          
          # Dados por mês
          ${JSON.stringify(Object.entries(processedData.balanceByMonth).slice(0, 3), null, 2)}
          
          # Metas financeiras
          ${JSON.stringify(completionData, null, 2)}
          
          ### INSTRUÇÕES PARA RESPOSTA
          1. Responda APENAS o que foi perguntado, de forma direta.
          2. Limite sua resposta a 2-3 parágrafos curtos.
          3. Use dados específicos e números reais das informações acima.
          4. Mantenha um tom amigável, mas conciso.
          5. Se não tiver dados para responder com precisão, diga isso claramente em uma frase.
        `;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Verificar se temos um usuário autenticado
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Determinar o tipo de consulta
      const queryType = determineQueryType(input);
      
      // Criar prompt adaptativo baseado no tipo de consulta
      const adaptivePrompt = createAdaptivePrompt(input, queryType);
      
      // Obter resposta do modelo
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(adaptivePrompt);
      const response = await result.response;
      
      // Adicionar resposta do assistente
      const assistantMessage: Message = {
        content: response.text(),
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      
      let errorMessage: Message;
      if (error instanceof Error) {
        if (error.message === 'Usuário não autenticado') {
          errorMessage = {
            content: 'Você precisa estar logado para usar o assistente financeiro. Por favor, faça login e tente novamente.',
            role: 'assistant',
            timestamp: new Date()
          };
        } else if (!processedData) {
          errorMessage = {
            content: 'Não encontrei nenhuma transação financeira para analisar. Por favor, cadastre algumas transações primeiro.',
            role: 'assistant',
            timestamp: new Date()
          };
        } else {
          errorMessage = {
            content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            role: 'assistant',
            timestamp: new Date()
          };
        }
      } else {
        errorMessage = {
          content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
          role: 'assistant',
          timestamp: new Date()
        };
      }

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Bot className="mr-2 h-5 w-5 text-blue-600" />
          Assistente Financeiro
        </h2>
        {transactionsData && (
          <div className="text-sm text-gray-500">
            {transactionsData.length} transações carregadas
          </div>
        )}
      </div>

      <ScrollArea className="flex-grow mb-4 pr-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div 
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                }`}
              >
                <div className="mb-1 flex items-center">
                  {message.role === 'assistant' && (
                    <Avatar className="h-6 w-6 mr-2 bg-blue-100">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </Avatar>
                  )}
                  <span className="text-xs opacity-75">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="mt-auto">
        <div className="flex items-center space-x-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus dados financeiros..."
            disabled={isLoading}
            className="flex-grow"
          />
          <Button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
