import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar, MoreVertical, Edit, Trash2, Link2, ArrowUpDown, ArrowUp, ArrowDown, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Transaction } from '../types';
import { formatDateTime, formatDate, formatCurrency } from '../utils/formatters';
import { getDaysToVencimento, getVencimentoStatus } from '../utils/helpers';
import { useState, useEffect } from 'react';


interface TransactionListProps {
  transactions: Transaction[];
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
  highlightDueDate?: boolean;
  valuesVisible: boolean; // Adicione esta propriedade
}

type SortField = 'created_at' | 'description' | 'amount' | 'due_day';
type SortDirection = 'asc' | 'desc';


export function TransactionList({
  transactions,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing,
  highlightDueDate = false,
  valuesVisible, // Receba a propriedade
}: TransactionListProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortedTransactions, setSortedTransactions] = useState<Transaction[]>(transactions);

  useEffect(() => {
    const sorted = [...transactions].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'description':
          comparison = (a.description || a.category || '').localeCompare(b.description || b.category || '');
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'due_day':
          const dueDayA = a.due_day ?? (sortDirection === 'asc' ? Infinity : -Infinity);
          const dueDayB = b.due_day ?? (sortDirection === 'asc' ? Infinity : -Infinity);
          comparison = dueDayA - dueDayB;
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    setSortedTransactions(sorted);
  }, [transactions, sortField, sortDirection]);


  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 text-primary" /> : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
  };


  return (
    <TooltipProvider>
      <div className="bg-muted/50 p-2 mb-2 rounded-lg border flex justify-start items-center space-x-3 text-xs sticky top-0 z-10">
        <button onClick={() => toggleSort('created_at')} className="flex items-center font-medium text-muted-foreground hover:text-primary transition-colors">
          Data {renderSortIcon('created_at')}
        </button>
        <button onClick={() => toggleSort('description')} className="flex items-center font-medium text-muted-foreground hover:text-primary transition-colors">
          Nome {renderSortIcon('description')}
        </button>
         <button onClick={() => toggleSort('due_day')} className="flex items-center font-medium text-muted-foreground hover:text-primary transition-colors">
          Venc. {renderSortIcon('due_day')}
        </button>
        <button onClick={() => toggleSort('amount')} className="flex items-center font-medium text-muted-foreground hover:text-primary transition-colors">
          Valor {renderSortIcon('amount')}
        </button>
      </div>

      {sortedTransactions.map((transaction) => (
        <div
          key={transaction.id}
          className={`p-3 mb-2 rounded-md border ${transaction.is_completed
            ? 'border-green-200 bg-green-50/70'
            : highlightDueDate && transaction.due_day && getVencimentoStatus(transaction) !== 'normal'
              ? (getVencimentoStatus(transaction) === 'atrasado' ? 'border-red-300 bg-red-50/70' : 'border-amber-300 bg-amber-50/70')
              : 'border-border bg-card'} hover:shadow-sm transition-shadow`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={transaction.is_completed}
                  onCheckedChange={() => !isProcessing && onToggleStatus(transaction)}
                  id={`transaction-${transaction.id}`}
                  disabled={isProcessing}
                  className="mt-0.5"
                />
                <div>
                  <h3 className={`font-medium text-sm ${transaction.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                    {transaction.description || transaction.category}
                  </h3>
                  <p className="text-xs text-muted-foreground">{transaction.category}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {transaction.due_day && (
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    Vencimento: dia {transaction.due_day}
                    {!transaction.is_completed && getVencimentoStatus(transaction) === "atrasado" && (
                      <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px]">Atrasado</Badge>
                    )}
                    {!transaction.is_completed && getVencimentoStatus(transaction) === "hoje" && (
                      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 ml-2 px-1.5 py-0 text-[10px]">Vence hoje</Badge>
                    )}
                    {!transaction.is_completed && getVencimentoStatus(transaction) === "proximo" && (
                      <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-100 ml-2 px-1.5 py-0 text-[10px]">
                        Vence em {getDaysToVencimento(transaction)} dias
                      </Badge>
                    )}
                  </div>
                )}
                <p>Criado em: {formatDateTime(transaction.created_at)}</p>
                 {(transaction.type === 'despesa' || transaction.type === 'investimento') && transaction.linked_income_details && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-blue-600 hover:text-blue-800 cursor-default flex items-center">
                        <Link2 className="h-3 w-3 mr-1" />
                        Vinculada a: {transaction.linked_income_details.category}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>{transaction.linked_income_details.description || transaction.linked_income_details.category}</p>
                      <p>Valor: {valuesVisible ? `R$ ${formatCurrency(transaction.linked_income_details.amount)}` : "R$ ••••"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="text-right ml-2 min-w-[100px]">
              <p className={`font-semibold text-sm ${transaction.is_completed ? 'text-muted-foreground' :
                transaction.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400' :
                transaction.type === 'despesa' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {valuesVisible ? `${transaction.type === 'despesa' || transaction.type === 'investimento' ? '-' : '+'} R$ ${formatCurrency(transaction.amount)}` : "R$ ••••"}
              </p>
              {transaction.type === 'receita' && transaction.remaining_after_links !== undefined && !transaction.is_completed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-end cursor-default">
                      <Coins className="h-3 w-3 mr-1 text-yellow-500" />
                      <span>Sobra: {valuesVisible ? `R$ ${formatCurrency(transaction.remaining_after_links)}` : "R$ ••••"}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Valor restante desta receita após despesas/investimentos vinculados.
                  </TooltipContent>
                </Tooltip>
              )}
              {transaction.is_completed && transaction.completed_at && (
                <p className="text-xs text-muted-foreground">
                  Concluída: {formatDate(transaction.completed_at)}
                </p>
              )}
            </div>

            <div className="ml-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isProcessing}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditClick(transaction)} disabled={isProcessing}>
                    <Edit className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDeleteClick(transaction)} disabled={isProcessing} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
    </TooltipProvider>
  );
}