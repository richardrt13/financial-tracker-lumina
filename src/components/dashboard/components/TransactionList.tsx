import { Transaction } from "../types";
import { TransactionItem } from "./TransactionItem";

interface TransactionListProps {
  transactions: Transaction[];
  isProcessing: boolean;
  onToggleStatus: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionList({
  transactions,
  isProcessing,
  onToggleStatus,
  onEdit,
  onDelete
}: TransactionListProps) {
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {transactions.length > 0 ? (
        transactions.map((transaction) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            isProcessing={isProcessing}
            onToggleStatus={onToggleStatus}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      ) : (
        <p className="text-center py-6 text-gray-500">
          Nenhuma transação encontrada para este período.
        </p>
      )}
    </div>
  );
}
