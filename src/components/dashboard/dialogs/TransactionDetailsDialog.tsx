import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionList } from '../ui/TransactionList';
import { Transaction } from '../types';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedType: string | null;
  transactions: Transaction[];
  dateRange?: DateRange; // Replace selectedMonth/Year
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
  dateRange, // Use dateRange
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing,
  valuesVisible, 
}: TransactionDetailsDialogProps) {

  const title = selectedType ? typeToTitle[selectedType] : '';
  
  let dateText = "";
  if (dateRange?.from) {
    if (dateRange.to) {
        dateText = `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;
    } else {
        dateText = format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title} - {dateText}</DialogTitle>
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