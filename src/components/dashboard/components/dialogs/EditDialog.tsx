import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Transaction } from '../../types';

interface EditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransaction: Transaction | null;
  isProcessing: boolean;
  onSave: (formData: EditFormData) => Promise<void>;
}

export interface EditFormData {
  description: string;
  category: string;
  amount: string;
  due_day: string;
}

export function EditDialog({
  isOpen,
  onOpenChange,
  selectedTransaction,
  isProcessing,
  onSave
}: EditDialogProps) {
  const [formData, setFormData] = useState<EditFormData>({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });

  useEffect(() => {
    if (selectedTransaction) {
      setFormData({
        description: selectedTransaction.description || '',
        category: selectedTransaction.category,
        amount: selectedTransaction.amount.toString(),
        due_day: selectedTransaction.due_day ? selectedTransaction.due_day.toString() : ''
      });
    }
  }, [selectedTransaction]);

  const handleSubmit = async () => {
    await onSave(formData);
  };

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
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Descrição da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Categoria</Label>
            <Input
              id="edit-category"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              placeholder="Categoria da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Valor (R$)</Label>
            <Input
              id="edit-amount"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              placeholder="Valor da transação"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due-day">Dia de Vencimento (1-31)</Label>
            <Input
              id="edit-due-day"
              value={formData.due_day}
              onChange={(e) => setFormData({...formData, due_day: e.target.value})}
              placeholder="Dia de vencimento"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
