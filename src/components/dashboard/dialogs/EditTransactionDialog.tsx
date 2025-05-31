// /components/dashboard/dialogs/EditTransactionDialog.tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Transaction } from '../types';

const NONE_VALUE_MARKER = "__NONE_INCOME_LINK__";

interface EditFormData {
  description: string;
  category: string;
  amount: string;
  due_day: string;
  linked_income_id?: string | null;
}

interface EditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EditFormData;
  onFormChange: (data: EditFormData) => void;
  onSave: () => Promise<void>;
  isProcessing: boolean;
  availableIncomes: Transaction[];
  transactionType?: string;
}

export function EditTransactionDialog({
  isOpen,
  onOpenChange,
  formData,
  onFormChange,
  onSave,
  isProcessing,
  availableIncomes,
  transactionType
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
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              placeholder="Descrição da transação"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Categoria</Label>
            <Input
              id="edit-category"
              value={formData.category}
              onChange={(e) => onFormChange({ ...formData, category: e.target.value })}
              placeholder="Categoria"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Valor (R$)</Label>
            <Input
              id="edit-amount"
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[0-9]*[,]?[0-9]{0,2}$/.test(value) || value === "") {
                    onFormChange({ ...formData, amount: value });
                }
              }}
              placeholder="Ex: 150,50"
              disabled={isProcessing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due_day">Dia de Vencimento (opcional)</Label>
            <Input
              id="edit-due_day"
              value={formData.due_day}
              onChange={(e) => {
                const day = e.target.value;
                 if (day === "" || (/^\d+$/.test(day) && parseInt(day) >= 1 && parseInt(day) <= 31)) {
                    onFormChange({ ...formData, due_day: day })
                 }
              }}
              placeholder="1-31"
              type="text"
              disabled={isProcessing}
            />
          </div>

          {(transactionType === 'despesa' || transactionType === 'investimento') && (
            <div className="space-y-2">
              <Label htmlFor="edit-linked_income_id">Vincular à Receita (Opcional)</Label>
              <Select
                value={formData.linked_income_id === null || formData.linked_income_id === undefined ? NONE_VALUE_MARKER : formData.linked_income_id}
                onValueChange={(value) => {
                  onFormChange({ ...formData, linked_income_id: value === NONE_VALUE_MARKER ? null : value })
                }}
                disabled={isProcessing || availableIncomes.length === 0}
              >
                <SelectTrigger id="edit-linked_income_id">
                  <SelectValue placeholder={availableIncomes.length === 0 ? "Nenhuma receita neste período" : "Selecione uma receita"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE_MARKER}>Nenhuma</SelectItem>
                  {availableIncomes.map((income) => (
                    <SelectItem key={income.id} value={String(income.id)}>
                      {income.category} - R$ {Number(income.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      {income.description ? ` (${income.description})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancelar</Button>
          <Button onClick={onSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}