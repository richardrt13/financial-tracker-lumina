import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Transaction } from '../types';

interface CashFlowChartProps {
  transactions: Transaction[];
}

const chartConfig = {
  entrada: { label: 'Entradas', color: '#22c55e' },
  saida: { label: 'Saídas', color: '#ef4444' },
} satisfies ChartConfig;

export function CashFlowChart({ transactions }: CashFlowChartProps) {
  const chartData = useMemo(() => {
    const weekMap = new Map<string, { entrada: number; saida: number }>();

    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date + 'T00:00:00');
      const weekNum = Math.ceil(d.getDate() / 7);
      const key = `S${weekNum}`;
      if (!weekMap.has(key)) {
        weekMap.set(key, { entrada: 0, saida: 0 });
      }
      const entry = weekMap.get(key)!;
      if (t.type === 'receita') {
        entry.entrada += t.amount;
      } else {
        entry.saida += t.amount;
      }
    });

    return ['S1', 'S2', 'S3', 'S4', 'S5']
      .filter(k => weekMap.has(k))
      .map(key => ({
        week: key,
        entrada: Math.round(weekMap.get(key)!.entrada),
        saida: Math.round(weekMap.get(key)!.saida) * -1,
      }));
  }, [transactions]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Fluxo de Caixa Semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Math.abs(v) / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
            <ReferenceLine y={0} className="stroke-muted-foreground" />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `R$ ${Math.abs(Number(value)).toLocaleString('pt-BR')}`} />}
            />
            <Bar dataKey="entrada" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saida" fill="#ef4444" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
