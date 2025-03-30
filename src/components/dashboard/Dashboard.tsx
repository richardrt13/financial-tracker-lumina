import { useState, useEffect } from 'react';
import { transactionEvents } from '@/lib/transactionEvents';
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

import { useTransactions } from './hooks/useTransactions';
import { useAuthentication } from './hooks/useAuthentication';
import { useSupabaseConnection } from './hooks/useSupabaseConnection';

import { FilterBar } from './components/FilterBar';
import { SummaryCards } from './components/SummaryCards';
import { DueSoonAlert } from './components/DueSoonAlert';
import { TransactionsDialog } from './components/dialogs/TransactionsDialog';
import { DueSoonDialog } from './components/dialogs/DueSoonDialog';
import { EditDialog } from './components/dialogs/EditDialog';
import { DeleteDialog } from './components/dialogs/DeleteDialog';
import { FinancialAssistantChat } from '@/components/FinancialAssistantChat';

import { Transaction } from './types';

export function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12 para Janeiro-Dezembro, 0 para "Todos"
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDueSoonDialogOpen, setIsDueSoonDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });

  // Hooks personalizados
  const { userId } = useAuthentication();
  const { isConnected } = useSupabaseConnection();
  const { 
    isLoading, 
    isProcessing, 
    setIsProcessing,
    summaryData, 
    completionData, 
    transactionsData, 
    dueSoonData,
    allTransactionsHistory,
    fetchData,
    fetchAllHistoricalData,
    toggleTransactionStatus,
    handleEditTransaction,
    handleDeleteTransaction
  } = useTransactions(userId, selectedYear, selectedMonth);

  // Inscrever para eventos de transação
  useEffect(() => {
    const unsubscribe = transactionEvents.subscribe(() => {
      fetchData();
    });
    
    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  // Buscar dados quando usuário, ano ou mês mudarem
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [fetchData, userId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (userId) {
      fetchAllHistoricalData();
    }
  }, [fetchAllHistoricalData, userId]);

  useEffect(() => {
    if (!isConnected) {
      toast({
        title: "Problemas de Conexão",
        description: "Não foi possível conectar ao banco de dados. Verifique sua conexão.",
        variant: "destructive"
      });
    }
  }, [isConnected]);

  const handleCardClick = (type: string) => {
    if (type !== 'saldo') {
      setSelectedType(type);
      setIsDialogOpen(true);
    }
  };

  const handleEditClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditFormData({
      description: transaction.description || '',
      category: transaction.category,
      amount: transaction.amount.toString(),
      due_day: transaction.due_day ? transaction.due_day.toString() : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedTransaction) return;
    
    await handleEditTransaction(selectedTransaction, editFormData);
    setIsEditDialogOpen(false);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedTransaction) return;
    
    await handleDeleteTransaction(selectedTransaction);
    setIsDeleteDialogOpen(false);
  };

  const handleTransactionStatusToggle = async (transaction: Transaction) => {
    await toggleTransactionStatus(transaction);
  };

  // Converter selectedMonth de número para string para os componentes filhos
  const getMonthName = (monthIndex: number) => {
    const months = [
      "Todos os Meses",
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[monthIndex];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <FilterBar 
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />
        
        {dueSoonData.count > 0 && (
          <DueSoonAlert 
            dueSoonData={dueSoonData}
            onClick={() => setIsDueSoonDialogOpen(true)}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <SummaryCards 
          summaryData={summaryData}
          completionData={completionData}
          onCardClick={handleCardClick}
        />
      )}

      {/* Diálogos */}
      <TransactionsDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedType={selectedType}
        transactions={selectedType ? transactionsData[selectedType] : []}
        selectedMonth={getMonthName(selectedMonth)}
        selectedYear={selectedYear}
        isProcessing={isProcessing}
        onToggleStatus={handleTransactionStatusToggle}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <DueSoonDialog 
        isOpen={isDueSoonDialogOpen}
        onOpenChange={setIsDueSoonDialogOpen}
        transactions={dueSoonData.transactions}
        isProcessing={isProcessing}
        onToggleStatus={handleTransactionStatusToggle}
        onEditClick={handleEditClick}
      />

      <EditDialog 
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={handleEditSubmit}
        isProcessing={isProcessing}
      />

      <DeleteDialog 
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        transaction={selectedTransaction}
        onConfirm={handleDeleteSubmit}
        isProcessing={isProcessing}
      />

      {/* Seção de Insights */}
      <FinancialAssistantChat 
        summaryData={summaryData}
        transactionsData={transactionsData}
        completionData={completionData}
        selectedYear={selectedYear}
        selectedMonth={getMonthName(selectedMonth)}
        allTransactionsHistory={allTransactionsHistory}
      />
    </div>
  );
}
