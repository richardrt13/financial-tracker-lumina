import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Trash2,
  Edit,
  CheckCircle2,
  Circle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Repeat,
  X,
} from "lucide-react";
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";
import { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { BulkEditDialog, BulkEditPayload } from './BulkEditDialog';

interface BatchManagementDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  budgetId: string;
  onDataChanged: () => Promise<void>;
}

type SortField = 'description' | 'category' | 'type' | 'amount' | 'date' | 'due_day';
type SortDirection = 'asc' | 'desc';

const TYPE_LABELS: Record<string, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  investimento: 'Investimento',
};

const TYPE_COLORS: Record<string, string> = {
  receita: 'text-green-700 bg-green-50 border-green-200',
  despesa: 'text-red-700 bg-red-50 border-red-200',
  investimento: 'text-blue-700 bg-blue-50 border-blue-200',
};

function getRecurringKey(t: Transaction): string {
  return `${(t.description || '').toLowerCase()}|${t.category.toLowerCase()}|${t.type}|${t.amount}`;
}

export function BatchManagementDialog({
  isOpen,
  onOpenChange,
  transactions,
  budgetId,
  onDataChanged,
}: BatchManagementDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  const recurringGroups = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const t of transactions) {
      const key = getRecurringKey(t);
      const existing = groups.get(key);
      if (existing) {
        existing.push(t.id);
      } else {
        groups.set(key, [t.id]);
      }
    }
    // Only keep groups with 2+ transactions
    const result = new Map<string, number[]>();
    groups.forEach((ids, key) => {
      if (ids.length >= 2) result.set(key, ids);
    });
    return result;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }

    if (statusFilter === 'pending') {
      result = result.filter(t => !t.is_completed);
    } else if (statusFilter === 'completed') {
      result = result.filter(t => t.is_completed);
    }

    if (showRecurringOnly) {
      result = result.filter(t => recurringGroups.has(getRecurringKey(t)));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'description':
          cmp = (a.description || a.category || '').localeCompare(b.description || b.category || '');
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'date':
          cmp = (a.date || a.created_at).localeCompare(b.date || b.created_at);
          break;
        case 'due_day': {
          const da = a.due_day ?? (sortDirection === 'asc' ? Infinity : -Infinity);
          const db = b.due_day ?? (sortDirection === 'asc' ? Infinity : -Infinity);
          cmp = da - db;
          break;
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [transactions, searchQuery, typeFilter, statusFilter, showRecurringOnly, sortField, sortDirection, recurringGroups]);

  const filteredIds = useMemo(() => new Set(filteredTransactions.map(t => t.id)), [filteredTransactions]);

  const activeSelectedCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => { if (filteredIds.has(id)) count++; });
    return count;
  }, [selectedIds, filteredIds]);

  const allFilteredSelected = filteredTransactions.length > 0 && activeSelectedCount === filteredTransactions.length;

  const toggleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredTransactions.forEach(t => next.add(t.id));
        return next;
      });
    }
  }, [allFilteredSelected, filteredTransactions]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectRecurringGroup = useCallback((transaction: Transaction) => {
    const key = getRecurringKey(transaction);
    const groupIds = recurringGroups.get(key);
    if (!groupIds) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupIds.forEach(id => next.add(id));
      return next;
    });
  }, [recurringGroups]);

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds].filter(id => filteredIds.has(id));
    if (ids.length === 0) return;

    setIsProcessing(true);
    // Close the AlertDialog first to avoid Radix overlay conflicts with the parent Dialog
    setIsDeleteAlertOpen(false);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('budget_id', budgetId);

      if (error) throw error;

      toast({ title: "Sucesso", description: `${ids.length} transaç${ids.length === 1 ? 'ão excluída' : 'ões excluídas'}.` });
      setSelectedIds(new Set());
      await onDataChanged();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao excluir transações.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, filteredIds, budgetId, onDataChanged]);

  const handleBulkEdit = useCallback(async (payload: BulkEditPayload) => {
    const ids = [...selectedIds].filter(id => filteredIds.has(id));
    if (ids.length === 0) return;

    setIsProcessing(true);
    setIsBulkEditOpen(false);
    try {
      const { error } = await supabase
        .from('transactions')
        .update(payload)
        .in('id', ids)
        .eq('budget_id', budgetId);

      if (error) throw error;

      toast({ title: "Sucesso", description: `${ids.length} transaç${ids.length === 1 ? 'ão atualizada' : 'ões atualizadas'}.` });
      setSelectedIds(new Set());
      await onDataChanged();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao atualizar transações.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, filteredIds, budgetId, onDataChanged]);

  const handleBulkToggleStatus = useCallback(async (markCompleted: boolean) => {
    const ids = [...selectedIds].filter(id => filteredIds.has(id));
    if (ids.length === 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          is_completed: markCompleted,
          completed_at: markCompleted ? new Date().toISOString() : null,
        })
        .in('id', ids)
        .eq('budget_id', budgetId);

      if (error) throw error;

      const label = markCompleted ? 'concluída' : 'pendente';
      const labelPlural = markCompleted ? 'concluídas' : 'pendentes';
      toast({ title: "Sucesso", description: `${ids.length} transaç${ids.length === 1 ? `ão marcada como ${label}` : `ões marcadas como ${labelPlural}`}.` });
      setSelectedIds(new Set());
      await onDataChanged();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao atualizar status.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, filteredIds, budgetId, onDataChanged]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-500" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-500" />;
  };

  const formatTransactionDate = (t: Transaction) => {
    if (t.date) {
      const [y, m, d] = t.date.split('-');
      return `${d}/${m}/${y}`;
    }
    if (t.month && t.year) return `${t.month}/${t.year}`;
    return '-';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0"
          onPointerDownOutside={(e) => {
            if (isDeleteAlertOpen || isBulkEditOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isDeleteAlertOpen || isBulkEditOpen) e.preventDefault();
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Gestão em Lote de Transações</DialogTitle>
          </DialogHeader>

          {/* Filter Bar */}
          <div className="px-6 py-3 border-b space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por descrição ou categoria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                </SelectContent>
              </Select>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showRecurringOnly ? "default" : "outline"}
                      size="sm"
                      className="h-9 gap-1.5"
                      onClick={() => setShowRecurringOnly(v => !v)}
                    >
                      <Repeat className="h-3.5 w-3.5" />
                      Recorrentes
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Filtrar transações que se repetem com mesma descrição, categoria, tipo e valor
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{filteredTransactions.length} transaç{filteredTransactions.length === 1 ? 'ão' : 'ões'} encontrada{filteredTransactions.length === 1 ? '' : 's'}</span>
              {activeSelectedCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3 w-3 mr-1" /> Limpar seleção
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('description')} className="flex items-center hover:text-blue-600">
                      Descrição {renderSortIcon('description')}
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <button onClick={() => toggleSort('category')} className="flex items-center hover:text-blue-600">
                      Categoria {renderSortIcon('category')}
                    </button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <button onClick={() => toggleSort('type')} className="flex items-center hover:text-blue-600">
                      Tipo {renderSortIcon('type')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('amount')} className="flex items-center hover:text-blue-600">
                      Valor {renderSortIcon('amount')}
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <button onClick={() => toggleSort('date')} className="flex items-center hover:text-blue-600">
                      Data {renderSortIcon('date')}
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <button onClick={() => toggleSort('due_day')} className="flex items-center hover:text-blue-600">
                      Venc. {renderSortIcon('due_day')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                      Nenhuma transação encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map(t => {
                    const isRecurring = recurringGroups.has(getRecurringKey(t));
                    const isSelected = selectedIds.has(t.id);

                    return (
                      <TableRow
                        key={t.id}
                        data-state={isSelected ? 'selected' : undefined}
                        className={isSelected ? 'bg-blue-50/60' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(t.id)}
                            aria-label={`Selecionar ${t.description || t.category}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate max-w-[200px]">
                              {t.description || t.category}
                            </span>
                            {isRecurring && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => selectRecurringGroup(t)}
                                      className="shrink-0"
                                    >
                                      <Repeat className="h-3.5 w-3.5 text-purple-500" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Recorrente ({recurringGroups.get(getRecurringKey(t))?.length} ocorrências). Clique para selecionar todas.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 md:hidden">{t.category}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-600">
                          {t.category}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ''}`}>
                            {TYPE_LABELS[t.type] || t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium tabular-nums">
                          <span className={
                            t.type === 'receita' ? 'text-green-600' :
                            t.type === 'despesa' ? 'text-red-600' : 'text-blue-600'
                          }>
                            {t.type === 'receita' ? '+' : '-'} R$ {formatCurrency(t.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                          {formatTransactionDate(t)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                          {t.due_day ? `Dia ${t.due_day}` : '-'}
                        </TableCell>
                        <TableCell>
                          {t.is_completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Batch Toolbar */}
          {activeSelectedCount > 0 && (
            <div className="border-t bg-gray-50 px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">
                {activeSelectedCount} transaç{activeSelectedCount === 1 ? 'ão selecionada' : 'ões selecionadas'}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleStatus(true)}
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleStatus(false)}
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <Circle className="h-3.5 w-3.5" />
                  Pendente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkEditOpen(true)}
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteAlertOpen(true)}
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Atenção</span>
              </div>
              Você está prestes a excluir permanentemente {activeSelectedCount} transaç{activeSelectedCount === 1 ? 'ão' : 'ões'}.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, excluir {activeSelectedCount}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit */}
      <BulkEditDialog
        isOpen={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        selectedCount={activeSelectedCount}
        onConfirm={handleBulkEdit}
        isProcessing={isProcessing}
      />
    </>
  );
}
