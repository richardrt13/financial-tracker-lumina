import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Transaction } from "../../types";

interface DeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransaction: Transaction | null;
  isProcessing: boolean;
  onDelete: () => Promise<void>;
}

export function DeleteDialog({
  isOpen,
  onOpenChange,
  selectedTransaction,
  isProcessing,
  onDelete
}: DeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Exclusão</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</p>
          {selectedTransaction && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50">
              <p><strong>Descrição:</strong> {selectedTransaction.description || selectedTransaction.category}</p>
              <p><strong>Valor:</strong> R$ {selectedTransaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p><strong>Categoria:</strong> {selectedTransaction.category}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={isProcessing}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
