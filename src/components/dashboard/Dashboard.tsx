import { useState } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import { FinancialAssistantChat } from '@/components/FinancialAssistantChat';
import { Filters } from './components/Filters';
import { SummaryCards } from './components/SummaryCards';
import { TransactionListDialog } from './components/TransactionListDialog';
import { DueSoonDialog } from './components/DueSoonDialog';
import { EditTransactionDialog } from './components/EditTransactionDialog';
import { DeleteTransactionDialog } from './components/DeleteTransactionDialog';
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export function Dashboard() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDueSoonDialogOpen, setIsDueSoonDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });

  const {
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    isLoading,
    summaryData,
    completionData,
    transactionsData,
    dueSoonData,
    fetchData
  } = useDashboardData();

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Filters 
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />
        
        {dueSoonData.count > 0 && (
          <div className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              onClick={() => setIsDueSoonDialogOpen(true)}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer 
              (R$ {dueSoonData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </Button>
          </div>
        )}
      </div>

      <SummaryCards 
        isLoading={isLoading}
        summaryData={summaryData}
        completionData={completionData}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onCardClick={handleCardClick}
      />

      <TransactionListDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedType={selectedType}
        transactionsData={transactionsData}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        isProcessing={isProcessing}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onToggleStatus={toggleTransactionStatus}
      />

      <DueSoonDialog
        isOpen={isDueSoonDialogOpen}
        onOpenChange={setIsDueSoonDialogOpen}
        dueSoonData={dueSoonData}
        isProcessing={isProcessing}
        onEditClick={handleEditClick}
        onToggleStatus={toggleTransactionStatus}
      />

      <EditTransactionDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        isProcessing={isProcessing}
        selectedTransaction={selectedTransaction}
        onSave={handleEditTransaction}
      />

      <DeleteTransactionDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        selectedTransaction={selectedTransaction}
        isProcessing={isProcessing}
        onDelete={handleDeleteTransaction}
      />

      <FinancialAssistantChat 
        summaryData={summaryData}
        transactionsData={transactionsData}
        completionData={completionData}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />
    </div>
  );
}
