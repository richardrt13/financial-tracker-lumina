// /components/dashboard/dialogs/DueSoonDialog.tsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DueSoonData, Transaction } from "../types";
import { TransactionList } from "../ui/TransactionList";

interface DueSoonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dueSoonData: DueSoonData;
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
}

export function DueSoonDialog({
  isOpen,
  onOpenChange,
  dueSoonData,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing
}: DueSoonDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Pagamentos a Vencer nos Próximos 7 Dias
          </DialogTitle>
          <DialogDescription>
            Você tem {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer em breve, 
            totalizando R$ {dueSoonData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <TransactionList
            transactions={dueSoonData.transactions}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            onToggleStatus={onToggleStatus}
            isProcessing={isProcessing}
            highlightDueDate={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}