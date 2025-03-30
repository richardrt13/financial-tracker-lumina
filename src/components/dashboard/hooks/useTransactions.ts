import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { transactionEvents } from '@/lib/transactionEvents';
import { toast } from "@/components/ui/use-toast";
import { Transaction, TransactionsData, SummaryData, CompletionData, DueSoonData, EditFormData } from '../types';
import { sortTransactionsByDueDay, getVencimentoStatus, getCurrentMonthName } from '../utils/transactionUtils';

export const useTransactions = (userId: string | null, selectedYear: string, selectedMonth: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    receita: 0,
    despesa: 0,
    investimento: 0,
    saldo: 0,
  });
  const [completionData, setCompletionData] = useState<CompletionData>({
    receita: { count: 0, completed: 0, percentage: 0 },
    despesa: { count: 0, completed: 0, percentage: 0 },
    investimento: { count: 0, completed: 0, percentage: 0 },
  });
  const [transactionsData, setTransactionsData] = useState<TransactionsData>({
    receita: [],
    despesa: [],
    investimento: [],
  });
  const [dueSoonData, setDueSoonData] = useState<DueSoonData>({
    count: 0,
    amount: 0,
    transactions: [],
  });
  const [allTransactionsHistory, setAllTransactionsHistory] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });

  // Buscar histórico completo de transações
  const fetchAllHistoricalData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
        
      if (error) {
        console.error('Erro ao buscar histórico completo de transações:', error);
        return;
      }
      
      setAllTransactionsHistory(data || []);
    } catch (err) {
      console.error('Erro ao processar histórico completo:', err);
    }
  }, [userId]);

  // Função principal para buscar dados
  const fetchData = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('year', selectedYear);

      if (selectedMonth !== "Todos os Meses") {
        query = query.eq('month', selectedMonth);
      }

      const { data, error } = await query;
        
      if (error) {
        console.error('Erro ao buscar transações:', error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      const transactionsByType: TransactionsData = {
        receita: [],
        despesa: [],
        investimento: [],
      };
      
      let totalReceita = 0;
      let totalDespesa = 0;
      let totalInvestimento = 0;
      
      const completion: CompletionData = {
        receita: { count: 0, completed: 0, percentage: 0 },
        despesa: { count: 0, completed: 0, percentage: 0 },
        investimento: { count: 0, completed: 0, percentage: 0 },
      };
      
      // Verificar transações próximas do vencimento (próximos 7 dias)
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;
      const currentMonthName = getCurrentMonthName();
      const currentYear = today.getFullYear().toString();
      
      let dueSoonTransactions: Transaction[] = [];
      let dueSoonAmount = 0;
      
      data.forEach((transaction: Transaction) => {
        if (transaction.type === 'receita' || transaction.type === 'despesa' || transaction.type === 'investimento') {
          transactionsByType[transaction.type as keyof TransactionsData].push(transaction);
          
          completion[transaction.type as keyof CompletionData].count++;
          if (transaction.is_completed) {
            completion[transaction.type as keyof CompletionData].completed++;
          }
        }
        
        if (transaction.type === 'receita') {
          totalReceita += transaction.amount;
        } else if (transaction.type === 'despesa') {
          totalDespesa += transaction.amount;
        } else if (transaction.type === 'investimento') {
          totalInvestimento += transaction.amount;
        }
        
        // Verificar se a transação está próxima do vencimento
        if (
          transaction.due_day && 
          !transaction.is_completed && 
          (transaction.type === 'despesa' || transaction.type === 'investimento') &&
          transaction.month === currentMonthName &&
          transaction.year === currentYear &&
          transaction.due_day >= currentDay && 
          transaction.due_day <= currentDay + 7
        ) {
          dueSoonTransactions.push(transaction);
          dueSoonAmount += transaction.amount;
        }
      });
      
      const saldo = totalReceita - totalDespesa - totalInvestimento;
      
      Object.keys(completion).forEach(key => {
        const type = key as keyof CompletionData;
        const count = completion[type].count;
        const completed = completion[type].completed;
        completion[type].percentage = count ? Math.round((completed / count) * 100) : 0;
      });
      
      // Ordenar transações por data de vencimento
      transactionsByType.receita = sortTransactionsByDueDay(transactionsByType.receita);
      transactionsByType.despesa = sortTransactionsByDueDay(transactionsByType.despesa);
      transactionsByType.investimento = sortTransactionsByDueDay(transactionsByType.investimento);
      
      setTransactionsData(transactionsByType);
      setSummaryData({
        receita: totalReceita,
        despesa: totalDespesa,
        investimento: totalInvestimento,
        saldo: saldo,
      });
      setCompletionData(completion);
      setDueSoonData({
        count: dueSoonTransactions.length,
        amount: dueSoonAmount,
        transactions: dueSoonTransactions.sort((a, b) => (a.due_day || 0) - (b.due_day || 0))
      });
    } catch (err) {
      console.error('Erro ao processar dados:', err);
      toast({
        title: "Erro",
        description: "Falha ao processar os dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedYear, selectedMonth]);

  // Alternar status de uma transação (concluída/pendente)
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
        .eq('user_id', userId);
        
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

  // Editar uma transação
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
        .eq('user_id', userId);
        
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
    } catch (err) {
      console.error('Erro ao processar atualização:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Excluir uma transação
  const handleDeleteTransaction = async () => {
    if (!selectedTransaction || !userId) return;
    
    setIsProcessing(true);
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Erro ao excluir transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir a transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso!"
      });
  
      await fetchData();
    } catch (err) {
      console.error('Erro ao processar exclusão:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Hook para buscar dados quando usuário, ano ou mês mudarem
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [fetchData, userId, selectedYear, selectedMonth]);

  // Buscar histórico completo
  useEffect(() => {
    if (userId) {
      fetchAllHistoricalData();
    }
  }, [fetchAllHistoricalData, userId]);

  // Inscrever para eventos de transação
  useEffect(() => {
    const unsubscribe = transactionEvents.subscribe(() => {
      fetchData();
    });
    
    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  // Configurar inscrição para mudanças em tempo real
  useEffect(() => {
    if (!userId) return;
    
    const subscription = supabase
      .channel('transactions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`
      }, () => {
        fetchData();
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchData]);

  return {
    isLoading,
    isProcessing,
    summaryData,
    completionData,
    transactionsData,
    dueSoonData,
    allTransactionsHistory,
    selectedTransaction,
    editFormData,
    setSelectedTransaction,
    setEditFormData,
    fetchData,
    toggleTransactionStatus,
    handleEditTransaction,
    handleDeleteTransaction
  };
};
