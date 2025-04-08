// /components/dashboard/ui/TransactionList.tsx
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar, MoreVertical, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Transaction } from '../types';
import { formatDateTime, formatDate } from '../utils/formatters';
import { getDaysToVencimento, getVencimentoStatus } from '../utils/helpers';
import { useState, useEffect } from 'react';

interface TransactionListProps {
  transactions: Transaction[];
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
  highlightDueDate?: boolean;
}

type SortField = 'created_at' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';

export function TransactionList({
  transactions,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing,
  highlightDueDate = false
}: TransactionListProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortedTransactions, setSortedTransactions] = useState<Transaction[]>(transactions);

  // Re-sort transactions when the original transactions prop changes or sort settings change
  useEffect(() => {
    const sorted = [...transactions].sort((a, b) => {
      if (sortField === 'created_at') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'description') {
        const descA = (a.description || a.category || '').toLowerCase();
        const descB = (b.description || b.category || '').toLowerCase();
        return sortDirection === 'asc' 
          ? descA.localeCompare(descB)
          : descB.localeCompare(descA);
      } else if (sortField === 'amount') {
        return sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return 0;
    });
    
    setSortedTransactions(sorted);
  }, [transactions, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4 text-blue-500" />
      : <ArrowDown className="ml-1 h-4 w-4 text-blue-500" />;
  };

  return (
    <>
      <div className="bg-white p-2 mb-4 rounded-lg border border-gray-200 flex justify-between">
        <div className="flex space-x-4">
          <button 
            onClick={() => toggleSort('created_at')}
            className="flex items-center text-sm font-medium hover:text-blue-600"
          >
            Data {renderSortIcon('created_at')}
          </button>
          <button 
            onClick={() => toggleSort('description')}
            className="flex items-center text-sm font-medium hover:text-blue-600"
          >
            Nome {renderSortIcon('description')}
          </button>
          <button 
            onClick={() => toggleSort('amount')}
            className="flex items-center text-sm font-medium hover:text-blue-600"
          >
            Valor {renderSortIcon('amount')}
          </button>
        </div>
      </div>

      {sortedTransactions.map((transaction) => (
        <div 
          key={transaction.id} 
          className={`p-4 rounded-lg border ${transaction.is_completed 
            ? 'border-green-200 bg-green-50' 
            : highlightDueDate 
              ? 'border-amber-200 bg-amber-50' 
              : 'border-gray-200 bg-gray-50'} hover:bg-opacity-90`}
        >
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={transaction.is_completed}
                  onCheckedChange={() => !isProcessing && onToggleStatus(transaction)}
                  id={`transaction-${transaction.id}`}
                  disabled={isProcessing}
                />
                <h3 className={`font-medium ${transaction.is_completed ? 'line-through text-gray-500' : ''}`}>
                  {transaction.description || transaction.category}
                </h3>
                
                {transaction.due_day && !transaction.is_completed && (
                  <>
                    {getVencimentoStatus(transaction.due_day) === "atrasado" && (
                      <Badge variant="destructive" className="ml-2">Atrasado</Badge>
                    )}
                    {getVencimentoStatus(transaction.due_day) === "hoje" && (
                      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 ml-2">Vence hoje</Badge>
                    )}
                    {getVencimentoStatus(transaction.due_day) === "proximo" && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 ml-2">
                        Vence em {getDaysToVencimento(transaction.due_day)} dias
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{transaction.category}</p>
              {transaction.due_day && (
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  Vencimento: dia {transaction.due_day}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Criado em: {formatDateTime(transaction.created_at)}
              </p>
            </div>
            <div className="text-right mr-4">
              <p className="font-semibold">
                R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {transaction.is_completed && transaction.completed_at && (
                <p className="text-sm text-gray-500">
                  Concluída em: {formatDate(transaction.completed_at)}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {transaction.is_completed ? 'Concluída' : 'Pendente'}
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
                <DropdownMenuItem 
                  onClick={() => onDeleteClick(transaction)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </>
  );
}