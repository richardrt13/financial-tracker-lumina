// /components/dashboard/ui/TransactionList.tsx
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar, MoreVertical, Edit, Trash2 } from "lucide-react";
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

interface TransactionListProps {
  transactions: Transaction[];
  onEditClick: (transaction: Transaction) => void;
  onDeleteClick: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isProcessing: boolean;
  highlightDueDate?: boolean;
}

export function TransactionList({
  transactions,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  isProcessing,
  highlightDueDate = false
}: TransactionListProps) {
  return (
    <>
      {transactions.map((transaction) => (
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