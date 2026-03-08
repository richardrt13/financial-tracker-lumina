import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Send, 
  Bot, 
  User,
  Sparkles,
  TrendingUp,
  DollarSign,
  Target,
  Lightbulb,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    agent?: string;
    confidence?: number;
    toolsUsed?: string[];
    suggestedActions?: Action[];
  };
}

interface Action {
  type: 'create_transaction' | 'update_budget' | 'set_goal' | 'create_alert';
  label: string;
  description: string;
  params: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

export function FinancialAssistantChatV2() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o **Spendly**, seu assistente financeiro.\n\nPosso te ajudar com **análises** de gastos, **projeções** financeiras, **insights** personalizados e **ações** rápidas.\n\nComo posso ajudar?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat-v2', {
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

      await new Promise(resolve => setTimeout(resolve, 500));

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: data.metadata
      }]);

    } catch (error: any) {
      console.error('Erro ao processar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível processar sua mensagem.",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Desculpe, ocorreu um erro. Por favor, tente novamente.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
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

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleActionClick = async (action: Action) => {
    toast({
      title: "Ação em Desenvolvimento",
      description: `A funcionalidade "${action.label}" será implementada em breve.`,
    });
  };

  const getAgentIcon = (agent?: string) => {
    switch (agent) {
      case 'analyzer': return <TrendingUp className="h-3 w-3" />;
      case 'predictor': return <Target className="h-3 w-3" />;
      case 'executor': return <DollarSign className="h-3 w-3" />;
      case 'insight': return <Lightbulb className="h-3 w-3" />;
      default: return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getAgentBadge = (agent?: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      'analyzer': { label: 'Análise', variant: 'secondary' },
      'predictor': { label: 'Previsão', variant: 'secondary' },
      'executor': { label: 'Ação', variant: 'secondary' },
      'insight': { label: 'Insight', variant: 'secondary' },
      'general': { label: 'Conversa', variant: 'outline' }
    };

    if (!agent || !badges[agent]) return null;

    return (
      <Badge variant={badges[agent].variant} className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium">
        {getAgentIcon(agent)}
        {badges[agent].label}
      </Badge>
    );
  };

  const quickSuggestions = [
    "Quanto gastei este mês?",
    "Maiores despesas?",
    "Juntar R$ 10.000?",
    "Insights financeiros"
  ];

  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/8 via-primary/4 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 text-sm animate-bounce-gentle">✨</div>
            </div>
            <div>
              <CardTitle className="text-base font-bold">Spendly AI</CardTitle>
              <CardDescription className="text-xs">Seu assistente financeiro</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
            </span>
            Online
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[380px]">
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start gap-2.5 animate-fade-in ${
                  message.role === 'user' ? 'justify-end' : ''
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-7 w-7 shrink-0 border">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`rounded-2xl px-3.5 py-2.5 max-w-[80%] ${
                    message.role === 'assistant'
                      ? 'bg-card text-card-foreground border shadow-sm'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] opacity-60 tabular-nums">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {message.metadata?.agent && getAgentBadge(message.metadata.agent)}
                    {message.metadata?.confidence && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {Math.round(message.metadata.confidence * 100)}%
                      </Badge>
                    )}
                  </div>

                  <div className={`prose prose-sm max-w-none text-[13px] leading-relaxed ${
                    message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'
                  } [&>p]:mb-1.5 [&>p:last-child]:mb-0`}>
                    <Markdown>{message.content}</Markdown>
                  </div>

                  {message.metadata?.suggestedActions && 
                   message.metadata.suggestedActions.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Ações
                      </p>
                      {message.metadata.suggestedActions.map((action, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                          onClick={() => handleActionClick(action)}
                        >
                          <DollarSign className="h-3 w-3 mr-1.5" />
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <Avatar className="h-7 w-7 shrink-0 border">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-start gap-2.5">
                <Avatar className="h-7 w-7 shrink-0 border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl px-4 py-3 bg-card border shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-3">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-[11px] px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {!user && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                Você precisa estar logado para usar o assistente.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Pergunte sobre suas finanças..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !user}
              className="flex-1 h-10 text-sm"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || !user}
              size="icon"
              className="shrink-0 h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Powered by Gemini 2.5
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
