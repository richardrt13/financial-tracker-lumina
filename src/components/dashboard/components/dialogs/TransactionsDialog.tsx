import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Transaction } from "../../types";
import { TransactionList } from "../TransactionList";

interface TransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedType: string | null;
  selectedYear: string;
  selectedMonth: string;
  transactions: Transaction[];
  isProcessing: boolean;
  onToggleStatus: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionsDialog({
  isOpen,
  onOpenChange,
  selectedType,
  selectedYear,
  selectedMonth,
  transactions,
  isProcessing,
  onToggleStatus,
  onEdit,
  onDelete
}: TransactionsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Detalhes das {selectedType === 'receita' ? 'Receitas' : 
                          selectedType === 'despesa' ? 'Despesas' : 'Investimentos'}
            <span className="text-gray-500 text-sm ml-2">
              {selectedMonth === "Todos os Meses" ? selectedYear : `${selectedMonth} / ${selectedYear}`}
            </span>
          </DialogTitle>
        </DialogHeader>
        <TransactionList
          transactions={transactions}
          isProcessing={isProcessing}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
