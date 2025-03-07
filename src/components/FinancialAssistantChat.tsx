import { useState, useRef, useEffect } from 'react';
import { genai } from '@/lib/genai';
import { SummaryData, TransactionsData, CompletionData } from './Dashboard';
import { Loader2, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar transações do Supabase e organizá-las
  useEffect(() => {
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(100); // Limitar para transações mais recentes

      if (error) {
        console.error('Erro ao buscar transações:', error);
      } else {
        setTransactionsData(data);
      }
    };

    fetchTransactions();
  }, []);

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Processar transações para análise
  const processTransactionsForAnalysis = (transactions: TransactionsData) => {
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
      // Armazenar apenas dados essenciais das transações
      acc[category].transactions.push({
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date
      });
      return acc;
    }, {} as Record<string, { total: number; count: number; transactions: any[] }>);

    // Calcular gastos mensais (últimos 3 meses)
    const today = new Date();
    const monthsData: Record<string, number> = {};
    
    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(today);
      monthDate.setMonth(today.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      monthsData[monthKey] = 0;
    }

    transactions.forEach(transaction => {
      const txDate = new Date(transaction.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthsData[monthKey] !== undefined) {
        monthsData[monthKey] += transaction.amount;
      }
    });

    return {
      categorySummary,
      monthlySpending: monthsData,
      recentTransactions: transactions.slice(0, 10) // 10 transações mais recentes
    };
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
      // Processar dados de transações para análise mais eficiente
      const processedTransactions = processTransactionsForAnalysis(transactionsData);
      
      // Preparar contexto com os dados financeiros processados
      const financialContext = {
        summary: summaryData,
        transactionsAnalysis: processedTransactions,
        completion: completionData,
        totalTransactions: transactionsData.length
      };

      // Histórico de mensagens para contexto (limitado às últimas 5 para manter relevância)
      const recentMessages = messages.slice(-5);
      const chatHistory = recentMessages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));

      // Criar o prompt estruturado
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal especializado em análise de dados financeiros. Sua tarefa é fornecer insights precisos e úteis com base nos dados financeiros do usuário.

      ### DADOS FINANCEIROS DO USUÁRIO
      
      # Resumo Financeiro
      ${JSON.stringify(summaryData, null, 2)}
      
      # Análise de Transações
      - Total de transações: ${financialContext.totalTransactions}
      - Gastos por categoria: ${JSON.stringify(processedTransactions.categorySummary, null, 2)}
      - Gastos mensais: ${JSON.stringify(processedTransactions.monthlySpending, null, 2)}
      
      # Transações Recentes
      ${JSON.stringify(processedTransactions.recentTransactions, null, 2)}
      
      # Metas Financeiras
      ${JSON.stringify(completionData, null, 2)}
      
      ### CONVERSA ANTERIOR
      ${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}
      
      ### PERGUNTA ATUAL DO USUÁRIO
      ${input}
      
      ### INSTRUÇÕES PARA RESPOSTA
      1. Use APENAS os dados financeiros fornecidos acima para sua análise.
      2. Responda de forma concisa e direta, com no máximo 3-4 parágrafos.
      3. Se a pergunta for sobre uma categoria ou período específico, forneça dados precisos dessas categorias/períodos.
      4. Inclua números e percentuais específicos quando relevante.
      5. Se não tiver dados suficientes para responder com precisão, admita isso claramente.
      6. Mantenha um tom amigável e profissional.
      
      Sua resposta:
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
