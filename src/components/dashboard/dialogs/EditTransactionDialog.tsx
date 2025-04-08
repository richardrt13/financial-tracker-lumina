// /components/dashboard/dialogs/EditTransactionDialog.tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface EditFormData {
  description: string;
  category: string;
  amount: string;
  due_day: string;
}

interface EditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EditFormData;
  onFormChange: (data: EditFormData) => void;
  onSave: () => Promise<void>;
  isProcessing: boolean;
}

export function EditTransactionDialog({
  isOpen,
  onOpenChange,
  formData,
  onFormChange,
  onSave,
  isProcessing
}: EditTransactionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
          <DialogDescription>
            Faça as alterações necessárias nos dados da transação abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => onFormChange({...formData, description: e.target.value})}
              placeholder="Descrição da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => onFormChange({...formData, category: e.target.value})}
              placeholder="Categoria"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              value={formData.amount}
              onChange={(e) => onFormChange({...formData, amount: e.target.value})}
              placeholder="Valor da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_day">Dia de Vencimento (opcional)</Label>
            <Input
              id="due_day"
              value={formData.due_day}
              onChange={(e) => onFormChange({...formData, due_day: e.target.value})}
              placeholder="Dia de vencimento (1-31)"
              type="number"
              min="1"
              max="31"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}