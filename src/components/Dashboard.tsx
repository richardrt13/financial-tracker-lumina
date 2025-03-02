import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { transactionEvents } from '@/lib/transactionEvents';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MoreVertical, Edit, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const summaryCards = [
  { title: "Receitas", type: "receita", color: "text-green-600" },
  { title: "Despesas", type: "despesa", color: "text-red-600" },
  { title: "Investimentos", type: "investimento", color: "text-blue-600" },
  { title: "Saldo", type: "saldo", color: "text-purple-600" },
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Todos os Meses", // Adicionar esta opção
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

export function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth() + 1]); // Ajuste para o índice correto
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    category: '',
    amount: ''
  });

  // Verificar se o usuário está autenticado
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        // Redirecionar para login ou mostrar mensagem
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

  // Função para buscar dados
  const fetchData = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('year', selectedYear);

      // Se "Todos os Meses" não estiver selecionado, filtrar por mês
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
      
      // Organizar transações por tipo
      const transactionsByType: TransactionsData = {
        receita: [],
        despesa: [],
        investimento: [],
      };
      
      // Calcular valores totais
      let totalReceita = 0;
      let totalDespesa = 0;
      let totalInvestimento = 0;
      
      // Calcular dados de conclusão
      const completion: CompletionData = {
        receita: { count: 0, completed: 0, percentage: 0 },
        despesa: { count: 0, completed: 0, percentage: 0 },
        investimento: { count: 0, completed: 0, percentage: 0 },
      };
      
      data.forEach((transaction: Transaction) => {
        // Adicionar à lista do tipo correspondente
        if (transaction.type === 'receita' || transaction.type === 'despesa' || transaction.type === 'investimento') {
          transactionsByType[transaction.type as keyof TransactionsData].push(transaction);
          
          // Atualizar contadores de conclusão
          completion[transaction.type as keyof CompletionData].count++;
          if (transaction.is_completed) {
            completion[transaction.type as keyof CompletionData].completed++;
          }
        }
        
        // Somar aos totais
        if (transaction.type === 'receita') {
          totalReceita += transaction.amount;
        } else if (transaction.type === 'despesa') {
          totalDespesa += transaction.amount;
        } else if (transaction.type === 'investimento') {
          totalInvestimento += transaction.amount;
        }
      });
      
      // Calcular saldo
      const saldo = totalReceita - totalDespesa - totalInvestimento;
      
      // Calcular percentuais de conclusão
      Object.keys(completion).forEach(key => {
        const type = key as keyof CompletionData;
        const count = completion[type].count;
        const completed = completion[type].completed;
        completion[type].percentage = count ? Math.round((completed / count) * 100) : 0;
      });
      
      // Atualizar estados
      setTransactionsData(transactionsByType);
      setSummaryData({
        receita: totalReceita,
        despesa: totalDespesa,
        investimento: totalInvestimento,
        saldo: saldo,
      });
      setCompletionData(completion);
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
  }, [userId, selectedYear, selectedMonth]);

  // Buscar dados quando usuário, ano ou mês mudarem
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [fetchData, userId, selectedYear, selectedMonth]);

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
    if (!userId) return;
    
    // Inscrever-se para atualizações em tempo real da tabela de transações
    const subscription = supabase
      .channel('transactions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`
      }, () => {
        fetchData();
      })
      .subscribe();
    
    // Limpar inscrição ao desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchData]);

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
      amount: transaction.amount.toString()
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
      
      // Determinar se vamos marcar como concluído ou não
      const newStatus = !transaction.is_completed;
      
      // Preparar dados para atualização, incluindo a data de conclusão
      const updateData: any = { 
        is_completed: newStatus 
      };
      
      // Adicionar data de conclusão apenas quando for marcar como concluído
      if (newStatus) {
        updateData.completed_at = new Date().toISOString();
      } else {
        // Se estiver desmarcando, remover a data de conclusão
        updateData.completed_at = null;
      }
      
      // Enviar a atualização para o servidor ANTES de atualizar a UI
      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transaction.id)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Erro ao atualizar status da transação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o status da transação: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      // Após confirmação de sucesso, então atualizar a UI
      toast({
        title: "Sucesso",
        description: `Transação marcada como ${newStatus ? 'concluída' : 'pendente'}!`
      });
      
      // Recarregar os dados do banco de dados para garantir sincronização
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
      // Formatar o valor para número
      const amount = Number(editFormData.amount.replace(',', '.'));
      
      if (isNaN(amount)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }
      
      // Enviar atualização para o servidor PRIMEIRO
      const { error, data } = await supabase
        .from('transactions')
        .update({
          description: editFormData.description,
          category: editFormData.category,
          amount: amount
        })
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId)
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
      
      // Recarregar dados para garantir sincronização
      await fetchData();
      
      // Fechar o diálogo
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
      // Enviar exclusão para o servidor PRIMEIRO
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', selectedTransaction.id)
        .eq('user_id', userId);
        
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
  
      // Recarregar dados para garantir sincronização
      await fetchData();
  
      // Fechar o diálogo
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

  // Formatar data para exibição
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Verificar se há permissões e conexão com o Supabase
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

  // Verificar conexão ao montar o componente
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
      <div className="flex gap-4 mb-6">
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
                      </div>
                      <p className="text-sm text-gray-500">{transaction.category}</p>
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
              <p className="text-center py-6 text-gray-500">
                Nenhuma transação encontrada para este período.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edição de transação */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !isProcessing && setIsEditDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>
              Modifique os detalhes da transação conforme necessário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={editFormData.category}
                onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                disabled={isProcessing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleEditTransaction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isProcessing && setIsDeleteDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteTransaction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
