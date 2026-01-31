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

// =====================================================
// TIPOS
// =====================================================

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

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function FinancialAssistantChatV2() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou **Lumina**, sua assistente financeira inteligente.\n\nPosso te ajudar com:\n\n💰 **Análises** detalhadas dos seus gastos\n\n🔮 **Projeções** e previsões financeiras\n\n💡 **Insights** personalizados\n\n🎯 **Ações** rápidas (criar transações, definir metas)\n\nComo posso te ajudar hoje?',
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

      // Simular digitação por um momento
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
        content: "😔 Desculpe, ocorreu um erro. Por favor, tente novamente ou reformule sua pergunta.",
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
      case 'analyzer': return <TrendingUp className="h-4 w-4" />;
      case 'predictor': return <Target className="h-4 w-4" />;
      case 'executor': return <DollarSign className="h-4 w-4" />;
      case 'insight': return <Lightbulb className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getAgentBadge = (agent?: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      'analyzer': { label: 'Análise', variant: 'default' },
      'predictor': { label: 'Previsão', variant: 'secondary' },
      'executor': { label: 'Ação', variant: 'outline' },
      'insight': { label: 'Insight', variant: 'default' },
      'general': { label: 'Conversa', variant: 'outline' }
    };

    if (!agent || !badges[agent]) return null;

    return (
      <Badge variant={badges[agent].variant} className="text-xs">
        {getAgentIcon(agent)}
        <span className="ml-1">{badges[agent].label}</span>
      </Badge>
    );
  };

  const quickSuggestions = [
    "Quanto gastei este mês?",
    "Quais minhas maiores despesas?",
    "Em quanto tempo junto R$ 10.000?",
    "Me dê insights sobre meus gastos"
  ];

  return (
    <Card className="mt-6 shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bot className="h-8 w-8 text-primary" />
              <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl">Lumina AI</CardTitle>
              <CardDescription>Assistente Financeira Inteligente</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Online
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Área de Mensagens */}
          <ScrollArea className="h-[400px] pr-4 rounded-lg">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${
                    message.role === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`rounded-2xl p-4 max-w-[80%] ${
                      message.role === 'assistant'
                        ? 'bg-white border-2 shadow-sm'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {/* Header da Mensagem */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {message.metadata?.agent && getAgentBadge(message.metadata.agent)}
                      {message.metadata?.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(message.metadata.confidence * 100)}% confiança
                        </Badge>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className={`prose prose-sm max-w-none ${
                      message.role === 'user' ? 'prose-invert' : ''
                    }`}>
                      <Markdown>{message.content}</Markdown>
                    </div>

                    {/* Ações Sugeridas */}
                    {message.metadata?.suggestedActions && 
                     message.metadata.suggestedActions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Ações Disponíveis:
                        </p>
                        {message.metadata.suggestedActions.map((action, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => handleActionClick(action)}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Indicador de Digitação */}
              {isTyping && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl p-4 bg-white border-2 shadow-sm animate-pulse">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Sugestões Rápidas */}
          {messages.length <= 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Sugestões rápidas:
              </p>
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de Status */}
          {!user && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você precisa estar logado para usar o assistente.
              </AlertDescription>
            </Alert>
          )}

          {/* Input */}
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Pergunte algo sobre suas finanças..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !user}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || !user}
              size="icon"
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Footer Info */}
          <p className="text-xs text-center text-muted-foreground">
            Lumina usa IA avançada para analisar suas finanças • Powered by Gemini 2.5
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
