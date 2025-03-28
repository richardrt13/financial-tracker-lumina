import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";
import { transactionEvents } from '@/lib/transactionEvents';
import { 
  Transaction, 
  TransactionsData, 
  SummaryData, 
  CompletionData, 
  DueSoonData,
  months 
} from '../types';

export const useDashboardData = (userId: string | null) => {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth() + 1]);
  const [isLoading, setIsLoading] = useState(true);
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

  const sortTransactionsByDueDay = (transactions: Transaction[]) => {
    return [...transactions].sort((a, b) => {
      if (!a.due_day) return 1;
      if (!b.due_day) return -1;
      return a.due_day - b.due_day;
    });
  };

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
      const currentMonthName = months[currentMonth];
      const currentYear = today.getFullYear().toString();
      
      let dueSoonTransactions: Transaction[] = [];
      let dueSoonAmount = 0;
      
      data?.forEach((transaction: Transaction) => {
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

  useEffect(() => {
    if (userId) {
      fetchData();
      fetchAllHistoricalData();
    }
  }, [fetchData, fetchAllHistoricalData, userId]);

  useEffect(() => {
    const unsubscribe = transactionEvents.subscribe(() => {
      fetchData();
    });
    
    return () => {
      unsubscribe();
    };
  }, [fetchData]);

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

  const checkSupabaseConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('count').limit(1);
      if (error) {
        console.error('Erro de conexão com Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Falha ao verificar conexão com Supabase:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    checkSupabaseConnection()
      .then(connected => {
        if (!connected) {
          toast({
            title: "Problemas de Conexão",
            description: "Não foi possível conectar ao banco de dados. Verifique sua conexão.",
            variant: "destructive"
          });
        }
      });
  }, [checkSupabaseConnection]);

  return {
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    isLoading,
    summaryData,
    completionData,
    transactionsData,
    dueSoonData,
    allTransactionsHistory,
    fetchData,
    fetchAllHistoricalData
  };
};
