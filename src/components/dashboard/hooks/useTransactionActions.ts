// useTransactionActions.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";
import { Transaction, EditFormData } from '../types';

export const useTransactionActions = (userId: string | null, budgetId: string, fetchData: () => Promise<void>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });

  const handleEditClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditFormData({
      description: transaction.description || '',
      category: transaction.category,
      amount: transaction.amount.toString(),
      due_day: transaction.due_day ? transaction.due_day.toString() : ''
    });
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const toggleTransactionStatus = async (transaction: Transaction) => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para realizar esta ação.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const newStatus = !transaction.is_completed;
      
      const updateData: any = { 
        is_completed: newStatus 
      };
      
      if (newStatus) {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
      
      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId);
        
      if (error) {
        console.error('Erro ao atualizar status da transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o status da transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: `Transação marcada como ${newStatus ? 'concluída' : 'pendente'}!`
      });
      
      await fetchData();
    } catch (err) {
      console.error('Erro ao processar atualização de status:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleEditTransaction = async () => {
    if (!selectedTransaction || !userId) return;
    
    setIsProcessing(true);
    
    try {
      const amount = Number(editFormData.amount.replace(',', '.'));
      const dueDay = editFormData.due_day ? parseInt(editFormData.due_day) : null;
      
      if (isNaN(amount)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      if (dueDay !== null && (isNaN(dueDay) || dueDay < 1 || dueDay > 31)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um dia de vencimento válido (1-31).",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      const { error } = await supabase
        .from('transactions')
        .update({
          description: editFormData.description,
          category: editFormData.category,
          amount: amount,
          due_day: dueDay
        })
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .select();
        
      if (error) {
        console.error('Erro ao atualizar transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação atualizada com sucesso!"
      });
      
      await fetchData();
      
      return true; // Sucesso na edição
    } catch (err) {
      console.error('Erro ao processar atualização:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction || !userId) return;
    
    setIsProcessing(true);
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId);
        
      if (error) {
        console.error('Erro ao excluir transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir a transação: " + error.message,
          variant: "destructive"
        });
        return false;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso!"
      });
  
      await fetchData();
      return true; // Sucesso na exclusão
    } catch (err) {
      console.error('Erro ao processar exclusão:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
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
    handleDeleteTransaction
  };
};