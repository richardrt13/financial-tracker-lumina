import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext'; 
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
import Markdown from 'react-markdown'; 


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
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};


type FinancialAssistantChatProps = {
  allTransactionsHistory?: Transaction[];
};

export function FinancialAssistantChat({
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
  const { user } = useAuth(); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = {
      role: 'user' as const,
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // A mágica acontece aqui! Chamada para a API backend.
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          message: currentInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na API: ${response.statusText}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response, 
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error('Erro ao processar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Desculpe, ocorreu um erro. Por favor, tente novamente.",
        timestamp: new Date()
      }]);
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
                  <Avatar className="h-6 w-6 mr-2 bg-blue-100 flex-shrink-0">
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
                  {/* Usando react-markdown para renderizar a resposta */}
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{message.content}</Markdown>
                  </div>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 bg-gray-500 text-white flex-shrink-0">
                    {/* Pode ser substituído pela imagem de perfil do usuário */}
                    <MessageSquare className="h-5 w-5" />
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
               <div className="flex items-start gap-3 mb-4">
                  <Avatar className="h-6 w-6 mr-2 bg-blue-100 flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </Avatar>
                  <div className="rounded-lg p-3 max-w-[80%] bg-white border shadow animate-pulse">
                    <p className="text-sm">Pensando...</p>
                  </div>
               </div>
            )}
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