import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Lightbulb, Info, Sparkles } from 'lucide-react';
import { SummaryData, CompletionData, Transaction } from '../types';

interface ProactiveInsightsProps {
  summaryData: SummaryData;
  completionData: CompletionData;
  allTransactions: Transaction[];
}

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  message: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
}

function generateInsights(
  summaryData: SummaryData,
  completionData: CompletionData,
  allTransactions: Transaction[]
): Insight[] {
  const insights: Insight[] = [];
  const { receita, despesa, investimento } = summaryData;

  const savingsRate = receita > 0 ? ((receita - despesa - investimento) / receita) * 100 : 0;
  if (savingsRate >= 30) {
    insights.push({ type: 'success', message: `Incrível! Você está poupando ${savingsRate.toFixed(0)}% da renda. Continue assim!`, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/40' });
  } else if (savingsRate < 10 && receita > 0) {
    insights.push({ type: 'warning', message: `Atenção: taxa de poupança está em ${savingsRate.toFixed(0)}%. O ideal é acima de 20%.`, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 border-amber-200/60 dark:bg-amber-950/30 dark:border-amber-800/40' });
  }

  const investmentRate = receita > 0 ? (investimento / receita) * 100 : 0;
  if (investmentRate >= 15) {
    insights.push({ type: 'success', message: `${investmentRate.toFixed(0)}% da renda em investimentos. Excelente estratégia!`, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/40' });
  } else if (investmentRate < 5 && receita > 0) {
    insights.push({ type: 'tip', message: 'Considere investir pelo menos 10% da renda para fortalecer seu futuro.', icon: Lightbulb, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 border-violet-200/60 dark:bg-violet-950/30 dark:border-violet-800/40' });
  }

  const totalCount = completionData.receita.count + completionData.despesa.count + completionData.investimento.count;
  const totalCompleted = completionData.receita.completed + completionData.despesa.completed + completionData.investimento.completed;
  const pendingCount = totalCount - totalCompleted;
  if (pendingCount > 0) {
    insights.push({ type: 'info', message: `Você tem ${pendingCount} transaç${pendingCount === 1 ? 'ão' : 'ões'} pendente${pendingCount === 1 ? '' : 's'} para confirmar.`, icon: Info, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 border-sky-200/60 dark:bg-sky-950/30 dark:border-sky-800/40' });
  }

  if (insights.length === 0) {
    insights.push({ type: 'success', message: 'Suas finanças estão em dia! Continue acompanhando seus gastos.', icon: Sparkles, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/40' });
  }

  return insights.slice(0, 3);
}

export function ProactiveInsights({ summaryData, completionData, allTransactions }: ProactiveInsightsProps) {
  const insights = useMemo(
    () => generateInsights(summaryData, completionData, allTransactions),
    [summaryData, completionData, allTransactions]
  );

  return (
    <div className="space-y-2 stagger-children">
      {insights.map((insight, idx) => {
        const Icon = insight.icon;
        return (
          <div
            key={idx}
            className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${insight.bgColor}`}
          >
            <div className="shrink-0 mt-0.5">
              <Icon className={`h-4 w-4 ${insight.color}`} />
            </div>
            <p className="text-xs leading-relaxed font-medium">{insight.message}</p>
          </div>
        );
      })}
    </div>
  );
}
