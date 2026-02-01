// useTransactionActions.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";
import { Transaction, EditFormData } from '../types';

const NONE_VALUE_MARKER = "__NONE_INCOME_LINK__"; // Consistent marker

export const useTransactionActions = (userId: string | null, budgetId: string, fetchData: () => Promise<void>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    description: '',
    category: '',
    amount: '',
    due_day: '',
    linked_income_id: null,
  });
  const [availableIncomesForEdit, setAvailableIncomesForEdit] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchIncomesForEdit = async () => {
      if (selectedTransaction && (selectedTransaction.type === 'despesa' || selectedTransaction.type === 'investimento') && userId && budgetId && selectedTransaction.month && selectedTransaction.year) {
        // Consider using a more specific loading state if isProcessing is too broad
        // setIsProcessing(true); 
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('id, description, category, amount')
            .eq('budget_id', budgetId)
            .eq('type', 'receita')
            .eq('month', selectedTransaction.month)
            .eq('year', selectedTransaction.year);

          if (error) throw error;
          setAvailableIncomesForEdit(data || []);
        } catch (err) {
          console.error("Error fetching incomes for edit dialog:", err);
          setAvailableIncomesForEdit([]);
          toast({ title: "Erro", description: "Não foi possível carregar receitas para vinculação na edição.", variant: "destructive" });
        } finally {
          // setIsProcessing(false);
        }
      } else {
        setAvailableIncomesForEdit([]);
      }
    };

    if (selectedTransaction) {
      fetchIncomesForEdit();
    }
  }, [selectedTransaction, userId, budgetId]);


  const handleEditClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction); 
    setEditFormData({
      description: transaction.description || '',
      category: transaction.category,
      amount: transaction.amount.toString().replace('.', ','),
      due_day: transaction.due_day ? transaction.due_day.toString() : '',
      linked_income_id: transaction.linked_income_id || null,
    });
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const toggleTransactionStatus = async (transaction: Transaction) => {
    if (!userId) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const newStatus = !transaction.is_completed;
      const updateData: any = { is_completed: newStatus, completed_at: newStatus ? new Date().toISOString() : null };
      const { error } = await supabase.from('transactions').update(updateData).eq('id', transaction.id).eq('budget_id', budgetId);
      if (error) throw error;
      toast({ title: "Sucesso", description: `Transação marcada como ${newStatus ? 'concluída' : 'pendente'}!` });
      supabase.functions.invoke('process-queue').catch(console.error);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: (err as Error).message || "Falha ao atualizar status.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditTransaction = async () => {
    if (!selectedTransaction || !userId) return false;
    setIsProcessing(true);
    try {
      const amount = Number(editFormData.amount.replace(',', '.'));
      const dueDay = editFormData.due_day ? parseInt(editFormData.due_day) : null;

      if (isNaN(amount) || amount <= 0) {
        toast({ title: "Erro de Validação", description: "O valor da transação deve ser um número positivo.", variant: "destructive" });
        setIsProcessing(false);
        return false;
      }
      if (dueDay !== null && (isNaN(dueDay) || dueDay < 1 || dueDay > 31)) {
        toast({ title: "Erro de Validação", description: "O dia de vencimento deve ser entre 1 e 31.", variant: "destructive" });
        setIsProcessing(false);
        return false;
      }

      const updatePayload: Partial<Transaction> = {
        description: editFormData.description,
        category: editFormData.category,
        amount: amount,
        due_day: dueDay,
      };

      if (selectedTransaction.type === 'despesa' || selectedTransaction.type === 'investimento') {
        updatePayload.linked_income_id = editFormData.linked_income_id ? String(editFormData.linked_income_id) : null;
      } else {
        updatePayload.linked_income_id = null; // Garantir que não-despesas/investimentos não tenham link
      }

      const { error } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', selectedTransaction.id)
        .eq('budget_id', budgetId);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Transação atualizada!" });
      await fetchData(); // Atualiza os dados na Dashboard
      setSelectedTransaction(null); // Limpa a transação selecionada
      return true;
    } catch (err: any) {
      toast({ title: "Erro ao Atualizar", description: (err as Error).message || "Falha ao atualizar transação.", variant: "destructive" });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction || !userId) return false;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTransaction.id).eq('budget_id', budgetId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Transação excluída!" });
      await fetchData(); // Atualiza os dados na Dashboard
      setSelectedTransaction(null); // Limpa a transação selecionada
      return true;
    } catch (err: any) {
      toast({ title: "Erro ao Excluir", description: (err as Error).message || "Falha ao excluir transação.", variant: "destructive" });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    selectedTransaction,
    editFormData,
    setEditFormData,
    handleEditClick,
    handleDeleteClick,
    toggleTransactionStatus,
    handleEditTransaction,
    handleDeleteTransaction,
    availableIncomesForEdit,
  };
};
