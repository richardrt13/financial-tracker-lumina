import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, LineChart } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Tipagens para os dados financeiros
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
};

type TransactionsData = {
  receita: Transaction[];
  despesa: Transaction[];
  investimento: Transaction[];
};

type FinanceInsightsProps = {
  summaryData: SummaryData;
  completionData: CompletionData;
  transactionsData: TransactionsData;
  selectedYear: string;
  selectedMonth: string;
  isLoading: boolean;
};

type InsightType = 'tip' | 'alert' | 'analysis';

type Insight = {
  type: InsightType;
  title: string;
  description: string;
  icon: React.ReactNode;
};

export function FinanceInsights({
  summaryData,
  completionData,
  transactionsData,
  selectedYear,
  selectedMonth,
  isLoading
}: FinanceInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsGenerated, setInsightsGenerated] = useState(false);

  // Função para gerar insights usando a API do Python com Gemini
  const generateInsights = async () => {
    setIsGeneratingInsights(true);
    setInsightsGenerated(false);
    
    try {
      // Preparar os dados para enviar para a API
      const requestData = {
        summaryData,
        completionData,
        transactionsData,
        selectedYear,
        selectedMonth,
      };
      
      // Enviar os dados para a API Python que utiliza o modelo Gemini
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error('Falha ao gerar insights');
      }
      
      const data = await response.json();
      
      // Mapear os insights retornados pela API para o formato que vamos usar
      const formattedInsights = data.insights.map((insight: any) => {
        // Definir o ícone baseado no tipo de insight
        let icon;
        switch (insight.type) {
          case 'tip':
            icon = <Sparkles className="h-5 w-5 text-blue-500" />;
            break;
          case 'alert':
            icon = <AlertTriangle className="h-5 w-5 text-amber-500" />;
            break;
          case 'analysis':
            if (insight.trend === 'up') {
              icon = <TrendingUp className="h-5 w-5 text-green-500" />;
            } else if (insight.trend === 'down') {
              icon = <TrendingDown className="h-5 w-5 text-red-500" />;
            } else {
              icon = <LineChart className="h-5 w-5 text-purple-500" />;
            }
            break;
          default:
            icon = <Sparkles className="h-5 w-5 text-blue-500" />;
        }
        
        return {
          type: insight.type,
          title: insight.title,
          description: insight.description,
          icon
        };
      });
      
      setInsights(formattedInsights);
      setInsightsGenerated(true);
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar insights. Tente novamente mais tarde.",
        variant: "destructive"
      });
      
      // Adicionar insights de fallback para não deixar o usuário sem nada
      setInsights([{
        type: 'tip',
        title: 'Insights Indisponíveis',
        description: 'Nosso sistema de análise está temporariamente indisponível. Por favor, tente novamente mais tarde.',
        icon: <AlertTriangle className="h-5 w-5 text-amber-500" />
      }]);
    } finally {
      setIsGeneratingInsights(false);
    }
  };
  
  // Gerar insights automaticamente quando os dados mudarem
  useEffect(() => {
    if (!isLoading && (summaryData.receita > 0 || summaryData.despesa > 0 || summaryData.investimento > 0)) {
      // Resetar insights quando filtros mudarem
      setInsights([]);
      setInsightsGenerated(false);
    }
  }, [summaryData, selectedYear, selectedMonth, isLoading]);

  // Renderizar insights baseados nos dados financeiros
  const renderInsights = () => {
    if (isGeneratingInsights) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-500">Gerando insights inteligentes...</p>
        </div>
      );
    }
    
    if (insights.length === 0 && !insightsGenerated) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Button 
            onClick={generateInsights}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <Sparkles className="h-4 w-4" />
            Gerar Insights
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            Clique para analisar seus dados financeiros
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {insight.icon}
                <CardTitle className="text-lg">{insight.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{insight.description}</p>
            </CardContent>
          </Card>
        ))}
        
        <div className="text-center mt-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateInsights}
            disabled={isGeneratingInsights}
            className="flex items-center gap-2"
          >
            {isGeneratingInsights ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Atualizar Insights
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          Insights Financeiros
        </CardTitle>
        <CardDescription>
          {selectedMonth === "Todos os Meses" ? 
            `Análise do ano de ${selectedYear}` : 
            `Análise de ${selectedMonth} de ${selectedYear}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderInsights()}
      </CardContent>
    </Card>
  );
}
