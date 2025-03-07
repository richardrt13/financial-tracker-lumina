import { useState, useRef, useEffect } from 'react';
import { genai } from '@/lib/genai';
import { supabase } from '@/lib/supabase';
import { Loader2, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';

type Transaction = {
  id: number;
  year: string;
  month: string;
  type: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
  user_id: string;
  is_completed: boolean;
  completed_at?: string;
  due_day?: number;
};

type Message = {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

type FinancialData = {
  transactions: Transaction[];
  categorySummary: Record<string, { count: number; total: number }>;
  typeSummary: Record<string, { count: number; total: number }>;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  completionRate: number;
};

export function FinancialAssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      content: 'Olá! Sou seu assistente financeiro. Como posso ajudar você a entender melhor seus dados financeiros?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar dados financeiros ao inicializar o componente
  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Função para buscar dados financeiros do Supabase
  const fetchFinancialData = async () => {
    setIsDataLoading(true);
    try {
      // Obter sessão do usuário atual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('Nenhuma sessão de usuário encontrada');
        setIsDataLoading(false);
        return;
      }
      
      const userId = session.user.id;
      
      // Buscar todas as transações do usuário
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Erro ao buscar transações:', error);
        setIsDataLoading(false);
        return;
      }
      
      if (!transactions || transactions.length === 0) {
        console.log('Nenhuma transação encontrada');
        setIsDataLoading(false);
        return;
      }
      
      // Processar os dados das transações
      const typedTransactions = transactions as Transaction[];
      
      // Calcular resumos por categoria
      const categorySummary: Record<string, { count: number; total: number }> = {};
      const typeSummary: Record<string, { count: number; total: number }> = {};
      
      let totalIncome = 0;
      let totalExpense = 0;
      let completedCount = 0;
      
      typedTransactions.forEach(transaction => {
        // Resumo por categoria
        if (!categorySummary[transaction.category]) {
          categorySummary[transaction.category] = { count: 0, total: 0 };
        }
        categorySummary[transaction.category].count += 1;
        categorySummary[transaction.category].total += transaction.amount;
        
        // Resumo por tipo (receita/despesa)
        if (!typeSummary[transaction.type]) {
          typeSummary[transaction.type] = { count: 0, total: 0 };
        }
        typeSummary[transaction.type].count += 1;
        typeSummary[transaction.type].total += transaction.amount;
        
        // Calcular totais
        if (transaction.type === 'income') {
          totalIncome += transaction.amount;
        } else if (transaction.type === 'expense') {
          totalExpense += transaction.amount;
        }
        
        // Contar transações concluídas
        if (transaction.is_completed) {
          completedCount += 1;
        }
      });
      
      // Calcular saldo líquido e taxa de conclusão
      const netBalance = totalIncome - totalExpense;
      const completionRate = (completedCount / typedTransactions.length) * 100;
      
      // Definir os dados financeiros processados
      setFinancialData({
        transactions: typedTransactions,
        categorySummary,
        typeSummary,
        totalIncome,
        totalExpense,
        netBalance,
        completionRate
      });
      
    } catch (error) {
      console.error('Erro ao processar dados financeiros:', error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isDataLoading || !financialData) return;

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
      // Preparar análises adicionais para o prompt
      const monthlyData: Record<string, Record<string, any>> = {};
      const yearlyData: Record<string, any> = {};
      
      // Agrupar transações por ano e mês
      financialData.transactions.forEach(transaction => {
        const { year, month } = transaction;
        
        // Inicializar estruturas de dados se não existirem
        if (!monthlyData[year]) {
          monthlyData[year] = {};
        }
        
        if (!monthlyData[year][month]) {
          monthlyData[year][month] = {
            income: 0,
            expense: 0,
            net: 0,
            categories: {},
            transactionCount: 0,
            completedCount: 0
          };
        }
        
        if (!yearlyData[year]) {
          yearlyData[year] = {
            income: 0,
            expense: 0,
            net: 0,
            categories: {},
            transactionCount: 0,
            completedCount: 0
          };
        }
        
        // Atualizar dados mensais
        const monthData = monthlyData[year][month];
        if (transaction.type === 'income') {
          monthData.income += transaction.amount;
        } else if (transaction.type === 'expense') {
          monthData.expense += transaction.amount;
        }
        
        // Atualizar categorias mensais
        if (!monthData.categories[transaction.category]) {
          monthData.categories[transaction.category] = 0;
        }
        monthData.categories[transaction.category] += transaction.amount;
        
        // Atualizar contadores mensais
        monthData.transactionCount += 1;
        if (transaction.is_completed) {
          monthData.completedCount += 1;
        }
        
        // Recalcular saldo líquido mensal
        monthData.net = monthData.income - monthData.expense;
        
        // Atualizar dados anuais da mesma forma
        const yearData = yearlyData[year];
        if (transaction.type === 'income') {
          yearData.income += transaction.amount;
        } else if (transaction.type === 'expense') {
          yearData.expense += transaction.amount;
        }
        
        // Atualizar categorias anuais
        if (!yearData.categories[transaction.category]) {
          yearData.categories[transaction.category] = 0;
        }
        yearData.categories[transaction.category] += transaction.amount;
        
        // Atualizar contadores anuais
        yearData.transactionCount += 1;
        if (transaction.is_completed) {
          yearData.completedCount += 1;
        }
        
        // Recalcular saldo líquido anual
        yearData.net = yearData.income - yearData.expense;
      });
      
      // Calcular tendências e padrões
      const trends = analyzeTrends(monthlyData);
      
      // Criar contexto financeiro completo
      const financialContext = {
        overview: {
          totalIncome: financialData.totalIncome,
          totalExpense: financialData.totalExpense,
          netBalance: financialData.netBalance,
          completionRate: financialData.completionRate,
          categorySummary: financialData.categorySummary,
          typeSummary: financialData.typeSummary
        },
        monthlyData,
        yearlyData,
        trends,
        recentTransactions: financialData.transactions.slice(0, 10) // Primeiras 10 transações para referência
      };

      // Histórico de mensagens para contexto
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));

      // Criar o prompt melhorado
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal especializado em análise de dados. Você tem acesso ao histórico financeiro completo do usuário:
      
      Contexto financeiro detalhado: ${JSON.stringify(financialContext, null, 2)}
      
      Conversa anterior:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Pergunta atual do usuário: ${input}
      
      Instruções importantes para cálculos e análises precisos:
      1. Use todos os dados disponíveis em sua análise, considerando todo o histórico
      2. Quando fizer cálculos numéricos, mostre detalhadamente como chegou ao resultado
      3. Sempre verifique se os valores estão na mesma unidade antes de somá-los ou compará-los
      4. Para médias e tendências, considere todo o histórico disponível, destacando padrões recorrentes
      5. Quando calcular percentagens, mostre os valores base utilizados
      6. Ao analisar tendências, considere dados de múltiplos anos e meses para identificar sazonalidades
      7. Ofereça insights sobre mudanças no comportamento financeiro ao longo do tempo
      8. Verifique duplamente todos os cálculos matemáticos antes de apresentar conclusões
      9. Identifique oportunidades de economia ou otimização financeira
      10. Considere o contexto temporal (mês e ano) ao fazer comparações entre períodos
      
      Responda de forma concisa, amigável e direta. Se o usuário pedir insights ou análises, foque nas informações mais relevantes baseadas nos dados apresentados. Ofereça dicas práticas ou sugestões baseadas no comportamento financeiro observado ao longo de todo o histórico.
      `;
      
      const result = await model.generateContent(prompt);
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
      
      const errorMessage: Message = {
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Foca no input após resposta
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Função para analisar tendências nos dados
  const analyzeTrends = (monthlyData: Record<string, Record<string, any>>) => {
    const trends = {
      incomeGrowth: {} as Record<string, number>,
      expenseGrowth: {} as Record<string, number>,
      topCategories: {} as Record<string, string[]>,
      seasonalPatterns: {} as Record<string, any>
    };
    
    // Analisar crescimento de receita e despesa
    Object.keys(monthlyData).forEach(year => {
      const monthsData = monthlyData[year];
      const sortedMonths = Object.keys(monthsData).sort();
      
      if (sortedMonths.length > 1) {
        // Calcular crescimento para cada mês em relação ao anterior
        for (let i = 1; i < sortedMonths.length; i++) {
          const currentMonth = sortedMonths[i];
          const previousMonth = sortedMonths[i-1];
          
          const currentData = monthsData[currentMonth];
          const previousData = monthsData[previousMonth];
          
          const key = `${year}-${currentMonth}`;
          
          // Crescimento da receita
          if (previousData.income > 0) {
            trends.incomeGrowth[key] = ((currentData.income - previousData.income) / previousData.income) * 100;
          } else {
            trends.incomeGrowth[key] = currentData.income > 0 ? 100 : 0;
          }
          
          // Crescimento da despesa
          if (previousData.expense > 0) {
            trends.expomeGrowth[key] = ((currentData.expense - previousData.expense) / previousData.expense) * 100;
          } else {
            trends.expenseGrowth[key] = currentData.expense > 0 ? 100 : 0;
          }
        }
      }
      
      // Identificar top categorias por mês
      Object.keys(monthsData).forEach(month => {
        const monthData = monthsData[month];
        const categories = Object.entries(monthData.categories || {})
          .sort((a, b) => b[1] - a[1])
          .map(entry => entry[0])
          .slice(0, 3); // Top 3 categorias
          
        trends.topCategories[`${year}-${month}`] = categories;
      });
    });
    
    // Identificar padrões sazonais (ao longo dos anos)
    const monthlyAverages: Record<string, { income: number[], expense: number[] }> = {};
    
    // Inicializar estrutura para cada mês
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach(month => {
      monthlyAverages[month] = { income: [], expense: [] };
    });
    
    // Agrupar dados por mês através dos anos
    Object.keys(monthlyData).forEach(year => {
      Object.keys(monthlyData[year]).forEach(month => {
        const data = monthlyData[year][month];
        monthlyAverages[month].income.push(data.income);
        monthlyAverages[month].expense.push(data.expense);
      });
    });
    
    // Calcular médias mensais
    Object.keys(monthlyAverages).forEach(month => {
      const incomeValues = monthlyAverages[month].income;
      const expenseValues = monthlyAverages[month].expense;
      
      if (incomeValues.length > 0) {
        const avgIncome = incomeValues.reduce((sum, val) => sum + val, 0) / incomeValues.length;
        const avgExpense = expenseValues.reduce((sum, val) => sum + val, 0) / expenseValues.length;
        
        trends.seasonalPatterns[month] = {
          averageIncome: avgIncome,
          averageExpense: avgExpense,
          averageNet: avgIncome - avgExpense
        };
      }
    });
    
    return trends;
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
        {isDataLoading ? (
          <span className="text-sm text-blue-500 flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Carregando dados financeiros...
          </span>
        ) : financialData ? (
          <span className="text-sm text-gray-500">
            {financialData.transactions.length} transações analisadas
          </span>
        ) : (
          <span className="text-sm text-orange-500">
            Nenhum dado financeiro encontrado
          </span>
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
            disabled={isLoading || isDataLoading || !financialData}
            className="flex-grow"
          />
          <Button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || isDataLoading || !financialData}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {isDataLoading ? (
          <p className="text-xs text-blue-500 mt-2">
            Carregando seus dados financeiros, por favor aguarde...
          </p>
        ) : !financialData ? (
          <p className="text-xs text-orange-500 mt-2">
            Não foi possível carregar seus dados financeiros. Verifique se você tem transações registradas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
