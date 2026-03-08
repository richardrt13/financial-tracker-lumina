import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Transaction } from '../types';

interface MonthlyTrendChartProps {
  allTransactions: Transaction[];
}

const chartConfig = {
  receita: { label: 'Receitas', color: '#22c55e' },
  despesa: { label: 'Despesas', color: '#ef4444' },
  saldo: { label: 'Saldo', color: '#8b5cf6' },
} satisfies ChartConfig;

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyTrendChart({ allTransactions }: MonthlyTrendChartProps) {
  const chartData = useMemo(() => {
    const monthlyMap = new Map<string, { receita: number; despesa: number; investimento: number }>();

    allTransactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { receita: 0, despesa: 0, investimento: 0 });
      }
      const entry = monthlyMap.get(key)!;
      if (t.type === 'receita') entry.receita += t.amount;
      else if (t.type === 'despesa') entry.despesa += t.amount;
      else if (t.type === 'investimento') entry.investimento += t.amount;
    });

    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, data]) => {
        const [, month] = key.split('-');
        return {
          month: MONTH_LABELS[parseInt(month) - 1],
          receita: Math.round(data.receita),
          despesa: Math.round(data.despesa),
          saldo: Math.round(data.receita - data.despesa - data.investimento),
        };
      });
  }, [allTransactions]);

  if (chartData.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Evolução Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />}
            />
            <Area type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#gradReceita)" />
            <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="url(#gradDespesa)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
