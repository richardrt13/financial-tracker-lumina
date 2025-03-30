import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Transaction } from "../../types";
import { TransactionList } from "../TransactionList";

interface DueSoonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  isProcessing: boolean;
  onToggleStatus: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function DueSoonDialog({
  isOpen,
  onOpenChange,
  transactions,
  isProcessing,
  onToggleStatus,
  onEdit,
  onDelete
}: DueSoonDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Pagamentos Próximos do Vencimento
          </DialogTitle>
          <DialogDescription>
            Transações que vencem nos próximos 7 dias
          </DialogDescription>
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
