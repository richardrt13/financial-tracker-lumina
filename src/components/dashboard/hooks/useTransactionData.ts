// useTransactionData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { transactionEvents } from '@/lib/transactionEvents';
import { toast } from "@/components/ui/use-toast";
import { 
  Transaction, 
  TransactionsData, 
  SummaryData, 
  CompletionData, 
  DueSoonData 
} from '../types';
import { sortTransactionsByDueDay } from '../utils/helpers';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { DateRange } from "react-day-picker" // Add import
import { format } from "date-fns"; // Check utils

export const useTransactionData = (userId: string | null, budgetId: string | null, dateRange: DateRange | undefined) => {
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    receita: 0, despesa: 0, investimento: 0, saldo: 0,
  });
  const [completionData, setCompletionData] = useState<CompletionData>({
    receita: { count: 0, completed: 0, percentage: 0 },
    despesa: { count: 0, completed: 0, percentage: 0 },
    investimento: { count: 0, completed: 0, percentage: 0 },
  });
  const [transactionsData, setTransactionsData] = useState<TransactionsData>({
    receita: [], despesa: [], investimento: [],
  });
  const [dueSoonData, setDueSoonData] = useState<DueSoonData>({
    count: 0, amount: 0, transactions: [],
  });
  const [allTransactionsHistory, setAllTransactionsHistory] = useState<Transaction[]>([]);

  const fetchAllHistoricalData = useCallback(async () => {
    if (!userId || !budgetId) {
      // console.log("RT: fetchAllHistoricalData - Skipping, no userId or budgetId");
      setAllTransactionsHistory([]); // Clear history if no context
      return;
    }
    // console.log(`RT: fetchAllHistoricalData - Fetching for userId: ${userId}, budgetId: ${budgetId}`);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('budget_id', budgetId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) {
        console.error('RT: Erro ao buscar histórico completo de transações:', error);
        setAllTransactionsHistory([]);
        return;
      }
      setAllTransactionsHistory(data || []);
    } catch (err) { 
      console.error('RT: Erro ao processar histórico completo:', err);
      setAllTransactionsHistory([]);
    }
  }, [userId, budgetId]);

  const fetchData = useCallback(async () => {
    if (!userId || !budgetId || !dateRange || !dateRange.from) { // Check dateRange
      // console.log("RT: fetchData - Skipping, no userId or budgetId.");
      // Reset states to avoid showing stale data from a previous budget
      setTransactionsData({ receita: [], despesa: [], investimento: [] });
      setSummaryData({ receita: 0, despesa: 0, investimento: 0, saldo: 0 });
      setCompletionData({
        receita: { count: 0, completed: 0, percentage: 0 },
        despesa: { count: 0, completed: 0, percentage: 0 },
        investimento: { count: 0, completed: 0, percentage: 0 },
      });
      setDueSoonData({ count: 0, amount: 0, transactions: [] });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('budget_id', budgetId)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd')); // Filter by date range start

      if (dateRange.to) {
         query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd')); // Filter by date range end
      } else {
         query = query.lte('date', format(dateRange.from, 'yyyy-MM-dd')); // Single day fallback if 'to' is undefined
      }

      const { data: rawTransactions, error } = await query;

      if (error) {
        console.error("RT: Erro ao buscar transações:", error.message);
        toast({ title: "Erro ao Carregar Dados", description: error.message, variant: "destructive" });
        throw error; // Re-throw para ser pego pelo catch geral e parar o loading
      }

      const transactionsForPeriod: Transaction[] = rawTransactions || [];

      const linkedAmountsMap = new Map<string, number>();
      transactionsForPeriod.forEach(transaction => {
        if ((transaction.type === 'despesa' || transaction.type === 'investimento') && transaction.linked_income_id) {
          const currentLinkedAmount = linkedAmountsMap.get(transaction.linked_income_id) || 0;
          linkedAmountsMap.set(transaction.linked_income_id, currentLinkedAmount + transaction.amount);
        }
      });

      const enrichedDataPromises = transactionsForPeriod.map(async (transaction: Transaction) => {
        const enrichedTransaction = { ...transaction };

        if ((transaction.type === 'despesa' || transaction.type === 'investimento') && transaction.linked_income_id) {
            const { data: linkedIncome, error: linkedIncomeError } = await supabase
                .from('transactions')
                .select('description, category, amount')
                .eq('id', transaction.linked_income_id)
                .single();
            if (linkedIncomeError && linkedIncomeError.code !== 'PGRST116') { // PGRST116: 0 rows
                console.warn(`RT: Não foi possível buscar a receita vinculada ${transaction.linked_income_id}:`, linkedIncomeError.message);
            } else if (linkedIncome) {
                enrichedTransaction.linked_income_details = linkedIncome as any;
            }
        }
        
        if (transaction.type === 'receita') {
            const totalLinkedToThisIncome = linkedAmountsMap.get(String(transaction.id)) || 0;
            enrichedTransaction.remaining_after_links = transaction.amount - totalLinkedToThisIncome;
        }
        return enrichedTransaction;
      });

      const enrichedData = await Promise.all(enrichedDataPromises);

      const newTransactionsData: TransactionsData = { receita: [], despesa: [], investimento: [] };
      let totalReceita = 0, totalDespesa = 0, totalInvestimento = 0;
      const newCompletionData: CompletionData = {
        receita: { count: 0, completed: 0, percentage: 0 },
        despesa: { count: 0, completed: 0, percentage: 0 },
        investimento: { count: 0, completed: 0, percentage: 0 },
      };
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonthIndex = today.getMonth();
      const monthsList = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const currentMonthName = monthsList[currentMonthIndex];
      const currentYearStr = today.getFullYear().toString();
      const newDueSoonTransactions: Transaction[] = [];
      let newDueSoonAmount = 0;

      enrichedData.forEach((transaction: Transaction) => {
        const typeKey = transaction.type as keyof TransactionsData;
        if (newTransactionsData[typeKey]) {
            newTransactionsData[typeKey].push(transaction);
        }

        const completionTypeKey = transaction.type as keyof CompletionData;
        if (newCompletionData[completionTypeKey]) {
            newCompletionData[completionTypeKey].count++;
            if (transaction.is_completed) {
                newCompletionData[completionTypeKey].completed++;
            }
        }
        
        if (transaction.type === 'receita') totalReceita += transaction.amount;
        else if (transaction.type === 'despesa') totalDespesa += transaction.amount;
        else if (transaction.type === 'investimento') totalInvestimento += transaction.amount;

        if (transaction.due_day && !transaction.is_completed && 
            (transaction.type === 'despesa' || transaction.type === 'investimento') &&
            transaction.month === currentMonthName && transaction.year === currentYearStr &&
            transaction.due_day >= currentDay && transaction.due_day <= currentDay + 7) {
          newDueSoonTransactions.push(transaction);
          newDueSoonAmount += transaction.amount;
        }
      });

      Object.keys(newCompletionData).forEach(key => {
        const type = key as keyof CompletionData;
        const count = newCompletionData[type].count;
        const completed = newCompletionData[type].completed;
        newCompletionData[type].percentage = count ? Math.round((completed / count) * 100) : 0;
      });

      newTransactionsData.receita = sortTransactionsByDueDay(newTransactionsData.receita);
      newTransactionsData.despesa = sortTransactionsByDueDay(newTransactionsData.despesa);
      newTransactionsData.investimento = sortTransactionsByDueDay(newTransactionsData.investimento);

      setTransactionsData(newTransactionsData);
      setSummaryData({ receita: totalReceita, despesa: totalDespesa, investimento: totalInvestimento, saldo: totalReceita - totalDespesa - totalInvestimento });
      setCompletionData(newCompletionData);
      setDueSoonData({ count: newDueSoonTransactions.length, amount: newDueSoonAmount, transactions: sortTransactionsByDueDay(newDueSoonTransactions) });

    } catch (err: any) {
      // Error already toasted if it's from Supabase query
      if (!err.message?.includes("Erro ao buscar transações")) { // Avoid double toasting
        toast({ title: "Erro ao Processar Dados", description: (err as Error).message || "Falha ao processar dados.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, budgetId, dateRange]); // Update dependency

  useEffect(() => { 
    // console.log("RT: fetchData or its deps changed, re-evaluating data fetch.");
    if (userId && budgetId) fetchData(); 
  }, [fetchData, userId, budgetId]); // fetchData is the main trigger here which includes other deps
  
  useEffect(() => { 
    // console.log("RT: fetchAllHistoricalData or its deps changed, re-evaluating history fetch.");
    if (userId && budgetId) fetchAllHistoricalData(); 
  }, [fetchAllHistoricalData, userId, budgetId]); // Same here
  
  useEffect(() => {
    // console.log("RT: Setting up transactionEvents subscription.");
    const unsubscribe = transactionEvents.subscribe(() => {
      // console.log("RT: transactionEvents notified.");
      if (userId && budgetId) {
        // console.log("RT: Refetching data due to transactionEvents.");
        fetchData();
        fetchAllHistoricalData();
      } else {
        // console.log("RT: Not refetching from transactionEvents, no userId or budgetId.");
      }
    });
    return () => {
      // console.log("RT: Cleaning up transactionEvents subscription.");
      unsubscribe();
    };
  }, [fetchData, fetchAllHistoricalData, userId, budgetId]);

  useEffect(() => {
    if (!userId || !budgetId) {
      // console.log(`RT: [${budgetId || 'N/A'}] Skipping Realtime subscription, missing userId or budgetId.`);
      return () => {}; // Return an empty cleanup function if not subscribing
    }

    const channelName = `realtime:transactions:budget:${budgetId}`;
    // console.log(`RT: [${budgetId}] Attempting to set up Realtime subscription for channel: ${channelName}. User: ${userId}`);
    
    let channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true }, // Request acknowledgment for broadcast messages
      },
    });

    const pgChangesCallback = (payload: RealtimePostgresChangesPayload<{[key: string]: any }>) => {
      // console.log(`RT: [${budgetId}] Postgres Change received on ${channelName}`, payload);
      
      // Check if the changed record (new or old) belongs to the current budget
      // This client-side check is a safeguard; RLS and channel filters should primarily handle this.
      const record = payload.new || payload.old;
      if (record && typeof record === 'object' && 'budget_id' in record && String((record as Transaction).budget_id) === String(budgetId)) {
        // console.log(`RT: [${budgetId}] Relevant change detected, refetching data.`);
        fetchData();
        fetchAllHistoricalData();
      } else {
        // console.log(`RT: [${budgetId}] Change detected, but not for the current budget or malformed. budget_id in record: ${record ? (record as any).budget_id : 'N/A'}`);
      }
    };

    channel = channel.on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'transactions', 
        // Filter directly on the subscription for efficiency
        // RLS policies on Supabase should enforce user_id security
        filter: `budget_id=eq.${budgetId}` 
      }, 
      pgChangesCallback
    );

    channel.subscribe((status, err) => {
      // console.log(`RT: [${budgetId}] Subscription status for ${channelName}: ${status}`);
      if (status === 'SUBSCRIBED') {
        // console.log(`RT: [${budgetId}] Successfully subscribed to ${channelName}`);
      } else if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error(`RT: [${budgetId}] Subscription event/error for ${channelName}: Status: ${status}`, err || '');
        // Optional: Implement robust retry logic here for TIMED_OUT or CHANNEL_ERROR
      }
    });

    return () => {
      // console.log(`RT: [${budgetId}] Cleaning up Realtime subscription for ${channelName}`);
      if (channel) {
        supabase.removeChannel(channel)
          .then(() => { // Removed unused removeStatus
            // console.log(`RT: [${budgetId}] Channel ${channelName} removed with status: ${removeStatus}`);
          })
          .catch(removeError => {
            console.error(`RT: [${budgetId}] Error removing channel ${channelName}:`, removeError);
          });
      }
    };
  }, [userId, budgetId, fetchData, fetchAllHistoricalData]); // Dependencies that define the subscription's context


  return { isLoading, summaryData, completionData, transactionsData, dueSoonData, allTransactionsHistory, fetchData };
};