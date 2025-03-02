import { useEffect, useState } from 'react';
import { genai } from '@/lib/genai'; // Ajuste o caminho conforme necessário
import { SummaryData, TransactionsData, CompletionData } from './Dashboard'; // Importe os tipos do Dashboard

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

  useEffect(() => {
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

        // Enviar os dados para o modelo de IA
        const model = genai.GenerativeModel("gemini-1.5-flash");
        const prompt = `Analise os seguintes dados financeiros e forneça insights, dicas e alertas: ${JSON.stringify(dataToAnalyze)}`;
        const response = await model.generateContent(prompt);

        // Definir os insights gerados
        setInsights(response.text);
      } catch (error) {
        console.error('Erro ao gerar insights:', error);
        setInsights('Erro ao gerar insights. Tente novamente mais tarde.');
      } finally {
        setIsLoading(false);
      }
    };

    generateInsights();
  }, [selectedYear, selectedMonth, summaryData, transactionsData, completionData]);

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Insights e Recomendações</h2>
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="text-gray-700">
          {insights.split('\n').map((line, index) => (
            <p key={index} className="mb-2">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
