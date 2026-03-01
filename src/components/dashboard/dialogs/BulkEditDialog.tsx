import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface BulkEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (payload: BulkEditPayload) => Promise<void>;
  isProcessing: boolean;
}

export interface BulkEditPayload {
  category?: string;
  amount?: number;
  due_day?: number | null;
}

export function BulkEditDialog({
  isOpen,
  onOpenChange,
  selectedCount,
  onConfirm,
  isProcessing,
}: BulkEditDialogProps) {
  const [enableCategory, setEnableCategory] = useState(false);
  const [enableAmount, setEnableAmount] = useState(false);
  const [enableDueDay, setEnableDueDay] = useState(false);

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');

  const hasAnyEnabled = enableCategory || enableAmount || enableDueDay;

  const handleConfirm = async () => {
    const payload: BulkEditPayload = {};

    if (enableCategory && category.trim()) {
      payload.category = category.trim();
    }
    if (enableAmount) {
      const parsed = Number(amount.replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) return;
      payload.amount = parsed;
    }
    if (enableDueDay) {
      if (dueDay.trim() === '') {
        payload.due_day = null;
      } else {
        const parsed = parseInt(dueDay, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 31) return;
        payload.due_day = parsed;
      }
    }

    if (Object.keys(payload).length === 0) return;
    await onConfirm(payload);
    resetForm();
  };

  const resetForm = () => {
    setEnableCategory(false);
    setEnableAmount(false);
    setEnableDueDay(false);
    setCategory('');
    setAmount('');
    setDueDay('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar em Lote</DialogTitle>
          <DialogDescription>
            Selecione os campos que deseja alterar em {selectedCount} transaç{selectedCount === 1 ? 'ão' : 'ões'}.
            Campos desmarcados permanecerão inalterados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-category"
              checked={enableCategory}
              onCheckedChange={(v) => setEnableCategory(!!v)}
              className="mt-2"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="enable-category" className="text-sm font-medium">Categoria</Label>
              <Input
                placeholder="Nova categoria"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!enableCategory}
              />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-amount"
              checked={enableAmount}
              onCheckedChange={(v) => setEnableAmount(!!v)}
              className="mt-2"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="enable-amount" className="text-sm font-medium">Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!enableAmount}
              />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-dueday"
              checked={enableDueDay}
              onCheckedChange={(v) => setEnableDueDay(!!v)}
              className="mt-2"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="enable-dueday" className="text-sm font-medium">Dia de Vencimento</Label>
              <Input
                type="number"
                placeholder="1–31 (vazio para remover)"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                disabled={!enableDueDay}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !hasAnyEnabled}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Alterar {selectedCount} transaç{selectedCount === 1 ? 'ão' : 'ões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
