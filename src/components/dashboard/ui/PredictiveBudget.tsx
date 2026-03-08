import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SummaryData, Transaction } from '../types';

interface PredictiveBudgetProps {
  summaryData: SummaryData;
  allTransactions: Transaction[];
}

export function PredictiveBudget({ summaryData, allTransactions }: PredictiveBudgetProps) {
  const prediction = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = currentDay;
    const daysRemaining = daysInMonth - currentDay;

    if (daysElapsed < 3 || summaryData.despesa === 0) return null;

    const dailyRate = summaryData.despesa / daysElapsed;
    const projectedExpense = Math.round(dailyRate * daysInMonth);

    // Calculate historical average monthly expense
    const monthlyExpenses = new Map<string, number>();
    allTransactions.forEach(t => {
      if (t.type !== 'despesa' || !t.date) return;
      const d = new Date(t.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyExpenses.set(key, (monthlyExpenses.get(key) || 0) + t.amount);
    });

    const historicalValues = Array.from(monthlyExpenses.values());
    if (historicalValues.length < 2) return null;

    // Exclude current month from average
    const previousMonths = historicalValues.slice(0, -1);
    const avgExpense = previousMonths.reduce((a, b) => a + b, 0) / previousMonths.length;

    const projectedVsAvg = avgExpense > 0 ? ((projectedExpense - avgExpense) / avgExpense) * 100 : 0;
    const progress = (currentDay / daysInMonth) * 100;
    const spendProgress = Math.min(100, (summaryData.despesa / projectedExpense) * 100);

    return {
      projectedExpense,
      avgExpense: Math.round(avgExpense),
      projectedVsAvg,
      dailyRate: Math.round(dailyRate),
      daysRemaining,
      progress,
      spendProgress,
      remainingBudget: Math.round(summaryData.receita - projectedExpense),
    };
  }, [summaryData, allTransactions]);

  if (!prediction) return null;

  const isOverBudget = prediction.projectedVsAvg > 15;
  const isUnderBudget = prediction.projectedVsAvg < -5;

  return (
    <Card className={`border ${isOverBudget ? 'border-amber-200 dark:border-amber-800' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Projeção do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Projection bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Gasto atual</span>
            <span className="font-medium">
              R$ {summaryData.despesa.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="relative w-full bg-muted rounded-full h-3">
            <div
              className="h-3 rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${prediction.spendProgress}%` }}
            />
            {/* Projected line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-600"
              style={{ left: `${Math.min(100, (prediction.avgExpense / prediction.projectedExpense) * 100)}%` }}
              title={`Média: R$ ${prediction.avgExpense.toLocaleString('pt-BR')}`}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Projeção: R$ {prediction.projectedExpense.toLocaleString('pt-BR')}</span>
            <span>Média: R$ {prediction.avgExpense.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* Status message */}
        <div className={`flex items-start gap-2 p-2 rounded-md text-sm ${
          isOverBudget 
            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
            : isUnderBudget
              ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
        }`}>
          {isOverBudget ? (
            <>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Ritmo {Math.round(prediction.projectedVsAvg)}% acima da média. 
                Tente gastar no máximo R$ {Math.round(prediction.dailyRate * 0.8).toLocaleString('pt-BR')}/dia nos próximos {prediction.daysRemaining} dias.
              </span>
            </>
          ) : isUnderBudget ? (
            <>
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Ótimo ritmo! {Math.abs(Math.round(prediction.projectedVsAvg))}% abaixo da média. 
                Continue assim.
              </span>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Gastos dentro da média. Média diária: R$ {prediction.dailyRate.toLocaleString('pt-BR')}/dia.</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
