import { useState, useEffect, useRef } from 'react';
import { genai } from '@/lib/genai';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquare, Bot } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

// Types imported from Dashboard
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

type TransactionsData = {
  receita: Transaction[];
  despesa: Transaction[];
  investimento: Transaction[];
};

type SummaryData = {
  receita: number;
  despesa: number;
  investimento: number;
  saldo: number;
};

type CompletionData = {
  receita: {
    count: number;
    completed: number;
    percentage: number;
  };
  despesa: {
    count: number;
    completed: number;
    percentage: number;
  };
  investimento: {
    count: number;
    completed: number;
    percentage: number;
  };
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type FinancialAssistantChatProps = {
  summaryData: SummaryData;
  transactionsData: TransactionsData;
  completionData: CompletionData;
  selectedYear: string;
  selectedMonth: string;
  allTransactionsHistory?: Transaction[]; // New prop for complete history
};


export function FinancialAssistantChat({
  summaryData,
  transactionsData,
  completionData,
  allTransactionsHistory = []
}: FinancialAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou seu assistente financeiro. Posso ajudar com análises das suas finanças, tendências de gastos e receitas, ou sugestões para melhorar sua situação financeira. Como posso te ajudar hoje?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allHistoricalTransactions, setAllHistoricalTransactions] = useState<Transaction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine historical transactions from props
  useEffect(() => {
    if (allTransactionsHistory && allTransactionsHistory.length > 0) {
      setAllHistoricalTransactions(allTransactionsHistory);
    }
  }, [allTransactionsHistory]);

  // Scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = {
      role: 'user' as const,
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Prepare financial context to send to Gemini API
      const financialContext = prepareFinancialContext();
      
      // Create chat history for context
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));
      
      // Create the prompt and call Gemini API
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal. Analise estes dados financeiros do usuário:
      
      Contexto financeiro: ${JSON.stringify(financialContext, null, 2)}
      
      Conversa anterior:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Pergunta atual do usuário: ${input}
      
      Responda de forma concisa, amigável e direta. Se o usuário pedir insights ou análises, foque nas informações mais relevantes baseadas nos dados apresentados. Se possível, ofereça dicas práticas ou sugestões baseadas no comportamento financeiro observado.
      `;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.text(),
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      // Focus on input after response
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Prepare structured financial context
  const prepareFinancialContext = () => {
    // Merge all transactions from current month
    const currentTransactions = [
      ...transactionsData.receita,
      ...transactionsData.despesa,
      ...transactionsData.investimento
    ];

    // Group historical transactions by year and month for trend analysis
    const transactionsByYearMonth = allHistoricalTransactions.reduce((acc, transaction) => {
      const key = `${transaction.year}-${transaction.month}`;
      if (!acc[key]) {
        acc[key] = {
          year: transaction.year,
          month: transaction.month,
          receita: 0,
          despesa: 0,
          investimento: 0,
          count: 0
        };
      }
      
      acc[key][transaction.type as 'receita' | 'despesa' | 'investimento'] += transaction.amount;
      acc[key].count += 1;
      
      return acc;
    }, {} as Record<string, any>);

    // Most common categories
    const categoryCounts = allHistoricalTransactions.reduce((acc, transaction) => {
      const category = transaction.category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category);

    // Structure final context
    return {
      currentPeriodSummary: summaryData,
      completionStats: completionData,
      currentTransactions,
      historicalData: {
        transactionsByYearMonth: Object.values(transactionsByYearMonth),
        topCategories,
        totalTransactions: allHistoricalTransactions.length,
        monthsWithData: Object.keys(transactionsByYearMonth).length
      },
      recentTrends: calculateRecentTrends(allHistoricalTransactions)
    };
  };

  // Calculate recent trends based on historical data
  const calculateRecentTrends = (transactions: Transaction[]) => {
    // Analyze the last 6 months of data to identify trends
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Last 6 months
    const last6Months: { year: number, month: number }[] = [];
    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month < 0) {
        month += 12;
        year -= 1;
      }
      
      last6Months.push({ 
        year, 
        month: month + 1 // Adjust to 1-12 format instead of 0-11
      });
    }
    
    // Map months to names to compare with data
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    
    // Group transactions by month for analysis
    const monthlyData = last6Months.map(({ year, month }) => {
      const monthName = monthNames[month - 1];
      const yearStr = year.toString();
      
      const monthTransactions = transactions.filter(
        t => t.year === yearStr && t.month === monthName
      );
      
      return {
        year,
        month: monthName,
        receita: sumByType(monthTransactions, 'receita'),
        despesa: sumByType(monthTransactions, 'despesa'),
        investimento: sumByType(monthTransactions, 'investimento')
      };
    });
    
    // Calculate trends
    const trends = {
      receitaCrescente: isTrendIncreasing(monthlyData.map(d => d.receita)),
      despesaCrescente: isTrendIncreasing(monthlyData.map(d => d.despesa)),
      investimentoCrescente: isTrendIncreasing(monthlyData.map(d => d.investimento)),
      economiaMedia: monthlyData.reduce((acc, data) => 
        acc + (data.receita - data.despesa - data.investimento), 0) / monthlyData.length
    };
    
    return {
      monthlyData,
      trends
    };
  };

  // Helper functions for trend calculations
  const sumByType = (transactions: Transaction[], type: string) => {
    return transactions
      .filter(t => t.type === type)
      .reduce((sum, t) => sum + t.amount, 0);
  };
  
  const isTrendIncreasing = (values: number[]) => {
    if (values.length < 2) return false;
    
    // Using simple linear regression to detect trend
    const xValues = Array.from({ length: values.length }, (_, i) => i);
    
    // Calculate slope coefficient
    const n = values.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope > 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Assistente Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ScrollArea className="h-[300px] pr-4">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 mb-4 ${message.role === 'assistant' ? '' : 'justify-end'}`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-6 w-6 mr-2 bg-blue-100">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </Avatar>
                )}
                <div 
                  className={`rounded-lg p-3 max-w-[80%] ${
                    message.role === 'assistant' 
                      ? 'bg-white border shadow' 
                      : 'bg-primary text-white'
                  }`}
                >
                  <div className="mb-1 flex items-center">
                    <span className="text-xs opacity-75">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 bg-gray-500 text-white">
                    <MessageSquare className="h-5 w-5" />
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Pergunte algo sobre suas finanças..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
