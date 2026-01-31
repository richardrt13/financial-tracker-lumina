import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { FinancialAssistantChat } from '@/components/FinancialAssistantChat';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button"; 

import { FilterControls } from './ui/FilterControls';
import { SummaryCards } from './ui/SummaryCards';
import { DueSoonAlert } from './ui/DueSoonAlert';
import { TransactionDetailsDialog } from './dialogs/TransactionDetailsDialog';
import { EditTransactionDialog } from './dialogs/EditTransactionDialog';
import { DeleteTransactionDialog } from './dialogs/DeleteTransactionDialog';
import { DueSoonDialog } from './dialogs/DueSoonDialog';

import { useTransactionData } from './hooks/useTransactionData';
import { useTransactionActions } from './hooks/useTransactionActions';
import { Transaction } from './types';

interface DashboardProps {
  budgetId: string;
}

export function Dashboard({ budgetId }: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentMonthIndex = new Date().getMonth();
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[currentMonthIndex];
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDueSoonDialogOpen, setIsDueSoonDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [valuesVisible, setValuesVisible] = useState(true);

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
    fetchData
  } = useTransactionData(userId, budgetId, selectedYear, selectedMonth);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <FilterControls
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setValuesVisible(!valuesVisible)}
          >
            {valuesVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <DueSoonAlert
            dueSoonData={dueSoonData}
            onShowDetails={() => setIsDueSoonDialogOpen(true)}
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
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
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
        valuesVisible={valuesVisible}
      />


      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Assistente Financeiro</CardTitle>
          <CardDescription>
            Converse com nosso assistente para obter insights sobre suas finanças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialAssistantChat
            summaryData={summaryData}
            transactionsData={transactionsData}
            completionData={completionData}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            allTransactionsHistory={allTransactionsHistory || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}