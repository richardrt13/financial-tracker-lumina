import { useState } from 'react';
import { genai } from '@/lib/genai'; // Ajuste o caminho conforme necessário
import { SummaryData, TransactionsData, CompletionData } from './Dashboard'; // Importe os tipos do Dashboard
import { Loader2 } from 'lucide-react'; // Importe o componente Loader2
import { Button } from '@/components/ui/button'; // Importe o componente Button

interface InsightsProps {
  selectedYear: string;
  selectedMonth: string;
  summaryData: SummaryData;
  transactionsData: TransactionsData;
  completionData: CompletionData;
}

export function Insights({ selectedYear, selectedMonth, summaryData, transactionsData, completionData }: InsightsProps) {
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const generateInsights = async () => {
    setIsLoading(true);

    try {
      // Preparar os dados para enviar ao modelo de IA
      const dataToAnalyze = {
        year: selectedYear,
        month: selectedMonth,
        summary: summaryData,
        transactions: transactionsData,
        completion: completionData,
      };

      // Forma correta de chamar a API do Gemini
      const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      
      // Prompt melhorado para respostas mais curtas e assertivas
      const prompt = `
      Analise estes dados financeiros e forneça 2 insights breves e assertivos:
      
      ${JSON.stringify(dataToAnalyze, null, 2)}
      
      Formato da resposta:
      • Insight 1: [Uma frase assertiva sobre um aspecto importante]
      • Insight 2: [Uma frase assertiva com uma recomendação específica]
      
      Seja extremamente conciso. Cada insight deve ter no máximo 1-2 frases. Foque apenas nos pontos mais relevantes.
      `;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      // Definir os insights gerados
      setInsights(response.text());
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      setInsights('Erro ao gerar insights. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Insights Rápidos</h2>
        <Button 
          onClick={generateInsights} 
          disabled={isLoading || !selectedYear || !selectedMonth}
          className="bg-primary hover:bg-primary text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            "Gerar Insights"
          )}
        </Button>
      </div>
      
      {insights ? (
        <div className="text-foreground mt-4 p-4 bg-muted/50 rounded-md">
          {insights.split('\n').map((line, index) => (
            <p key={index} className="mb-2">{line}</p>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground italic">
          Clique no botão para gerar insights sobre seus dados financeiros.
        </p>
      )}
    </div>
  );
}
