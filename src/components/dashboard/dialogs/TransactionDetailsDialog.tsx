import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionList } from '../ui/TransactionList';
import { Transaction } from '../types';

interface TransactionDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedType: string | null;
  transactions: Transaction[];
  selectedMonth: string;
  selectedYear: string;
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
  valuesVisible: boolean; 
}

const typeToTitle: { [key: string]: string } = {
  receita: 'Receitas',
  despesa: 'Despesas',
  investimento: 'Investimentos',
};

export function TransactionDetailsDialog({
  isOpen,
  onOpenChange,
  selectedType,
  transactions,
  selectedMonth,
  selectedYear,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing,
  valuesVisible, 
}: TransactionDetailsDialogProps) {

  const title = selectedType ? typeToTitle[selectedType] : '';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title} de {selectedMonth} de {selectedYear}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-3">
          {transactions.length > 0 ? (
            <TransactionList
              transactions={transactions}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              onToggleStatus={onToggleStatus}
              isProcessing={isProcessing}
              valuesVisible={valuesVisible} 
            />
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhuma transação encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}