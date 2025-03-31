import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { transactionEvents } from '@/lib/transactionEvents';
import {Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,} from "@/components/ui/dialog";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MoreVertical, Edit, Trash2, AlertCircle, Calendar } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { FinancialAssistantChat } from '@/components/FinancialAssistantChat';
import { Badge } from "@/components/ui/badge";

const summaryCards = [
  { title: "Receitas", type: "receita", color: "text-green-600" },
  { title: "Despesas", type: "despesa", color: "text-red-600" },
  { title: "Investimentos", type: "investimento", color: "text-blue-600" },
  { title: "Saldo", type: "saldo", color: "text-purple-600" },
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Todos os Meses",
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type Transaction = {
  id: number;
  year: string;
  month: string;
  type: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
  user_id: string;
  is_completed: boolean;
  completed_at?: string;
  due_day?: number;
  budget_id: string; // Nova propriedade budget_id
};

type TransactionsData = {
  receita: Transaction[];
  despesa: Transaction[];
  investimento: Transaction[];
};

type SummaryData = {
  receita: number;
  despesa: number;
  investimento: number;
  saldo: number;
};

type CompletionData = {
  receita: {
    count: number;
    completed: number;
    percentage: number;
  };
  despesa: {
    count: number;
    completed: number;
    percentage: number;
  };
  investimento: {
    count: number;
    completed: number;
    percentage: number;
  };
};

type DueSoonData = {
  count: number;
  amount: number;
  transactions: Transaction[];
};

interface DashboardProps {
  budgetId: string; // Interface para receber budgetId como prop
}

export function Dashboard({ budgetId }: DashboardProps) {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth() + 1]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDueSoonDialogOpen, setIsDueSoonDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    receita: 0,
    despesa: 0,
    investimento: 0,
    saldo: 0,
  });
  const [completionData, setCompletionData] = useState<CompletionData>({
    receita: { count: 0, completed: 0, percentage: 0 },
    despesa: { count: 0, completed: 0, percentage: 0 },
    investimento: { count: 0, completed: 0, percentage: 0 },
  });
  const [transactionsData, setTransactionsData] = useState<TransactionsData>({
    receita: [],
    despesa: [],
    investimento: [],
  });
  const [dueSoonData, setDueSoonData] = useState<DueSoonData>({
    count: 0,
    amount: 0,
    transactions: [],
  });
  const [allTransactionsHistory, setAllTransactionsHistory] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    category: '',
    amount: '',
    due_day: ''
  });
  
  // Função para ordenar transações por data de vencimento
  const sortTransactionsByDueDay = (transactions: Transaction[]) => {
    return [...transactions].sort((a, b) => {
      // Se não tiver due_day, coloca no final
      if (!a.due_day) return 1;
      if (!b.due_day) return -1;
      return a.due_day - b.due_day;
    });
  };

  // Verificar se o usuário está autenticado
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        console.error("Usuário não autenticado");
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive"
        });
      }
    };
    
    checkUser();
  }, []);

  const fetchAllHistoricalData = useCallback(async () => {
    if (!userId || !budgetId) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId) // Filtrando por budget_id
        .order('year', { ascending: false })
        .order('month', { ascending: false });
        
      if (error) {
        console.error('Erro ao buscar histórico completo de transações:', error);
        return;
      }
      
      setAllTransactionsHistory(data || []);
    } catch (err) {
      console.error('Erro ao processar histórico completo:', err);
    }
  }, [userId, budgetId]);

  // Função para buscar dados
  const fetchData = useCallback(async () => {
    if (!userId || !budgetId) return;
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId) // Filtrando por budget_id
        .eq('year', selectedYear);

      if (selectedMonth !== "Todos os Meses") {
        query = query.eq('month', selectedMonth);
      }

      const { data, error } = await query;
        
      if (error) {
        console.error('Erro ao buscar transações:', error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      const transactionsByType: TransactionsData = {
        receita: [],
        despesa: [],
        investimento: [],
      };
      
      let totalReceita = 0;
      let totalDespesa = 0;
      let totalInvestimento = 0;
      
      const completion: CompletionData = {
        receita: { count: 0, completed: 0, percentage: 0 },
        despesa: { count: 0, completed: 0, percentage: 0 },
        investimento: { count: 0, completed: 0, percentage: 0 },
      };
      
      // Verificar transações próximas do vencimento (próximos 7 dias)
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;
      const currentMonthName = months[currentMonth];
      const currentYear = today.getFullYear().toString();
      
      let dueSoonTransactions: Transaction[] = [];
      let dueSoonAmount = 0;
      
      data.forEach((transaction: Transaction) => {
        if (transaction.type === 'receita' || transaction.type === 'despesa' || transaction.type === 'investimento') {
          transactionsByType[transaction.type as keyof TransactionsData].push(transaction);
          
          completion[transaction.type as keyof CompletionData].count++;
          if (transaction.is_completed) {
            completion[transaction.type as keyof CompletionData].completed++;
          }
        }
        
        if (transaction.type === 'receita') {
          totalReceita += transaction.amount;
        } else if (transaction.type === 'despesa') {
          totalDespesa += transaction.amount;
        } else if (transaction.type === 'investimento') {
          totalInvestimento += transaction.amount;
        }
        
        // Verificar se a transação está próxima do vencimento
        if (
          transaction.due_day && 
          !transaction.is_completed && 
          (transaction.type === 'despesa' || transaction.type === 'investimento') &&
          transaction.month === currentMonthName &&
          transaction.year === currentYear &&
          transaction.due_day >= currentDay && 
          transaction.due_day <= currentDay + 7
        ) {
          dueSoonTransactions.push(transaction);
          dueSoonAmount += transaction.amount;
        }
      });
      
      const saldo = totalReceita - totalDespesa - totalInvestimento;
      
      Object.keys(completion).forEach(key => {
        const type = key as keyof CompletionData;
        const count = completion[type].count;
        const completed = completion[type].completed;
        completion[type].percentage = count ? Math.round((completed / count) * 100) : 0;
      });
      
      // Ordenar transações por data de vencimento
      transactionsByType.receita = sortTransactionsByDueDay(transactionsByType.receita);
      transactionsByType.despesa = sortTransactionsByDueDay(transactionsByType.despesa);
      transactionsByType.investimento = sortTransactionsByDueDay(transactionsByType.investimento);
      
      setTransactionsData(transactionsByType);
      setSummaryData({
        receita: totalReceita,
        despesa: totalDespesa,
        investimento: totalInvestimento,
        saldo: saldo,
      });
      setCompletionData(completion);
      setDueSoonData({
        count: dueSoonTransactions.length,
        amount: dueSoonAmount,
        transactions: dueSoonTransactions.sort((a, b) => (a.due_day || 0) - (b.due_day || 0))
      });
    } catch (err) {
      console.error('Erro ao processar dados:', err);
      toast({
        title: "Erro",
        description: "Falha ao processar os dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, budgetId, selectedYear, selectedMonth]);

  // Buscar dados quando usuário, budgetId, ano ou mês mudarem
  useEffect(() => {
    if (userId && budgetId) {
      fetchData();
    }
  }, [fetchData, userId, budgetId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (userId && budgetId) {
      fetchAllHistoricalData();
    }
  }, [fetchAllHistoricalData, userId, budgetId]);

  // Inscrever para eventos de transação
  useEffect(() => {
    const unsubscribe = transactionEvents.subscribe(() => {
      fetchData();
    });
    
    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  // Configurar inscrição para mudanças em tempo real
  useEffect(() => {
    if (!userId || !budgetId) return;
    
    const subscription = supabase
      .channel('transactions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId} AND budget_id=eq.${budgetId}` // Filtrando por budget_id
      }, () => {
        fetchData();
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, budgetId, fetchData]);

  const handleCardClick = (type: string) => {
    if (type !== 'saldo') {
      setSelectedType(type);
      setIsDialogOpen(true);
    }
  };

  const handleEditClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditFormData({
      description: transaction.description || '',
      category: transaction.category,
      amount: transaction.amount.toString(),
      due_day: transaction.due_day ? transaction.due_day.toString() : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const toggleTransactionStatus = async (transaction: Transaction) => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para realizar esta ação.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const newStatus = !transaction.is_completed;
      
      const updateData: any = { 
        is_completed: newStatus 
      };
      
      if (newStatus) {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
      
      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId); // Garantindo que estamos atualizando a transação correta
        
      if (error) {
        console.error('Erro ao atualizar status da transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o status da transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: `Transação marcada como ${newStatus ? 'concluída' : 'pendente'}!`
      });
      
      await fetchData();
    } catch (err) {
      console.error('Erro ao processar atualização de status:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleEditTransaction = async () => {
    if (!selectedTransaction || !userId) return;
    
    setIsProcessing(true);
    
    try {
      const amount = Number(editFormData.amount.replace(',', '.'));
      const dueDay = editFormData.due_day ? parseInt(editFormData.due_day) : null;
      
      if (isNaN(amount)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      if (dueDay !== null && (isNaN(dueDay) || dueDay < 1 || dueDay > 31)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um dia de vencimento válido (1-31).",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      const { error, data } = await supabase
        .from('transactions')
        .update({
          description: editFormData.description,
          category: editFormData.category,
          amount: amount,
          due_day: dueDay
        })
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId) // Garantindo que estamos atualizando a transação correta
        .select();
        
      if (error) {
        console.error('Erro ao atualizar transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação atualizada com sucesso!"
      });
      
      await fetchData();
      
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Erro ao processar atualização:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction || !userId) return;
    
    setIsProcessing(true);
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId)
        .eq('budget_id', budgetId); // Garantindo que estamos excluindo a transação correta
        
      if (error) {
        console.error('Erro ao excluir transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir a transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso!"
      });
  
      await fetchData();
  
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error('Erro ao processar exclusão:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };
  
  const getDaysToVencimento = (dueDay: number | undefined) => {
    if (!dueDay) return null;
    
    const today = new Date();
    const currentDay = today.getDate();
    
    // Calcular dias restantes
    return dueDay - currentDay;
  };
  
  const getVencimentoStatus = (dueDay: number | undefined) => {
    if (!dueDay) return null;
    
    const daysLeft = getDaysToVencimento(dueDay);
    
    if (daysLeft === null) return null;
    if (daysLeft < 0) return "atrasado";
    if (daysLeft === 0) return "hoje";
    if (daysLeft <= 3) return "proximo";
    return "normal";
  };

  const checkSupabaseConnection = async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('count').limit(1);
      if (error) {
        console.error('Erro de conexão com Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Falha ao verificar conexão com Supabase:', err);
      return false;
    }
  };

  useEffect(() => {
    checkSupabaseConnection()
      .then(connected => {
        if (!connected) {
          toast({
            title: "Problemas de Conexão",
            description: "Não foi possível conectar ao banco de dados. Verifique sua conexão.",
            variant: "destructive"
          });
        }
      });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Alerta de vencimentos próximos */}
        {dueSoonData.count > 0 && (
          <div className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              onClick={() => setIsDueSoonDialogOpen(true)}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer 
              (R$ {dueSoonData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card 
              key={card.type} 
              className={`hover:shadow-lg transition-shadow ${card.type !== 'saldo' ? 'cursor-pointer' : ''}`}
              onClick={() => card.type !== 'saldo' ? handleCardClick(card.type) : null}
            >
              <CardHeader>
                <CardTitle className={card.color}>{card.title}</CardTitle>
                <CardDescription>
                  {selectedMonth === "Todos os Meses" ? selectedYear : `${selectedMonth} / ${selectedYear}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${card.color}`}>
                  R$ {summaryData[card.type as keyof SummaryData].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
              {card.type !== 'saldo' && (
                <CardFooter className="pt-0">
                  <div className="w-full">
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Concluídas:</span>
                      <span>
                        {completionData[card.type as keyof CompletionData].completed} / {completionData[card.type as keyof CompletionData].count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${card.type === 'receita' ? 'bg-green-600' : 
                                    card.type === 'despesa' ? 'bg-red-600' : 'bg-blue-600'}`}
                        style={{ width: `${completionData[card.type as keyof CompletionData].percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-right text-sm text-gray-500 mt-1">
                      {completionData[card.type as keyof CompletionData].percentage}%
                    </div>
                  </div>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de listagem de transações */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Detalhes das {selectedType === 'receita' ? 'Receitas' : 
                           selectedType === 'despesa' ? 'Despesas' : 'Investimentos'}
              <span className="text-gray-500 text-sm ml-2">
                {selectedMonth === "Todos os Meses" ? selectedYear : `${selectedMonth} / ${selectedYear}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedType && transactionsData[selectedType as keyof TransactionsData]?.length > 0 ? (
              transactionsData[selectedType as keyof TransactionsData]?.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className={`p-4 rounded-lg border ${transaction.is_completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} hover:bg-opacity-90`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={transaction.is_completed}
                          onCheckedChange={() => !isProcessing && toggleTransactionStatus(transaction)}
                          id={`transaction-${transaction.id}`}
                          disabled={isProcessing}
                        />
                        <h3 className={`font-medium ${transaction.is_completed ? 'line-through text-gray-500' : ''}`}>
                          {transaction.description || transaction.category}
                        </h3>
                        
                        {/* Badges para vencimento */}
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
                        <DropdownMenuItem onClick={() => handleEditClick(transaction)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(transaction)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma {selectedType === 'receita' ? 'receita' : 
                           selectedType === 'despesa' ? 'despesa' : 'investimento'} registrada para este período.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edição de transação */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                placeholder="Descrição da transação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={editFormData.category}
                onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                placeholder="Categoria"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                placeholder="Valor da transação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_day">Dia de Vencimento (opcional)</Label>
              <Input
                id="due_day"
                value={editFormData.due_day}
                onChange={(e) => setEditFormData({...editFormData, due_day: e.target.value})}
                placeholder="Dia de vencimento (1-31)"
                type="number"
                min="1"
                max="31"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditTransaction} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteTransaction} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir Transação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de transações próximas a vencer */}
      <Dialog open={isDueSoonDialogOpen} onOpenChange={setIsDueSoonDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Pagamentos a Vencer nos Próximos 7 Dias
            </DialogTitle>
            <DialogDescription>
              Você tem {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer em breve, 
              totalizando R$ {dueSoonData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {dueSoonData.transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="p-4 rounded-lg border border-amber-200 bg-amber-50 hover:bg-opacity-90"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={transaction.is_completed}
                        onCheckedChange={() => !isProcessing && toggleTransactionStatus(transaction)}
                        id={`due-transaction-${transaction.id}`}
                        disabled={isProcessing}
                      />
                      <h3 className="font-medium">
                        {transaction.description || transaction.category}
                      </h3>
                      
                      {/* Badge para vencimento */}
                      {transaction.due_day && (
                        <>
                          {getVencimentoStatus(transaction.due_day) === "hoje" ? (
                            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 ml-2">Vence hoje</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 ml-2">
                              Vence em {getDaysToVencimento(transaction.due_day)} dias
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{transaction.category}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      Vencimento: dia {transaction.due_day}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="font-semibold">
                      R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {transaction.type === 'despesa' ? 'Despesa' : 'Investimento'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isProcessing}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(transaction)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(transaction)}
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Assistente Financeiro */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Assistente Financeiro</CardTitle>
          <CardDescription>
            Converse com nosso assistente para obter insights sobre suas finanças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialAssistantChat 
            transactionHistory={allTransactionsHistory} 
            summaryData={summaryData} 
            selectedYear={selectedYear} 
            selectedMonth={selectedMonth}
          />
        </CardContent>
      </Card>
    </div>
  );
}
