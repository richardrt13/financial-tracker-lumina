import { useMemo } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, PiggyBank, Scale } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { SummaryData, CompletionData, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SummaryCardsProps {
  summaryData: SummaryData;
  completionData: CompletionData;
  onCardClick: (type: string) => void;
  valuesVisible: boolean;
  allTransactions?: Transaction[];
}

const summaryCards = [
  { title: "Receitas", type: "receita", icon: Wallet, sparkColor: "#22c55e", iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400", valueColor: "text-emerald-600 dark:text-emerald-400" },
  { title: "Despesas", type: "despesa", icon: CreditCard, sparkColor: "#ef4444", iconBg: "bg-red-100 dark:bg-red-900/30", iconColor: "text-red-600 dark:text-red-400", valueColor: "text-red-600 dark:text-red-400" },
  { title: "Investimentos", type: "investimento", icon: PiggyBank, sparkColor: "#8b5cf6", iconBg: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400", valueColor: "text-violet-600 dark:text-violet-400" },
  { title: "Saldo", type: "saldo", icon: Scale, sparkColor: "#f59e0b", iconBg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400", valueColor: "text-amber-600 dark:text-amber-400" },
];

function buildSparklineData(allTransactions: Transaction[], type: string): { value: number }[] {
  const monthlyMap = new Map<string, number>();
  allTransactions.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (type === 'saldo') {
      const current = monthlyMap.get(key) || 0;
      if (t.type === 'receita') monthlyMap.set(key, current + t.amount);
      else monthlyMap.set(key, current - t.amount);
    } else if (t.type === type) {
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + t.amount);
    }
  });
  return Array.from(monthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, value]) => ({ value: Math.round(value) }));
}

function calculateTrend(sparkData: { value: number }[]): { percentage: number; direction: 'up' | 'down' | 'stable' } {
  if (sparkData.length < 2) return { percentage: 0, direction: 'stable' };
  const current = sparkData[sparkData.length - 1].value;
  const previous = sparkData[sparkData.length - 2].value;
  if (previous === 0) return { percentage: 0, direction: 'stable' };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (Math.abs(pct) < 1) return { percentage: 0, direction: 'stable' };
  return { percentage: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' };
}

export function SummaryCards({
  summaryData,
  completionData,
  onCardClick,
  valuesVisible,
  allTransactions = [],
}: SummaryCardsProps) {
  const sparklines = useMemo(() => {
    if (!allTransactions.length) return {};
    return {
      receita: buildSparklineData(allTransactions, 'receita'),
      despesa: buildSparklineData(allTransactions, 'despesa'),
      investimento: buildSparklineData(allTransactions, 'investimento'),
      saldo: buildSparklineData(allTransactions, 'saldo'),
    };
  }, [allTransactions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
      {summaryCards.map((card) => {
        const sparkData = sparklines[card.type as keyof typeof sparklines] || [];
        const trend = calculateTrend(sparkData);
        const isTrendGood = card.type === 'despesa' ? trend.direction === 'down' : trend.direction === 'up';
        const IconComponent = card.icon;

        return (
          <Card
            key={card.type}
            className={`group overflow-hidden transition-all duration-300 hover:shadow-card-hover ${card.type !== 'saldo' ? 'cursor-pointer' : ''}`}
            onClick={() => card.type !== 'saldo' ? onCardClick(card.type) : null}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <IconComponent className={`h-4.5 w-4.5 ${card.iconColor}`} />
                </div>
                {trend.direction !== 'stable' && trend.percentage > 0 && (
                  <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${
                    isTrendGood
                      ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                      : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
                  }`}>
                    {isTrendGood ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {trend.percentage}%
                  </div>
                )}
              </div>

              <p className="text-xs font-medium text-muted-foreground mb-0.5">{card.title}</p>
              <p className={`text-xl font-bold tracking-tight ${card.valueColor}`}>
                {valuesVisible ? `R$ ${formatCurrency(summaryData[card.type as keyof SummaryData])}` : "R$ ••••"}
              </p>

              {sparkData.length >= 2 && (
                <div className="h-8 mt-2 -mx-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData}>
                      <Line type="monotone" dataKey="value" stroke={card.sparkColor} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {card.type !== 'saldo' && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>Concluídas</span>
                    <span className="font-bold tabular-nums">
                      {completionData[card.type as keyof CompletionData].completed}/{completionData[card.type as keyof CompletionData].count}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${completionData[card.type as keyof CompletionData].percentage}%`,
                        backgroundColor: card.sparkColor,
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
