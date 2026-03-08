import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, AlertTriangle, Settings2 } from 'lucide-react';
import { Transaction } from '../types';

interface CategoryLimit {
  id: string;
  category: string;
  monthly_limit: number;
  alert_threshold: number;
}

interface CategoryLimitsProps {
  budgetId: string;
  userId: string;
  transactions: Transaction[];
}

export function CategoryLimits({ budgetId, userId, transactions }: CategoryLimitsProps) {
  const [limits, setLimits] = useState<CategoryLimit[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    fetchLimits();
  }, [budgetId, userId]);

  const fetchLimits = async () => {
    const { data } = await supabase
      .from('category_budgets')
      .select('*')
      .eq('budget_id', budgetId)
      .eq('user_id', userId);
    setLimits(data || []);
  };

  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter(t => t.type === 'despesa')
      .forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return map;
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const allCats = new Set<string>();
    transactions.forEach(t => {
      if (t.type === 'despesa') allCats.add(t.category);
    });
    const existingCats = new Set(limits.map(l => l.category));
    return Array.from(allCats).filter(c => !existingCats.has(c));
  }, [transactions, limits]);

  const handleAdd = async () => {
    if (!newCategory || !newLimit) return;
    const { error } = await supabase.from('category_budgets').insert({
      user_id: userId,
      budget_id: budgetId,
      category: newCategory,
      monthly_limit: parseFloat(newLimit),
      alert_threshold: 80,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar o limite.', variant: 'destructive' });
    } else {
      toast({ title: 'Limite definido!' });
      setIsDialogOpen(false);
      setNewCategory('');
      setNewLimit('');
      fetchLimits();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('category_budgets').delete().eq('id', id);
    fetchLimits();
  };

  if (limits.length === 0 && availableCategories.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Limites por Categoria
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1">
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {limits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Defina limites de gasto por categoria para controlar suas despesas.
          </p>
        ) : (
          limits.map(limit => {
            const spent = categorySpending.get(limit.category) || 0;
            const percentage = Math.min(100, (spent / limit.monthly_limit) * 100);
            const isWarning = percentage >= limit.alert_threshold;
            const isOver = percentage >= 100;

            let barColor = 'bg-green-500';
            let textColor = 'text-green-600';
            if (isOver) { barColor = 'bg-red-500'; textColor = 'text-red-600'; }
            else if (isWarning) { barColor = 'bg-amber-500'; textColor = 'text-amber-600'; }

            return (
              <div key={limit.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    {isOver && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    <span className="font-medium">{limit.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${textColor}`}>
                      R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} / R$ {limit.monthly_limit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(limit.id)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Limite de Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                type="number"
                placeholder="Limite mensal (R$)"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newCategory || !newLimit}>Definir Limite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
