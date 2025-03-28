import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Transaction } from "../types";

interface EditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editFormData: {
    description: string;
    category: string;
    amount: string;
    due_day: string;
  };
  setEditFormData: React.Dispatch<React.SetStateAction<{
    description: string;
    category: string;
    amount: string;
    due_day: string;
  }>>;
  isProcessing: boolean;
  selectedTransaction: Transaction | null;
  onSave: () => void;
}

export function EditTransactionDialog({
  isOpen,
  onOpenChange,
  editFormData,
  setEditFormData,
  isProcessing,
  selectedTransaction,
  onSave
}: EditTransactionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              value={editFormData.description}
              onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
              placeholder="Descrição da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Categoria</Label>
            <Input
              id="edit-category"
              value={editFormData.category}
              onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
              placeholder="Categoria da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Valor (R$)</Label>
            <Input
              id="edit-amount"
              value={editFormData.amount}
              onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
              placeholder="Valor da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due-day">Dia de Vencimento (1-31)</Label>
            <Input
              id="edit-due-day"
              value={editFormData.due_day}
              onChange={(e) => setEditFormData({...editFormData, due_day: e.target.value})}
              placeholder="Dia de vencimento"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
