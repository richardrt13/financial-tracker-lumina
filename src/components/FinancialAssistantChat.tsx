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

export function FinancialAssistantChat({
  selectedYear,
  selectedMonth,
  summaryData,
  transactionsData,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pré-calcular dados financeiros para melhorar a precisão das respostas
  const preCalculatedData = useMemo((): PreCalculatedData => {
    // Verificar se transactionsData é um objeto válido com arrays
    if (!transactionsData || typeof transactionsData !== 'object') {
      console.error("transactionsData não é um objeto válido", transactionsData);
      return {
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
      };
    }
    
    // Extrair e filtrar transações para o mês e ano selecionados
    const filteredIncome = (transactionsData.receita || []).filter(t => 
      t.year === selectedYear && t.month === selectedMonth
    );
    
    const filteredExpenses = (transactionsData.despesa || []).filter(t => 
      t.year === selectedYear && t.month === selectedMonth
    );
    
    const filteredInvestments = (transactionsData.investimento || []).filter(t => 
      t.year === selectedYear && t.month === selectedMonth
    );
    
    // Mapas para armazenar somas por categoria
    const expensesByCategory: Record<string, number> = {};
    const incomesByCategory: Record<string, number> = {};
    const investmentsByCategory: Record<string, number> = {};
    
    // Totais
    let totalExpenses = 0;
    let totalIncome = 0;
    let totalInvestments = 0;
    let biggestExpense = { category: '', amount: 0 };
    let pendingTransactions = 0;
    let completedTransactions = 0;
    
    // Transações com datas de vencimento próximas
    const upcomingDueDates: Array<{ category: string; amount: number; due_day: number }> = [];
    
    // Processar despesas
    filteredExpenses.forEach(transaction => {
      const { category, amount, is_completed, due_day } = transaction;
      
      // Contar transações pendentes e completadas
      if (is_completed === true) {
        completedTransactions++;
      } else if (is_completed === false) {
        pendingTransactions++;
      }
      
      totalExpenses += amount;
      expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
      
      // Verificar se é a maior despesa
      if (amount > biggestExpense.amount) {
        biggestExpense = { category, amount };
      }
      
      // Adicionar à lista de próximos vencimentos se tiver due_day
      if (due_day !== null && due_day !== undefined) {
        upcomingDueDates.push({ category, amount, due_day });
      }
    });
    
    // Processar receitas
    filteredIncome.forEach(transaction => {
      const { category, amount, is_completed } = transaction;
      
      // Contar transações pendentes e completadas
      if (is_completed === true) {
        completedTransactions++;
      } else if (is_completed === false) {
        pendingTransactions++;
      }
      
      totalIncome += amount;
      incomesByCategory[category] = (incomesByCategory[category] || 0) + amount;
    });
    
    // Processar investimentos
    filteredInvestments.forEach(transaction => {
      const { category, amount, is_completed } = transaction;
      
      // Contar transações pendentes e completadas
      if (is_completed === true) {
        completedTransactions++;
      } else if (is_completed === false) {
        pendingTransactions++;
      }
      
      totalInvestments += amount;
      investmentsByCategory[category] = (investmentsByCategory[category] || 0) + amount;
    });
    
    // Ordenar vencimentos por dia
    upcomingDueDates.sort((a, b) => a.due_day - b.due_day);
    
    return {
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
      balance: totalIncome - totalExpenses - totalInvestments
    };
  }, [transactionsData, selectedYear, selectedMonth]);

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Responder sobre despesas
      if (expensePattern.test(questionLower)) {
        let amount = preCalculatedData.totalExpenses;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(preCalculatedData.expensesByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = preCalculatedData.expensesByCategory[matchedCategory];
            answer = `Em ${selectedMonth}/${selectedYear}, você gastou R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
          }
        }
        
        if (!answer) {
          answer = `Em ${selectedMonth}/${selectedYear}, seu gasto total foi de R$ ${amount.toFixed(2)}.`;
        }
      }
      
      // Responder sobre receitas
      else if (incomePattern.test(questionLower)) {
        let amount = preCalculatedData.totalIncome;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(preCalculatedData.incomesByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = preCalculatedData.incomesByCategory[matchedCategory];
            answer = `Em ${selectedMonth}/${selectedYear}, você recebeu R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
          }
        }
        
        if (!answer) {
          answer = `Em ${selectedMonth}/${selectedYear}, sua receita total foi de R$ ${amount.toFixed(2)}.`;
        }
      }
      
      // Responder sobre investimentos
      else if (investmentPattern.test(questionLower)) {
        let amount = preCalculatedData.totalInvestments;
        let category = "";
        
        // Verificar se a pergunta é sobre categoria específica
        const categoryMatch = questionLower.match(categoryPattern);
        if (categoryMatch && categoryMatch[2]) {
          category = categoryMatch[2].trim();
          
          // Encontrar a categoria mais próxima
          const categories = Object.keys(preCalculatedData.investmentsByCategory);
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === category || 
            c.toLowerCase().includes(category) ||
            category.includes(c.toLowerCase())
          );
          
          if (matchedCategory) {
            amount = preCalculatedData.investmentsByCategory[matchedCategory];
            answer = `Em ${selectedMonth}/${selectedYear}, você investiu R$ ${amount.toFixed(2)} em ${matchedCategory}.`;
          }
        }
        
        if (!answer) {
          answer = `Em ${selectedMonth}/${selectedYear}, seu investimento total foi de R$ ${amount.toFixed(2)}.`;
        }
      }
      
      // Responder sobre saldo
      else if (balancePattern.test(questionLower)) {
        answer = `Em ${selectedMonth}/${selectedYear}, seu saldo foi de R$ ${preCalculatedData.balance.toFixed(2)} (receitas - despesas - investimentos).`;
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
      
      // Preparar transações para o contexto (limitadas para não sobrecarregar)
      const selectedTransactions = {
        receita: (transactionsData.receita || [])
          .filter(t => t.year === selectedYear && t.month === selectedMonth)
          .slice(0, 10),
        despesa: (transactionsData.despesa || [])
          .filter(t => t.year === selectedYear && t.month === selectedMonth)
          .slice(0, 10),
        investimento: (transactionsData.investimento || [])
          .filter(t => t.year === selectedYear && t.month === selectedMonth)
          .slice(0, 10)
      };
      
      // Preparar dados pré-calculados para o contexto
      const financialContext = {
        year: selectedYear,
        month: selectedMonth,
        summary: summaryData,
        preCalculated: preCalculatedData,
        transactions: selectedTransactions
      };

      // Histórico de mensagens para contexto
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));

      // Criar o prompt com instruções específicas sobre cálculos
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal preciso e matemáticamente exato. 
      
      DADOS FINANCEIROS DO USUÁRIO:
      ${JSON.stringify(financialContext, null, 2)}
      
      INSTRUÇÕES ESPECÍFICAS:
      1. Ao responder sobre valores, use SEMPRE os valores pré-calculados no objeto 'preCalculated'.
      2. NÃO faça cálculos por conta própria quando os valores já estiverem calculados.
      3. Para despesas totais, use preCalculated.totalExpenses: ${preCalculatedData.totalExpenses}
      4. Para receitas totais, use preCalculated.totalIncome: ${preCalculatedData.totalIncome}
      5. Para investimentos totais, use preCalculated.totalInvestments: ${preCalculatedData.totalInvestments}
      6. Para o saldo, use preCalculated.balance: ${preCalculatedData.balance}
      7. Use os objetos por categoria (expensesByCategory, incomesByCategory, etc.) para valores específicos por categoria.
      
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

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Bot className="mr-2 h-5 w-5 text-blue-600" />
          Assistente Financeiro
        </h2>
        {(selectedYear && selectedMonth) ? (
          <div className="flex items-center">
            <Calculator className="h-4 w-4 mr-1 text-green-600" />
            <span className="text-sm text-gray-500">
              Dados: {selectedMonth}/{selectedYear}
            </span>
          </div>
        ) : (
          <span className="text-sm text-orange-500">
            Selecione mês e ano para análises precisas
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
            disabled={isLoading || !selectedYear || !selectedMonth}
            className="flex-grow"
          />
          <Button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !selectedYear || !selectedMonth}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {(!selectedYear || !selectedMonth) && (
          <p className="text-xs text-orange-500 mt-2">
            Selecione o ano e mês para começar a conversar com o assistente.
          </p>
        )}
      </div>
    </div>
  );
}
