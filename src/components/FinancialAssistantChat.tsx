import { useState, useRef, useEffect } from 'react';
import { genai } from '@/lib/genai';
import { SummaryData, TransactionsData, CompletionData } from './Dashboard';
import { Loader2, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';

interface FinancialAssistantChatProps {
  selectedYear: string;
  summaryData: Record<string, SummaryData>;
  transactionsData: Record<string, TransactionsData>;
  completionData: Record<string, CompletionData>;
}

type Message = {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

export function FinancialAssistantChat({
  selectedYear,
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

  // Rolar para a mensagem mais recente
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Preparar contexto com os dados financeiros completos
      const financialContext = {
        year: selectedYear,
        allMonthsData: {
          summary: summaryData,
          transactions: transactionsData,
          completion: completionData
        }
      };

      // Histórico de mensagens para contexto
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));

      // Criar o prompt melhorado
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
      Você é um assistente financeiro pessoal especializado em análise de dados. Analise cuidadosamente os dados financeiros do usuário:
      
      Contexto financeiro detalhado: ${JSON.stringify(financialContext, null, 2)}
      
      Conversa anterior:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Pergunta atual do usuário: ${input}
      
      Instruções importantes para cálculos precisos:
      1. Quando fizer cálculos numéricos, mostre detalhadamente como chegou ao resultado
      2. Sempre verifique se os valores estão na mesma unidade antes de somá-los ou compará-los
      3. Para médias e tendências, especifique o período considerado
      4. Quando calcular percentagens, mostre os valores base utilizados
      5. Se mencionar economia ou excesso de gastos, utilize sempre valores absolutos como referência
      6. Considere sazonalidades nos gastos ao fazer comparações entre meses
      7. Verifique duplamente todos os cálculos matemáticos antes de apresentar conclusões
      
      Responda de forma concisa, amigável e direta. Se o usuário pedir insights ou análises, foque nas informações mais relevantes baseadas nos dados apresentados. Ofereça dicas práticas ou sugestões baseadas no comportamento financeiro observado.
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
        {selectedYear ? (
          <span className="text-sm text-gray-500">
            Dados: Ano {selectedYear} (todos os meses)
          </span>
        ) : (
          <span className="text-sm text-orange-500">
            Selecione o ano para análises precisas
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
            disabled={isLoading || !selectedYear}
            className="flex-grow"
          />
          <Button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !selectedYear}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {!selectedYear && (
          <p className="text-xs text-orange-500 mt-2">
            Selecione o ano para começar a conversar com o assistente.
          </p>
        )}
      </div>
    </div>
  );
}
