import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DueSoonData } from "../types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DueSoonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dueSoonData: DueSoonData;
  isProcessing: boolean;
  onEditClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
}

export function DueSoonDialog({
  isOpen,
  onOpenChange,
  dueSoonData,
  isProcessing,
  onEditClick,
  onToggleStatus
}: DueSoonDialogProps) {
  const getDaysToVencimento = (dueDay: number | undefined) => {
    if (!dueDay) return null;
    const today = new Date();
    return dueDay - today.getDate();
  };

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
          {dueSoonData.transactions.length > 0 ? (
            dueSoonData.transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="p-4 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={transaction.is_completed}
                        onCheckedChange={() => !isProcessing && onToggleStatus(transaction)}
                        id={`due-transaction-${transaction.id}`}
                        disabled={isProcessing}
                      />
                      <h3 className="font-medium">
                        {transaction.description || transaction.category}
                      </h3>
                      
                      {getDaysToVencimento(transaction.due_day) === 0 && (
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 ml-2">Vence hoje</Badge>
                      )}
                      {getDaysToVencimento(transaction.due_day) !== 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 ml-2">
                          Vence em {getDaysToVencimento(transaction.due_day)} dias
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{transaction.category}</p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="font-semibold">
                      R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Vencimento: dia {transaction.due_day}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isProcessing}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditClick(transaction)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => !isProcessing && onToggleStatus(transaction)}>
                        <Checkbox className="h-4 w-4 mr-2" checked={transaction.is_completed} />
                        Marcar como pago
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
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
