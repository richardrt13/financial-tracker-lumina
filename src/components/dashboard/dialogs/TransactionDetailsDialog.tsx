// /components/dashboard/dialogs/TransactionDetailsDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Transaction } from "../types";
import { TransactionList } from "../ui/TransactionList";

interface TransactionDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedType: string | null;
  transactions: Transaction[];
  selectedMonth: string;
  selectedYear: string;
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
}

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
  isProcessing
}: TransactionDetailsDialogProps) {
  const getTitle = (type: string | null) => {
    if (type === 'receita') return 'Receitas';
    if (type === 'despesa') return 'Despesas';
    if (type === 'investimento') return 'Investimentos';
    return '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Detalhes das {getTitle(selectedType)}
            <span className="text-gray-500 text-sm ml-2">
              {selectedMonth === "Todos os Meses" ? selectedYear : `${selectedMonth} / ${selectedYear}`}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {transactions && transactions.length > 0 ? (
            <TransactionList
              transactions={transactions}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              onToggleStatus={onToggleStatus}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma {getTitle(selectedType).toLowerCase()} registrada para este período.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}