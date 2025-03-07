import { useState, useRef, useEffect, useMemo } from 'react';
import { genai } from '@/lib/genai';
import { SummaryData, TransactionsData, CompletionData } from './Dashboard';
import { Loader2, Send, Bot, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';

interface FinancialAssistantChatProps {
  selectedYear: string;
  selectedMonth: string;
  summaryData: SummaryData;
  transactionsData: TransactionsData;
  completionData: CompletionData;
}

type Message = {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

// Tipo para armazenar dados pré-calculados
type PreCalculatedData = {
  byPeriod: Record<string, {
    totalExpenses: number;
    totalIncome: number;
    totalInvestments: number;
    expensesByCategory: Record<string, number>;
    incomesByCategory: Record<string, number>;
    investmentsByCategory: Record<string, number>;
    biggestExpense: { category: string; amount: number } | null;
    pendingTransactions: number;
    completedTransactions: number;
    upcomingDueDates: Array<{ category: string; amount: number; due_day: number }>;
    balance: number;
  }>;
  allTime: {
    totalExpenses: number;
    totalIncome: number;
    totalInvestments: number;
    expensesByCategory: Record<string, number>;
    incomesByCategory: Record<string, number>;
    investmentsByCategory: Record<string, number>;
    biggestExpense: { category: string; amount: number } | null;
    pendingTransactions: number;
    completedTransactions: number;
    upcomingDueDates: Array<{ category: string; amount: number; due_day: number }>;
    balance: number;
  };
  periods: string[]; // lista de períodos disponíveis no formato "MM/YYYY"
};

export function FinancialAssistantChat({
  selectedYear,
  selectedMonth,
  summaryData,
  transactionsData,
  completionData
}: FinancialAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      content: 'Olá! Sou seu assistente financeiro. Como posso ajudar você a entender melhor seus dados financeiros? Você pode perguntar sobre qualquer período ou sobre seus dados gerais.',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pré-calcular dados financeiros para todos os períodos e para todos os dados
  const preCalculatedData = useMemo((): PreCalculatedData => {
    // Verificar se transactionsData é um objeto válido com arrays
    if (!transactionsData || typeof transactionsData !== 'object') {
      console.error("transactionsData não é um objeto válido", transactionsData);
      return {
        byPeriod: {},
        allTime: {
          totalExpenses: 0,
          totalIncome: 0,
          totalInvestments: 0,
          expensesByCategory: {},
          incomesByCategory: {},
          investmentsByCategory: {},
          biggestExpense: null,
          pendingTransactions: 0,
          completedTransactions: 0,
          upcomingDueDates: [],
          balance: 0
        },
        periods: []
      };
    }
    
    // Extrair todos os períodos únicos disponíveis nos dados
    const periods = new Set<string>();
    
    // Função para processar e adicionar períodos
    const addPeriods = (transactions: any[]) => {
      if (!Array.isArray(transactions)) return;
      transactions.forEach(t => {
        if (t.year && t.month) {
          periods.add(`${t.month}/${t.year}`);
        }
      });
    };
    
    // Adicionar todos os períodos de todos os tipos de transações
    addPeriods(transactionsData.receita || []);
    addPeriods(transactionsData.despesa || []);
    addPeriods(transactionsData.investimento || []);
    
    const periodsList = Array.from(periods);
    
    // Dados por período
    const byPeriod: Record<string, any> = {};
    
    // Dados agregados de todos os períodos
    const allTimeData = {
      totalExpenses: 0,
      totalIncome: 0,
      totalInvestments: 0,
      expensesByCategory: {} as Record<string, number>,
      incomesByCategory: {} as Record<string, number>,
      investmentsByCategory: {} as Record<string, number>,
      biggestExpense: { category: '', amount: 0 },
      pendingTransactions: 0,
      completedTransactions: 0,
      upcomingDueDates: [] as Array<{ category: string; amount: number; due_day: number }>,
      balance: 0
    };
    
    // Processar dados para cada período
    periodsList.forEach(period => {
      const [month, year] = period.split('/');
      
      // Filtrar transações para este período
      const filteredIncome = (transactionsData.receita || []).filter(t => 
        t.year === year && t.month === month
      );
      
      const filteredExpenses = (transactionsData.despesa || []).filter(t => 
        t.year === year && t.month === month
      );
      
      const filteredInvestments = (transactionsData.investimento || []).filter(t => 
        t.year === year && t.month === month
      );
      
      // Mapas para armazenar somas por categoria para este período
      const expensesByCategory: Record<string, number> = {};
      const incomesByCategory: Record<string, number> = {};
      const investmentsByCategory: Record<string, number> = {};
      
      // Totais para este período
      let totalExpenses = 0;
      let totalIncome = 0;
      let totalInvestments = 0;
      let biggestExpense = { category: '', amount: 0 };
      let pendingTransactions = 0;
      let completedTransactions = 0;
      
      // Transações com datas de vencimento próximas para este período
      const upcomingDueDates: Array<{ category: string; amount: number; due_day: number }> = [];
      
      // Processar despesas
      filteredExpenses.forEach(transaction => {
        const { category, amount, is_completed, due_day } = transaction;
        
        // Contar transações pendentes e completadas
        if (is_completed === true) {
          completedTransactions++;
          allTimeData.completedTransactions++;
        } else if (is_completed === false) {
          pendingTransactions++;
          allTimeData.pendingTransactions++;
        }
        
        totalExpenses += amount;
        allTimeData.totalExpenses += amount;
        
        expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
        allTimeData.expensesByCategory[category] = (allTimeData.expensesByCategory[category] || 0) + amount;
        
        // Verificar se é a maior despesa do período
        if (amount > biggestExpense.amount) {
          biggestExpense = { category, amount };
        }
        
        // Verificar se é a maior despesa de todos os tempos
        if (amount > allTimeData.biggestExpense.amount) {
          allTimeData.biggestExpense = { category, amount };
        }
        
        // Adicionar à lista de próximos vencimentos se tiver due_day
        if (due_day !== null && due_day !== undefined) {
          upcomingDueDates.push({ category, amount, due_day });
          allTimeData.upcomingDueDates.push({ category, amount, due_day });
        }
      });
      
      // Processar receitas
      filteredIncome.forEach(transaction => {
        const { category, amount, is_completed } = transaction;
        
        // Contar transações pendentes e completadas
        if (is_completed === true) {
          completedTransactions++;
          allTimeData.completedTransactions++;
        } else if (is_completed === false) {
          pendingTransactions++;
          allTimeData.pendingTransactions++;
        }
        
        totalIncome += amount;
        allTimeData.totalIncome += amount;
        
        incomesByCategory[category] = (incomesByCategory[category] || 0) + amount;
        allTimeData.incomesByCategory[category] = (allTimeData.incomesByCategory[category] || 0) + amount;
      });
      
      // Processar investimentos
      filteredInvestments.forEach(transaction => {
        const { category, amount, is_completed } = transaction;
        
        // Contar transações pendentes e completadas
        if (is_completed === true) {
          completedTransactions++;
          allTimeData.completedTransactions++;
        } else if (is_completed === false) {
          pendingTransactions++;
          allTimeData.pendingTransactions++;
        }
        
        totalInvestments += amount;
        allTimeData.totalInvestments += amount;
        
        investmentsByCategory[category] = (investmentsByCategory[category] || 0) + amount;
        allTimeData.investmentsByCategory[category] = (allTimeData.investmentsByCategory[category] || 0) + amount;
      });
      
      // Ordenar vencimentos por dia
      upcomingDueDates.sort((a, b) => a.due_day - b.due_day);
      
      // Calcular saldo para este período
      const balance = totalIncome - totalExpenses - totalInvestments;
      
      // Armazenar dados deste período
      byPeriod[period] = {
        totalExpenses,
        totalIncome,
        totalInvestments,
        expensesByCategory,
        incomesByCategory,
        investmentsByCategory,
        biggestExpense: biggestExpense.amount > 0 ? biggestExpense : null,
        pendingTransactions,
        completedTransactions,
        upcomingDueDates,
        balance
      };
    });
    
    // Ordenar próximos vencimentos por dia para dados agregados
    allTimeData.upcomingDueDates.sort((a, b) => a.due_day - b.due_day);
    
    // Calcular saldo total
    allTimeData.balance = allTimeData.totalIncome - allTimeData.totalExpenses - allTimeData.totalInvestments;
    
    return {
      byPeriod,
      allTime: {
        ...allTimeData,
        biggestExpense: allTimeData.biggestExpense.amount > 0 ? allTimeData.biggestExpense : null
      },
      periods: periodsList.sort() // Organizar períodos em ordem
    };
  }, [transactionsData]);

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Verificar se a pergunta menciona um período específico
  const extractPeriod = (question: string): { month: string; year: string } | null => {
    const questionLower = question.toLowerCase();
    
    // Padrões para detectar mês/ano mencionados na pergunta
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
      'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'
    ];
    
    // Mapeamento de nomes de mês para números de mês
    const monthNameToNumber: Record<string, string> = {
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
      'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
      'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
      'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
      'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
    };
    
    // Procurar por padrões como "em janeiro de 2023" ou "no mês 01/2023"
    for (const monthName of monthNames) {
      // Padrão: "em [mês] de [ano]"
      const pattern1 = new RegExp(`(em|no mês de|no mês|para o mês|durante) ${monthName} (de|do ano) (\\d{4})`, 'i');
      const match1 = questionLower.match(pattern1);
      if (match1) {
        return { month: monthNameToNumber[monthName], year: match1[3] };
      }
      
      // Padrão: "em [mês]/[ano]"
      const pattern2 = new RegExp(`(em|no mês|para|durante) ${monthName}\\/(\\d{4})`, 'i');
      const match2 = questionLower.match(pattern2);
      if (match2) {
        return { month: monthNameToNumber[monthName], year: match2[2] };
      }
    }
    
    // Padrão: "em MM/YYYY" ou "no mês MM/YYYY"
    const numericPattern = /(em|no mês|para|durante) (\d{1,2})\/(\d{4})/i;
    const numericMatch = questionLower.match(numericPattern);
    if (numericMatch) {
      // Formatar o mês com zero à esquerda se necessário
      const month = numericMatch[2].padStart(2, '0');
      return { month, year: numericMatch[3] };
    }
    
    return null;
  };

  // Verificar se a pergunta é sobre cálculos financeiros e responder diretamente
  const getDirectAnswer = (question: string): string | null => {
    const questionLower = question.toLowerCase();
    
    // Padrões comuns de perguntas sobre valores
    const expensePattern = /quanto (eu )?(gastei|gasto|foi gasto)/;
    const incomePattern = /quanto (eu )?(ganhei|ganho|recebi|foi recebido)/;
    const investmentPattern = /quanto (eu )?(investi|foi investido)/;
    const balancePattern = /(qual (é|foi) (o|meu) )?(saldo|balanço|balança)/;
    const categoryPattern = /(em|com|na categoria) ([a-záéíóúâêîôûãõçà ]+)/i;
    
    let answer: string | null = null;
    
    try {
      // Extrair período mencionado na pergunta, se houver
      const periodFromQuestion = extractPeriod(question);
      
      // Determinar qual conjunto de dados usar baseado na pergunta
      let dataToUse;
      let periodLabel;
      
      if (periodFromQuestion) {
        const period = `${periodFromQuestion.month}/${periodFromQuestion.year}`;
        
        // Verificar se temos dados para este período
        if (preCalculatedData.byPeriod[period]) {
          dataToUse = preCalculatedData.byPeriod[period];
          periodLabel = period;
        } else {
          // Se o período não existe nos dados, informar o usuário
          return `Não tenho dados para o período ${period}. Os períodos disponíveis são: ${preCalculatedData.periods.join(', ')}.`;
        }
      } else {
        // Se não foi especificado um período, usar dados agregados
        dataToUse = preCalculatedData.allTime;
        periodLabel = "todos os períodos";
      }
      
      // Responder sobre despesas
      if (expensePattern.test(questionLower)) {
        let amount = dataToUse.totalExpenses;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(dataToUse.expensesByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = dataToUse.expensesByCategory[matchedCategory];
            if (periodFromQuestion) {
              answer = `Em ${periodLabel}, você gastou R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
            } else {
              answer = `No total, você gastou R$ ${amount.toFixed(2)} em ${matchedCategory} considerando todos os seus dados.`;
            }
          }
        }
        
        if (!answer) {
          if (periodFromQuestion) {
            answer = `Em ${periodLabel}, seu gasto total foi de R$ ${amount.toFixed(2)}.`;
          } else {
            answer = `Seu gasto total considerando todos os períodos foi de R$ ${amount.toFixed(2)}.`;
          }
        }
      }
      
      // Responder sobre receitas
      else if (incomePattern.test(questionLower)) {
        let amount = dataToUse.totalIncome;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(dataToUse.incomesByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = dataToUse.incomesByCategory[matchedCategory];
            if (periodFromQuestion) {
              answer = `Em ${periodLabel}, você recebeu R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
            } else {
              answer = `No total, você recebeu R$ ${amount.toFixed(2)} em ${matchedCategory} considerando todos os seus dados.`;
            }
          }
        }
        
        if (!answer) {
          if (periodFromQuestion) {
            answer = `Em ${periodLabel}, sua receita total foi de R$ ${amount.toFixed(2)}.`;
          } else {
            answer = `Sua receita total considerando todos os períodos foi de R$ ${amount.toFixed(2)}.`;
          }
        }
      }
      
      // Responder sobre investimentos
      else if (investmentPattern.test(questionLower)) {
        let amount = dataToUse.totalInvestments;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(dataToUse.investmentsByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = dataToUse.investmentsByCategory[matchedCategory];
            if (periodFromQuestion) {
              answer = `Em ${periodLabel}, você investiu R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
            } else {
              answer = `No total, você investiu R$ ${amount.toFixed(2)} em ${matchedCategory} considerando todos os seus dados.`;
            }
          }
        }
        
        if (!answer) {
          if (periodFromQuestion) {
            answer = `Em ${periodLabel}, seu investimento total foi de R$ ${amount.toFixed(2)}.`;
          } else {
            answer = `Seu investimento total considerando todos os períodos foi de R$ ${amount.toFixed(2)}.`;
          }
        }
      }
      
      // Responder sobre saldo
      else if (balancePattern.test(questionLower)) {
        if (periodFromQuestion) {
          answer = `Em ${periodLabel}, seu saldo foi de R$ ${dataToUse.balance.toFixed(2)} (receitas - despesas - investimentos).`;
        } else {
          answer = `Seu saldo considerando todos os períodos foi de R$ ${dataToUse.balance.toFixed(2)} (total de receitas - total de despesas - total de investimentos).`;
        }
      }
      
      return answer;
    } catch (error) {
      console.error("Erro ao calcular resposta direta:", error);
      return null;
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
      // Verificar se temos uma resposta direta calculada
      const directAnswer = getDirectAnswer(input.trim());
      
      if (directAnswer) {
        // Se temos uma resposta direta baseada em cálculos, usá-la imediatamente
        const assistantMessage: Message = {
          content: directAnswer,
          role: 'assistant',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }
      
      // Extrair período mencionado na pergunta, se houver
      const periodFromQuestion = extractPeriod(input.trim());
      
      // Preparar dados para o contexto
      let selectedTransactions: any;
      
      if (periodFromQuestion) {
        // Se a pergunta menciona um período específico, filtrar as transações
        selectedTransactions = {
          receita: (transactionsData.receita || [])
            .filter(t => t.year === periodFromQuestion.year && t.month === periodFromQuestion.month)
            .slice(0, 10),
          despesa: (transactionsData.despesa || [])
            .filter(t => t.year === periodFromQuestion.year && t.month === periodFromQuestion.month)
            .slice(0, 10),
          investimento: (transactionsData.investimento || [])
            .filter(t => t.year === periodFromQuestion.year && t.month === periodFromQuestion.month)
            .slice(0, 10)
        };
      } else {
        // Se não, usar uma amostra de todas as transações (limitar para não sobrecarregar)
        selectedTransactions = {
          receita: (transactionsData.receita || []).slice(0, 10),
          despesa: (transactionsData.despesa || []).slice(0, 10),
          investimento: (transactionsData.investimento || []).slice(0, 10)
        };
      }
      
      // Preparar contexto financeiro
      const financialContext = {
        preCalculated: preCalculatedData,
        transactions: selectedTransactions,
        // Se a pergunta menciona um período específico, incluí-lo no contexto
        specificPeriod: periodFromQuestion ? 
          `${periodFromQuestion.month}/${periodFromQuestion.year}` : 
          null
      };

      // Histórico de mensagens para contexto
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));

      // Criar o prompt com instruções específicas
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal preciso e matemáticamente exato. 
      
      DADOS FINANCEIROS DO USUÁRIO:
      ${JSON.stringify(financialContext, null, 2)}
      
      INSTRUÇÕES ESPECÍFICAS:
      1. Ao responder sobre valores, use SEMPRE os valores pré-calculados no objeto 'preCalculated'.
      2. NÃO faça cálculos por conta própria quando os valores já estiverem calculados.
      3. Se a pergunta mencionar um período específico, use os dados desse período.
      4. Se a pergunta não mencionar um período específico, use os dados agregados em 'allTime'.
      5. Informe ao usuário sobre quais períodos você tem dados disponíveis, se relevante.
      6. Os períodos disponíveis são: ${preCalculatedData.periods.join(', ')}
      
      CONVERSA ANTERIOR:
      ${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}
      
      PERGUNTA ATUAL DO USUÁRIO: ${input}
      
      Responda de forma concisa, amigável e MATEMATICAMENTE PRECISA. Sempre verifique os valores nos dados pré-calculados antes de responder sobre quantias financeiras.
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Contar períodos disponíveis
  const periodCount = preCalculatedData.periods.length;

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Bot className="mr-2 h-5 w-5 text-blue-600" />
          Assistente Financeiro
        </h2>
        <div className="flex items-center">
          <Calculator className="h-4 w-4 mr-1 text-green-600" />
          <span className="text-sm text-gray-500">
            {periodCount > 0 ? 
              `${periodCount} períodos disponíveis` : 
              "Nenhum dado disponível"}
          </span>
        </div>
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
            disabled={isLoading || periodCount === 0}
            className="flex-grow"
          />
          <Button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || periodCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {periodCount === 0 && (
          <p className="text-xs text-orange-500 mt-2">
            Não existem dados financeiros disponíveis para análise.
          </p>
        )}
      </div>
    </div>
  );
}
