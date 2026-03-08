import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Transaction } from '../types';

interface CategoryBreakdownChartProps {
  transactions: Transaction[];
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];

export function CategoryBreakdownChart({ transactions }: CategoryBreakdownChartProps) {
  const { chartData, chartConfig, total } = useMemo(() => {
    const catMap = new Map<string, number>();
    transactions
      .filter(t => t.type === 'despesa')
      .forEach(t => {
        catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
      });

    const sorted = Array.from(catMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    const total = sorted.reduce((sum, [, val]) => sum + val, 0);

    const config: ChartConfig = {};
    const data = sorted.map(([category, amount], i) => {
      const key = category.toLowerCase().replace(/\s+/g, '_');
      config[key] = { label: category, color: COLORS[i % COLORS.length] };
      return {
        name: category,
        value: Math.round(amount),
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        fill: COLORS[i % COLORS.length],
      };
    });

    return { chartData: data, chartConfig: config, total };
  }, [transactions]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ChartContainer config={chartConfig} className="aspect-square w-[160px] flex-shrink-0">
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="flex-1 space-y-1.5 min-w-0">
            {chartData.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                <span className="truncate text-muted-foreground flex-1">{item.name}</span>
                <span className="font-medium tabular-nums text-xs">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
