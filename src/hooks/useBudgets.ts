import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

export interface Budget {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  order_position: number;
}

export const useBudgets = (userId: string | null) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch budgets from database
  const fetchBudgets = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', uid)
        .order('order_position', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setBudgets(data);
        setSelectedBudgetId(data[0].id);
      } else {
        // Create default budget for new users
        await createDefaultBudget(uid);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os orçamentos.',
        variant: 'destructive',
      });
    }
  }, []);

  // Create default budget
  const createDefaultBudget = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          name: 'Casa',
          user_id: uid,
          order_position: 0,
        })
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setBudgets([data[0]]);
        setSelectedBudgetId(data[0].id);
      }
    } catch (error) {
      console.error('Error creating default budget:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o orçamento padrão.',
        variant: 'destructive',
      });
    }
  };

  // Add new budget
  const addBudget = async (name: string) => {
    if (!name.trim() || !userId) return false;

    setIsLoading(true);
    try {
      const nextPosition =
        budgets.length > 0 ? Math.max(...budgets.map((b: Budget) => b.order_position)) + 1 : 0;

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          name: name.trim(),
          user_id: userId,
          order_position: nextPosition,
        })
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setBudgets((prev: Budget[]) => [...prev, data[0]]);
        setSelectedBudgetId(data[0].id);
        toast({
          title: 'Sucesso',
          description: `Orçamento "${data[0].name}" adicionado com sucesso.`,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding budget:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o orçamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete budget
  const deleteBudget = async (budget: Budget) => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      // Delete all transactions associated with this budget
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('budget_id', budget.id);

      if (transactionsError) throw transactionsError;

      // Delete the budget
      const { error: budgetError } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budget.id)
        .eq('user_id', userId);

      if (budgetError) throw budgetError;

      // Update local state
      const updatedBudgets = budgets.filter((b: Budget) => b.id !== budget.id);
      setBudgets(updatedBudgets);

      // Select first budget if the deleted one was selected
      if (selectedBudgetId === budget.id && updatedBudgets.length > 0) {
        setSelectedBudgetId(updatedBudgets[0].id);
      }

      toast({
        title: 'Sucesso',
        description: `Orçamento "${budget.name}" excluído com sucesso.`,
      });
      return true;
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o orçamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Reorder budgets
  const reorderBudgets = async (newOrder: Budget[]) => {
    setIsLoading(true);
    try {
      const updates = newOrder.map((budget, index) => ({
        id: budget.id,
        order_position: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('budgets')
          .update({ order_position: update.order_position })
          .eq('id', update.id);

        if (error) throw error;
      }

      setBudgets(newOrder);
      toast({
        title: 'Sucesso',
        description: 'A ordem dos orçamentos foi atualizada.',
      });
      return true;
    } catch (error) {
      console.error('Error reordering budgets:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao salvar a ordem.',
        variant: 'destructive',
      });
      // Reload budgets on error
      if (userId) {
        await fetchBudgets(userId);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Load budgets on mount
  useEffect(() => {
    const loadBudgets = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await fetchBudgets(session.user.id);
      }
      setIsLoading(false);
    };

    loadBudgets();
  }, [fetchBudgets]);

  return {
    budgets,
    setBudgets,
    selectedBudgetId,
    setSelectedBudgetId,
    isLoading,
    addBudget,
    deleteBudget,
    reorderBudgets,
  };
};
