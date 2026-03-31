import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Loader2, ListChecks } from "lucide-react";
import { FinancialAssistantChatV2 } from '@/components/FinancialAssistantChatV2';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button"; 
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

import { FilterControls } from './ui/FilterControls';
import { SummaryCards } from './ui/SummaryCards';
import { HealthScore } from './ui/HealthScore';
import { MonthlyTrendChart } from './ui/MonthlyTrendChart';
import { CategoryBreakdownChart } from './ui/CategoryBreakdownChart';
import { CashFlowChart } from './ui/CashFlowChart';
import { ProactiveInsights } from './ui/ProactiveInsights';
import { CategoryLimits } from './ui/CategoryLimits';
import { PredictiveBudget } from './ui/PredictiveBudget';
import { TransactionDetailsDialog } from './dialogs/TransactionDetailsDialog';
import { EditTransactionDialog } from './dialogs/EditTransactionDialog';
import { DeleteTransactionDialog } from './dialogs/DeleteTransactionDialog';
import { DueSoonDialog } from './dialogs/DueSoonDialog';
import { BatchManagementDialog } from './dialogs/BatchManagementDialog';

import { useTransactionData } from './hooks/useTransactionData';
import { useTransactionActions } from './hooks/useTransactionActions';
import { Transaction } from './types';

interface DashboardProps {
  budgetId: string;
}

export function Dashboard({ budgetId }: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDueSoonDialogOpen, setIsDueSoonDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [valuesVisible] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    fetchUser();
  }, []);

  const {
    isLoading,
    summaryData,
    completionData,
    transactionsData,
    dueSoonData,
    allTransactionsHistory,
    fetchData,
    fetchAllHistoricalData,
  } = useTransactionData(userId, budgetId, dateRange);

  const {
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
  } = useTransactionActions(userId, budgetId, fetchData);

  const handleBatchDataChanged = useCallback(async () => {
    await Promise.all([fetchData(), fetchAllHistoricalData()]);
  }, [fetchData, fetchAllHistoricalData]);

  const handleCardClick = useCallback((type: string) => {
    if (type !== 'saldo') {
      setSelectedType(type);
      setIsDialogOpen(true);
    }
  }, []);

  const saveEditTransaction = useCallback(async () => {
    const success = await handleEditTransaction();
    if (success) {
      setIsEditDialogOpen(false);
    }
  }, [handleEditTransaction]);

  const deleteTransaction = useCallback(async () => {
    const success = await handleDeleteTransaction();
    if (success) {
      setIsDeleteDialogOpen(false);
    }
  }, [handleDeleteTransaction]);

  const handleEditDialogTransition = useCallback((transaction: Transaction) => {
    handleEditClick(transaction);
    setIsEditDialogOpen(true);
  }, [handleEditClick]);

  const handleDeleteDialogTransition = useCallback((transaction: Transaction) => {
    handleDeleteClick(transaction);
    setIsDeleteDialogOpen(true);
  }, [handleDeleteClick]);

  const checkSupabaseConnection = useCallback(async () => {
    try {
      const { error } = await supabase.from('transactions').select('count').limit(1);
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

  const selectedTypeTransactions = useMemo(() => {
    return selectedType ? transactionsData[selectedType] : [];
  }, [selectedType, transactionsData]);

  const allCurrentTransactions = useMemo(() => {
    return [
      ...transactionsData.receita,
      ...transactionsData.despesa,
      ...transactionsData.investimento,
    ];
  }, [transactionsData]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Dashboard Financeiro</h2>
          <p className="text-sm text-muted-foreground">
             Visão geral das suas finanças
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setIsBatchDialogOpen(true)}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Gestão em Lote</span>
            </Button>
            <FilterControls 
            dateRange={dateRange}
            setDateRange={setDateRange}
            />
        </div>
      </div>

      {isLoading && !isProcessing ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          <ProactiveInsights
            summaryData={summaryData}
            completionData={completionData}
            transactions={allCurrentTransactions}
            allTransactions={allTransactionsHistory}
          />

          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-3">
            <HealthScore
              summaryData={summaryData}
              completionData={completionData}
              allTransactions={allCurrentTransactions}
              budgetId={budgetId}
              userId={userId}
            />
            <SummaryCards
              summaryData={summaryData}
              completionData={completionData}
              onCardClick={handleCardClick}
              valuesVisible={valuesVisible}
              allTransactions={allTransactionsHistory}
              dateRange={dateRange}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MonthlyTrendChart allTransactions={allTransactionsHistory} />
            <CategoryBreakdownChart transactions={allCurrentTransactions} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <CashFlowChart transactions={allCurrentTransactions} />
            <PredictiveBudget
              summaryData={summaryData}
              allTransactions={allTransactionsHistory}
            />
            {userId && (
              <CategoryLimits
                budgetId={budgetId}
                userId={userId}
                transactions={allCurrentTransactions}
              />
            )}
          </div>
        </div>
      )}

      <TransactionDetailsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedType={selectedType}
        transactions={selectedTypeTransactions}
        dateRange={dateRange}
        onEditClick={handleEditDialogTransition}
        onDeleteClick={handleDeleteDialogTransition}
        onToggleStatus={toggleTransactionStatus}
        isProcessing={isProcessing}
        valuesVisible={valuesVisible}
      />

      <EditTransactionDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={editFormData}
        onFormChange={setEditFormData}
        onSave={saveEditTransaction}
        isProcessing={isProcessing}
        availableIncomes={availableIncomesForEdit}
        transactionType={selectedTransaction?.type}
      />

      <DeleteTransactionDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDelete={deleteTransaction}
        isProcessing={isProcessing}
      />

      <DueSoonDialog
        isOpen={isDueSoonDialogOpen}
        onOpenChange={setIsDueSoonDialogOpen}
        dueSoonData={dueSoonData}
        onEditClick={handleEditDialogTransition}
        onDeleteClick={handleDeleteDialogTransition}
        onToggleStatus={toggleTransactionStatus}
        isProcessing={isProcessing}
      />

      <BatchManagementDialog
        isOpen={isBatchDialogOpen}
        onOpenChange={setIsBatchDialogOpen}
        transactions={allTransactionsHistory}
        budgetId={budgetId}
        onDataChanged={handleBatchDataChanged}
      />

      <FinancialAssistantChatV2 />
    </div>
  );
}
