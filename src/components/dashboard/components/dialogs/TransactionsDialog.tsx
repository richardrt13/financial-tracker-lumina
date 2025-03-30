import { Transaction } from '../../types';
import { TransactionList } from '../TransactionList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedType: string | null;
  transactions: Transaction[];
  selectedMonth: string;
  selectedYear: string;
  isProcessing: boolean;
  onToggleStatus: (transaction: Transaction) => Promise<void>;
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
}

export function TransactionsDialog({
  isOpen,
  onOpenChange,
  selectedType,
  transactions,
  selectedMonth,
  selectedYear,
  isProcessing,
  onToggleStatus,
  onEditClick,
  onDeleteClick
}: TransactionsDialogProps) {
  // Função para determinar o título com base no tipo selecionado
  const getTitle = () => {
    switch(selectedType) {
      case 'receita': return 'Receitas';
      case 'despesa': return 'Despesas';
      case 'investimento': return 'Investimentos';
      default: return 'Transações';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Detalhes das {getTitle()}
            <span className="text-gray-500 text-sm ml-2">
              {selectedMonth === "Todos os Meses" ? selectedYear : `${selectedMonth} / ${selectedYear}`}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <TransactionList 
            transactions={transactions}
            isProcessing={isProcessing}
            onToggleStatus={onToggleStatus}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
