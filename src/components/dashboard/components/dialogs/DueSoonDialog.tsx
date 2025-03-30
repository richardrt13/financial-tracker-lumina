import { Transaction } from '../../types';
import { TransactionItem } from '../TransactionItem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DueSoonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  isProcessing: boolean;
  onToggleStatus: (transaction: Transaction) => Promise<void>;
  onEditClick: (transaction: Transaction) => void;
}

export function DueSoonDialog({
  isOpen,
  onOpenChange,
  transactions,
  isProcessing,
  onToggleStatus,
  onEditClick
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
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                isProcessing={isProcessing}
                onToggleStatus={onToggleStatus}
                onEditClick={onEditClick}
                showDelete={false}
                highlightDueDate={true}
                className="border-amber-200 bg-amber-50 hover:bg-amber-100"
              />
            ))
          ) : (
            <p className="text-center py-6 text-gray-500">
              Nenhum pagamento próximo do vencimento encontrado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
