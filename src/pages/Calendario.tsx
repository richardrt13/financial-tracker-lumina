import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Loader2, ArrowUpRight, ArrowDownRight, Repeat } from 'lucide-react';
import { Transaction } from '@/components/dashboard/types';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const Calendario = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<{ id: string; name: string }[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

      let query = supabase
        .from('transactions')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date');

      if (selectedBudgetId !== 'all') {
        query = query.eq('budget_id', selectedBudgetId);
      }

      const { data } = await query;
      setTransactions(data || []);
      setIsLoading(false);
    };
    fetchTransactions();
  }, [userId, year, month, selectedBudgetId]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const days: { date: string | null; day: number | null }[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) days.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d });
    }
    return days;
  }, [year, month]);

  // Group transactions by day
  const transactionsByDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (!t.date) return;
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    });
    return map;
  }, [transactions]);

  // Recurring transactions detection
  const recurringTransactions = useMemo(() => {
    const descMap = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      if (t.due_day && t.description) {
        const key = `${t.description}-${t.category}`;
        if (!descMap.has(key)) descMap.set(key, []);
        descMap.get(key)!.push(t);
      }
    });
    return Array.from(descMap.entries())
      .filter(([, txs]) => txs.length >= 1 && txs[0].due_day)
      .map(([, txs]) => txs[0]);
  }, [transactions]);

  // Upcoming due dates
  const upcomingDue = useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    return transactions
      .filter(t => t.due_day && !t.is_completed && t.due_day >= todayDay && (t.type === 'despesa' || t.type === 'investimento'))
      .sort((a, b) => (a.due_day || 0) - (b.due_day || 0));
  }, [transactions]);

  const selectedDayTransactions = selectedDay ? (transactionsByDay.get(selectedDay) || []) : [];

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Monthly totals
  const monthTotals = useMemo(() => {
    let receita = 0, despesa = 0;
    transactions.forEach(t => {
      if (t.type === 'receita') receita += t.amount;
      else if (t.type === 'despesa') despesa += t.amount;
    });
    return { receita, despesa };
  }, [transactions]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Calendário Financeiro</h1>
              <p className="text-muted-foreground">Visualize suas finanças no tempo</p>
            </div>
            <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Orçamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* Calendar */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle className="text-lg">
                    {MONTH_NAMES[month]} {year}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {DAY_NAMES.map(d => (
                        <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((dayInfo, i) => {
                        if (!dayInfo.date) {
                          return <div key={i} className="h-20 sm:h-24" />;
                        }
                        const dayTxs = transactionsByDay.get(dayInfo.date) || [];
                        const isToday = dayInfo.date === todayStr;
                        const hasReceita = dayTxs.some(t => t.type === 'receita');
                        const hasDespesa = dayTxs.some(t => t.type === 'despesa');
                        const hasInvestimento = dayTxs.some(t => t.type === 'investimento');
                        const dayTotal = dayTxs.reduce((sum, t) => {
                          return sum + (t.type === 'receita' ? t.amount : -t.amount);
                        }, 0);

                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedDay(dayInfo.date)}
                            className={`h-20 sm:h-24 p-1 rounded-md border text-left transition-colors hover:bg-accent ${
                              isToday ? 'border-primary bg-primary/5' : 'border-transparent'
                            } ${selectedDay === dayInfo.date ? 'ring-2 ring-primary' : ''}`}
                          >
                            <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                              {dayInfo.day}
                            </div>
                            {dayTxs.length > 0 && (
                              <div className="mt-0.5 space-y-0.5">
                                <div className="flex gap-0.5">
                                  {hasReceita && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                  {hasDespesa && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                  {hasInvestimento && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </div>
                                <div className={`text-[10px] font-medium ${dayTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {dayTotal >= 0 ? '+' : ''}{(dayTotal / 1000).toFixed(1)}k
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Receita</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Despesa</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Investimento</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Monthly summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resumo do Mês</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Receitas</span>
                    <span className="font-medium text-green-600">R$ {monthTotals.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Despesas</span>
                    <span className="font-medium text-red-600">R$ {monthTotals.despesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming due dates */}
              {upcomingDue.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Próximos Vencimentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {upcomingDue.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                            Dia {t.due_day}
                          </Badge>
                          <span className="truncate">{t.description || t.category}</span>
                        </div>
                        <span className="font-medium text-red-600 shrink-0 ml-2">
                          R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recurring transactions */}
              {recurringTransactions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="h-4 w-4" />
                      <CardTitle className="text-sm">Recorrentes</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recurringTransactions.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{t.description || t.category}</span>
                        <span className={`font-medium shrink-0 ml-2 ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay && new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedDayTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação neste dia</p>
            ) : (
              selectedDayTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.type === 'receita' ? (
                      <ArrowUpRight className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                      <p className="text-xs text-muted-foreground">{t.category}</p>
                    </div>
                  </div>
                  <span className={`font-medium shrink-0 ml-2 ${
                    t.type === 'receita' ? 'text-green-600' : t.type === 'investimento' ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {t.type === 'receita' ? '+' : '-'}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendario;
