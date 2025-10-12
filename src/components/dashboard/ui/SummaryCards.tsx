import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummaryData, CompletionData } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SummaryCardsProps {
  summaryData: SummaryData;
  completionData: CompletionData;
  onCardClick: (type: string) => void;
  valuesVisible: boolean; // Adicione esta propriedade
}

const summaryCards = [
  { title: "Receitas", type: "receita", color: "text-green-600" },
  { title: "Despesas", type: "despesa", color: "text-red-600" },
  { title: "Investimentos", type: "investimento", color: "text-blue-600" },
  { title: "Saldo", type: "saldo", color: "text-purple-600" },
];

export function SummaryCards({
  summaryData,
  completionData,
  onCardClick,
  valuesVisible, // Receba a propriedade
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card) => (
        <Card
          key={card.type}
          className={`hover:shadow-lg transition-shadow ${card.type !== 'saldo' ? 'cursor-pointer' : ''}`}
          onClick={() => card.type !== 'saldo' ? onCardClick(card.type) : null}
        >
          <CardHeader>
            <CardTitle className={card.color}>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.color}`}>
              {valuesVisible ? `R$ ${formatCurrency(summaryData[card.type as keyof SummaryData])}` : "R$ ••••"}
            </p>
          </CardContent>
          {card.type !== 'saldo' && (
            <CardFooter className="pt-0">
              <div className="w-full">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Concluídas:</span>
                  <span>
                    {completionData[card.type as keyof CompletionData].completed} / {completionData[card.type as keyof CompletionData].count}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${card.type === 'receita' ? 'bg-green-600' :
                                card.type === 'despesa' ? 'bg-red-600' : 'bg-blue-600'}`}
                    style={{ width: `${completionData[card.type as keyof CompletionData].percentage}%` }}
                  ></div>
                </div>
                <div className="text-right text-sm text-gray-500 mt-1">
                  {completionData[card.type as keyof CompletionData].percentage}%
                </div>
              </div>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}