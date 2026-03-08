import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Target, Loader2, Trash2, TrendingUp, Calendar, Award } from 'lucide-react';

interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category: string | null;
  icon: string | null;
  color: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

const GOAL_COLORS = [
  { value: '#22c55e', label: 'Verde' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
];

const GOAL_ICONS = [
  { value: 'home', label: 'Casa' },
  { value: 'car', label: 'Carro' },
  { value: 'plane', label: 'Viagem' },
  { value: 'graduation', label: 'Educação' },
  { value: 'piggy', label: 'Emergência' },
  { value: 'heart', label: 'Saúde' },
  { value: 'star', label: 'Outro' },
];

const Metas = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContribDialogOpen, setIsContribDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlySavings, setMonthlySavings] = useState(0);

  const [form, setForm] = useState({
    title: '',
    target_amount: '',
    deadline: '',
    category: '',
    color: '#3b82f6',
    icon: 'star',
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      await fetchGoals(session.user.id);
      await calculateMonthlySavings(session.user.id);
    };
    init();
  }, []);

  const fetchGoals = async (uid: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching goals:', error);
      setGoals([]);
    } else {
      setGoals(data || []);
    }
    setIsLoading(false);
  };

  const calculateMonthlySavings = async (uid: string) => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', uid)
      .gte('date', firstDay)
      .lte('date', lastDay);

    if (data) {
      let income = 0, expenses = 0;
      data.forEach(t => {
        if (t.type === 'receita') income += t.amount;
        else expenses += t.amount;
      });
      setMonthlySavings(Math.max(0, income - expenses));
    }
  };

  const handleCreateGoal = async () => {
    if (!userId || !form.title || !form.target_amount) return;

    const { error } = await supabase.from('goals').insert({
      user_id: userId,
      title: form.title,
      target_amount: parseFloat(form.target_amount),
      current_amount: 0,
      deadline: form.deadline || null,
      category: form.category || null,
      color: form.color,
      icon: form.icon,
      status: 'active',
    });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar a meta.', variant: 'destructive' });
    } else {
      toast({ title: 'Meta criada!', description: `"${form.title}" foi adicionada com sucesso.` });
      setIsDialogOpen(false);
      setForm({ title: '', target_amount: '', deadline: '', category: '', color: '#3b82f6', icon: 'star' });
      fetchGoals(userId);
    }
  };

  const handleContribute = async () => {
    if (!selectedGoal || !contribAmount || !userId) return;
    const amount = parseFloat(contribAmount);
    const newAmount = selectedGoal.current_amount + amount;
    const isCompleted = newAmount >= selectedGoal.target_amount;

    const { error } = await supabase
      .from('goals')
      .update({
        current_amount: newAmount,
        status: isCompleted ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedGoal.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível registrar a contribuição.', variant: 'destructive' });
    } else {
      if (isCompleted) {
        toast({ title: 'Meta atingida!', description: `Parabéns! Você completou a meta "${selectedGoal.title}"!` });
      } else {
        toast({ title: 'Contribuição registrada', description: `R$ ${amount.toLocaleString('pt-BR')} adicionados à meta.` });
      }
      setIsContribDialogOpen(false);
      setContribAmount('');
      fetchGoals(userId);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) return;
    const { error } = await supabase.from('goals').delete().eq('id', goalId);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir a meta.', variant: 'destructive' });
    } else {
      toast({ title: 'Meta excluída' });
      fetchGoals(userId);
    }
  };

  const getMonthsToGoal = (goal: Goal): string => {
    const remaining = goal.target_amount - goal.current_amount;
    if (remaining <= 0) return 'Concluída!';
    if (monthlySavings <= 0) return 'Defina uma economia mensal';
    const months = Math.ceil(remaining / monthlySavings);
    if (months === 1) return '~1 mês';
    if (months > 120) return '+10 anos';
    return months <= 12 ? `~${months} meses` : `~${Math.round(months / 12)} anos`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Metas Financeiras</h1>
              <p className="text-muted-foreground">Defina e acompanhe seus objetivos</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          </div>

          {/* Savings context card */}
          {monthlySavings > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Economia estimada este mês</p>
                  <p className="text-lg font-bold text-green-600">R$ {formatValue(monthlySavings)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma meta definida</h3>
                <p className="text-muted-foreground mb-4">Crie sua primeira meta financeira para começar a acompanhar seu progresso.</p>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Criar Meta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map(goal => {
                const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
                const remaining = Math.max(0, goal.target_amount - goal.current_amount);
                const isCompleted = goal.status === 'completed';

                return (
                  <Card key={goal.id} className={`relative overflow-hidden ${isCompleted ? 'border-green-300 dark:border-green-800' : ''}`}>
                    {isCompleted && (
                      <div className="absolute top-3 right-3">
                        <Award className="h-6 w-6 text-green-500" />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base pr-8">{goal.title}</CardTitle>
                      {goal.category && (
                        <p className="text-xs text-muted-foreground">{goal.category}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pb-2">
                      {/* Circular progress */}
                      <div className="flex items-center gap-4 mb-3">
                        <div className="relative flex-shrink-0">
                          <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                            <circle
                              cx="40" cy="40" r="32" fill="none"
                              stroke={goal.color}
                              strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 32}`}
                              strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress / 100)}`}
                              transform="rotate(-90 40 40)"
                              className="transition-all duration-700"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold">{Math.round(progress)}%</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Progresso</p>
                          <p className="font-bold" style={{ color: goal.color }}>
                            R$ {formatValue(goal.current_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            de R$ {formatValue(goal.target_amount)}
                          </p>
                          {!isCompleted && remaining > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Faltam R$ {formatValue(remaining)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Timeline estimate */}
                      {!isCompleted && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{getMonthsToGoal(goal)}</span>
                          {goal.deadline && (
                            <span className="ml-auto">
                              Prazo: {new Date(goal.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-2 gap-2">
                      {!isCompleted && (
                        <Button
                          size="sm"
                          className="flex-1"
                          style={{ backgroundColor: goal.color }}
                          onClick={() => { setSelectedGoal(goal); setIsContribDialogOpen(true); }}
                        >
                          + Contribuir
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Goal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Meta Financeira</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input
                placeholder="Ex: Fundo de emergência"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor alvo (R$)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={form.target_amount}
                onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Prazo (opcional)</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Input
                placeholder="Ex: Viagem, Emergência"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {GOAL_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateGoal} disabled={!form.title || !form.target_amount}>Criar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribute Dialog */}
      <Dialog open={isContribDialogOpen} onOpenChange={setIsContribDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contribuir para "{selectedGoal?.title}"</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              placeholder="500"
              value={contribAmount}
              onChange={e => setContribAmount(e.target.value)}
            />
            {selectedGoal && (
              <p className="text-sm text-muted-foreground mt-2">
                Faltam R$ {formatValue(Math.max(0, selectedGoal.target_amount - selectedGoal.current_amount))} para completar
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContribDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleContribute} disabled={!contribAmount || parseFloat(contribAmount) <= 0}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function formatValue(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default Metas;
