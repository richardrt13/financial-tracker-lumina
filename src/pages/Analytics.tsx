import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area, Tooltip, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Transaction } from '@/components/dashboard/types';
import { formatCurrency } from '@/components/dashboard/utils/formatters';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#a855f7'];

const trendConfig = {
  receita: { label: 'Receitas', color: '#22c55e' },
  despesa: { label: 'Despesas', color: '#ef4444' },
  saldo: { label: 'Saldo', color: '#8b5cf6' },
} satisfies ChartConfig;

const categoryConfig = {
  amount: { label: 'Valor', color: '#ef4444' },
} satisfies ChartConfig;

const Analytics = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<{ id: string; name: string }[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      const { data: budgetData } = await supabase
        .from('budgets')
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('order_position');
      
      if (budgetData) setBudgets(budgetData);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchTransactions = async () => {
      setIsLoading(true);
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order('date', { ascending: true });

      if (selectedBudgetId !== 'all') {
        query = query.eq('budget_id', selectedBudgetId);
      }

      const { data } = await query;
      setTransactions(data || []);
      setIsLoading(false);
    };
    fetchTransactions();
  }, [userId, selectedBudgetId, selectedYear]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const map = new Map<number, { receita: number; despesa: number }>();
    for (let i = 0; i < 12; i++) map.set(i, { receita: 0, despesa: 0 });

    transactions.forEach(t => {
      if (!t.date) return;
      const month = new Date(t.date + 'T00:00:00').getMonth();
      const entry = map.get(month)!;
      if (t.type === 'receita') entry.receita += t.amount;
      else if (t.type === 'despesa') entry.despesa += t.amount;
    });

    return Array.from(map.entries()).map(([month, data]) => ({
      month: MONTH_LABELS[month],
      receita: Math.round(data.receita),
      despesa: Math.round(data.despesa),
      saldo: Math.round(data.receita - data.despesa),
    }));
  }, [transactions]);

  // Category ranking
  const categoryRanking = useMemo(() => {
    const catMap = new Map<string, number>();
    transactions
      .filter(t => t.type === 'despesa')
      .forEach(t => catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount));
    
    return Array.from(catMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, amount], i) => ({
        category,
        amount: Math.round(amount),
        fill: COLORS[i % COLORS.length],
      }));
  }, [transactions]);

  // Monthly comparison
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentMonthData = { receita: 0, despesa: 0, investimento: 0 };
    const prevMonthData = { receita: 0, despesa: 0, investimento: 0 };

    transactions.forEach(t => {
      if (!t.date) return;
      const month = new Date(t.date + 'T00:00:00').getMonth();
      const target = month === currentMonth ? currentMonthData : month === currentMonth - 1 ? prevMonthData : null;
      if (!target) return;
      if (t.type === 'receita') target.receita += t.amount;
      else if (t.type === 'despesa') target.despesa += t.amount;
      else if (t.type === 'investimento') target.investimento += t.amount;
    });

    return { current: currentMonthData, previous: prevMonthData };
  }, [transactions]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    const dayMap = new Map<string, number>();
    transactions
      .filter(t => t.type === 'despesa' && t.date)
      .forEach(t => {
        dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
      });
    
    const maxAmount = Math.max(...dayMap.values(), 1);
    
    const months: { month: string; weeks: { day: string; amount: number; intensity: number }[][] }[] = [];
    for (let m = 0; m < 12; m++) {
      const weeks: { day: string; amount: number; intensity: number }[][] = [[]];
      const daysInMonth = new Date(parseInt(selectedYear), m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${selectedYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
        const amount = dayMap.get(dateStr) || 0;
        if (dayOfWeek === 0 && weeks[weeks.length - 1].length > 0) weeks.push([]);
        weeks[weeks.length - 1].push({
          day: dateStr,
          amount,
          intensity: amount / maxAmount,
        });
      }
      months.push({ month: MONTH_LABELS[m], weeks });
    }
    return months;
  }, [transactions, selectedYear]);

  // Totals
  const totals = useMemo(() => {
    let receita = 0, despesa = 0, investimento = 0;
    transactions.forEach(t => {
      if (t.type === 'receita') receita += t.amount;
      else if (t.type === 'despesa') despesa += t.amount;
      else if (t.type === 'investimento') investimento += t.amount;
    });
    return { receita, despesa, investimento, saldo: receita - despesa - investimento };
  }, [transactions]);

  const exportCSV = useCallback(() => {
    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status'];
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.category,
      t.description || '',
      t.amount.toString(),
      t.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendly-analytics-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions, selectedYear]);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  function ComparisonItem({ label, current, previous }: { label: string; current: number; previous: number }) {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isPositive = label === 'Despesas' ? change < 0 : change > 0;
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-3">
          <span className="font-medium">R$ {formatCurrency(current)}</span>
          {previous > 0 && (
            <span className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground">Análise detalhada das suas finanças</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Orçamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Annual Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Receitas', value: totals.receita, color: 'text-green-600' },
                  { label: 'Despesas', value: totals.despesa, color: 'text-red-600' },
                  { label: 'Investimentos', value: totals.investimento, color: 'text-blue-600' },
                  { label: 'Saldo', value: totals.saldo, color: 'text-purple-600' },
                ].map(item => (
                  <Card key={item.label}>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{item.label} ({selectedYear})</p>
                      <p className={`text-xl font-bold ${item.color}`}>R$ {formatCurrency(item.value)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Trend Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Tendência Anual - {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={trendConfig} className="aspect-[3/1] w-full">
                    <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aGradReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="aGradDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                      <Area type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#aGradReceita)" />
                      <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="url(#aGradDespesa)" />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Top Categorias de Despesa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryRanking.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem despesas no período</p>
                    ) : (
                      <ChartContainer config={categoryConfig} className="aspect-[4/3] w-full">
                        <BarChart data={categoryRanking} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                          <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                          <ChartTooltip content={<ChartTooltipContent formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`} />} />
                          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                            {categoryRanking.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Comparativo Mensal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 divide-y">
                      <ComparisonItem label="Receitas" current={monthlyComparison.current.receita} previous={monthlyComparison.previous.receita} />
                      <ComparisonItem label="Despesas" current={monthlyComparison.current.despesa} previous={monthlyComparison.previous.despesa} />
                      <ComparisonItem label="Investimentos" current={monthlyComparison.current.investimento} previous={monthlyComparison.previous.investimento} />
                      <ComparisonItem
                        label="Saldo"
                        current={monthlyComparison.current.receita - monthlyComparison.current.despesa - monthlyComparison.current.investimento}
                        previous={monthlyComparison.previous.receita - monthlyComparison.previous.despesa - monthlyComparison.previous.investimento}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Heatmap */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Mapa de Gastos - {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                    {heatmapData.map(monthData => (
                      <div key={monthData.month} className="space-y-1">
                        <p className="text-xs text-muted-foreground text-center font-medium">{monthData.month}</p>
                        <div className="flex flex-wrap gap-[2px] justify-center">
                          {monthData.weeks.flat().map((day, i) => (
                            <div
                              key={i}
                              className="w-2.5 h-2.5 rounded-[2px] border border-transparent"
                              style={{
                                backgroundColor: day.amount === 0
                                  ? 'hsl(var(--muted))'
                                  : `rgba(239, 68, 68, ${Math.max(0.15, day.intensity)})`,
                              }}
                              title={`${day.day}: R$ ${day.amount.toLocaleString('pt-BR')}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-3 text-xs text-muted-foreground">
                    <span>Menos</span>
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-[2px]"
                        style={{
                          backgroundColor: intensity === 0
                            ? 'hsl(var(--muted))'
                            : `rgba(239, 68, 68, ${Math.max(0.15, intensity)})`,
                        }}
                      />
                    ))}
                    <span>Mais</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Analytics;
