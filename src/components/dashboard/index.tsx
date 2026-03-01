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

  // Memoize the selected type transactions to avoid unnecessary recalculations
  const selectedTypeTransactions = useMemo(() => {
    return selectedType ? transactionsData[selectedType] : [];
  }, [selectedType, transactionsData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h2>
          <p className="text-muted-foreground">
             Visão geral das suas finanças
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsBatchDialogOpen(true)}
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Gestão em Lote</span>
            </Button>
            <FilterControls 
            dateRange={dateRange}
            setDateRange={setDateRange}
            />
        </div>
      </div>

      {isLoading && !isProcessing ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <SummaryCards
          summaryData={summaryData}
          completionData={completionData}
          onCardClick={handleCardClick}
          valuesVisible={valuesVisible}
        />
      )}

      <TransactionDetailsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedType={selectedType}
        transactions={selectedTypeTransactions}
        dateRange={dateRange} // Update prop
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

      {/* Assistente Financeiro Inteligente V2 */}
      <FinancialAssistantChatV2 />
    </div>
  );
}