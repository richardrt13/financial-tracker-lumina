import { TransactionForm } from "@/components/TransactionFormm";
import { Dashboard } from "@/components/Dashboardd";
import Header from "@/components/Header";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { toast } from "@/components/ui/use-toast";

type Budget = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  order_position: number;
};

const Index = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [isNewBudgetDialogOpen, setIsNewBudgetDialogOpen] = useState(false);
  const [isManageBudgetsDialogOpen, setIsManageBudgetsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<Budget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedOverItem, setDraggedOverItem] = useState<string | null>(null);
  
  // Referência para rastrear se houve reordenação
  const reorderingOccurred = useRef(false);

  // Obter usuário atual e carregar orçamentos
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
        await fetchBudgets(session.user.id);
      }
      setIsLoading(false);
    };
    
    checkUser();
  }, []);

  // Buscar orçamentos do usuário
  const fetchBudgets = async (uid: string) => {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', uid)
      .order('order_position', { ascending: true });
      
    if (error) {
      console.error('Erro ao buscar orçamentos:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setBudgets(data);
      // Selecionar o primeiro orçamento por padrão
      setSelectedBudgetId(data[0].id);
    } else {
      // Se não houver orçamentos, criar um padrão
      createDefaultBudget(uid);
    }
  };

  // Criar orçamento padrão para novos usuários
  const createDefaultBudget = async (uid: string) => {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        name: 'Casa',
        user_id: uid,
        order_position: 0
      })
      .select();
      
    if (error) {
      console.error('Erro ao criar orçamento padrão:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setBudgets([data[0]]);
      setSelectedBudgetId(data[0].id);
    }
  };

  // Adicionar novo orçamento
  const handleAddBudget = async () => {
    if (!newBudgetName.trim() || !userId) return;
    
    setIsLoading(true);
    
    // Calcular a próxima posição de ordem
    const nextPosition = budgets.length > 0 
      ? Math.max(...budgets.map(b => b.order_position)) + 1 
      : 0;
    
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        name: newBudgetName.trim(),
        user_id: userId,
        order_position: nextPosition
      })
      .select();
      
    if (error) {
      console.error('Erro ao adicionar orçamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o orçamento.",
        variant: "destructive"
      });
    } else if (data && data.length > 0) {
      setBudgets(prev => [...prev, data[0]]);
      setSelectedBudgetId(data[0].id);
      toast({
        title: "Sucesso",
        description: `Orçamento "${data[0].name}" adicionado com sucesso.`
      });
    }
    
    setNewBudgetName("");
    setIsNewBudgetDialogOpen(false);
    setIsLoading(false);
  };

  // Funções para Drag and Drop
  const handleDragStart = (budget: Budget) => {
    setDraggedItem(budget);
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent, budgetId: string) => {
    e.preventDefault();
    setDraggedOverItem(budgetId);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedOverItem(null);
    
    // Salvar as mudanças apenas se houve reordenação
    if (reorderingOccurred.current) {
      saveBudgetOrder();
      reorderingOccurred.current = false;
    }
  };

  const handleDrop = (targetBudgetId: string) => {
    if (!draggedItem) return;
    
    const draggedItemIndex = budgets.findIndex(b => b.id === draggedItem.id);
    const targetIndex = budgets.findIndex(b => b.id === targetBudgetId);
    
    if (draggedItemIndex === targetIndex) return;
    
    // Criar uma cópia da lista de orçamentos
    const newBudgets = [...budgets];
    
    // Remover o item arrastado da lista
    const [draggedBudget] = newBudgets.splice(draggedItemIndex, 1);
    
    // Inserir o item na nova posição
    newBudgets.splice(targetIndex, 0, draggedBudget);
    
    // Atualizar as posições de ordem em memória
    const updatedBudgets = newBudgets.map((budget, index) => ({
      ...budget,
      order_position: index
    }));
    
    // Atualizar o estado
    setBudgets(updatedBudgets);
    
    // Sinalizar que houve reordenação
    reorderingOccurred.current = true;
  };

  // Salvar a nova ordem no banco de dados
  const saveBudgetOrder = async () => {
    setIsLoading(true);
    
    try {
      // Criar atualizações para todos os orçamentos
      for (const budget of budgets) {
        const { error } = await supabase
          .from('budgets')
          .update({ order_position: budget.order_position })
          .eq('id', budget.id);
          
        if (error) {
          throw new Error('Erro ao salvar a nova ordem dos orçamentos.');
        }
      }
      
      toast({
        title: "Sucesso",
        description: "A ordem dos orçamentos foi atualizada."
      });
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar a ordem.",
        variant: "destructive"
      });
      
      // Recarregar os orçamentos em caso de erro
      if (userId) {
        await fetchBudgets(userId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Iniciar processo de exclusão de orçamento
  const confirmDeleteBudget = (budget: Budget) => {
    setBudgetToDelete(budget);
    setIsDeleteDialogOpen(true);
  };
  
  // Excluir orçamento e todas as suas transações
  const deleteBudget = async () => {
    if (!budgetToDelete) return;
    
    setIsLoading(true);
    
    try {
      // Primeiro, exclui todas as transações associadas ao orçamento
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('budget_id', budgetToDelete.id);
        
      if (transactionsError) {
        console.error('Erro ao excluir transações:', transactionsError);
        throw new Error('Não foi possível excluir as transações associadas.');
      }
      
      // Em seguida, exclui o orçamento
      const { error: budgetError } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetToDelete.id);
        
      if (budgetError) {
        console.error('Erro ao excluir orçamento:', budgetError);
        throw new Error('Não foi possível excluir o orçamento.');
      }
      
      // Atualizar estado local
      const updatedBudgets = budgets.filter(b => b.id !== budgetToDelete.id);
      setBudgets(updatedBudgets);
      
      // Se excluiu o orçamento selecionado, selecionar outro
      if (selectedBudgetId === budgetToDelete.id) {
        setSelectedBudgetId(updatedBudgets.length > 0 ? updatedBudgets[0].id : null);
      }
      
      toast({
        title: "Sucesso",
        description: `Orçamento "${budgetToDelete.name}" excluído com sucesso.`
      });
      
      // Reordenar os orçamentos para evitar lacunas
      await reorderBudgets(updatedBudgets);
      
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao excluir o orçamento.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setBudgetToDelete(null);
      setIsManageBudgetsDialogOpen(false);
      setIsLoading(false);
    }
  };
  
  // Reorganizar os orçamentos para garantir posições sequenciais
  const reorderBudgets = async (currentBudgets: Budget[]) => {
    const updates = currentBudgets.map((budget, index) => ({
      id: budget.id,
      order_position: index
    }));
    
    for (const update of updates) {
      await supabase
        .from('budgets')
        .update({ order_position: update.order_position })
        .eq('id', update.id);
    }
    
    // Atualizar estado local com as novas posições
    const updatedBudgets = currentBudgets.map((budget, index) => ({
      ...budget,
      order_position: index
    }));
    
    setBudgets(updatedBudgets);
  };

  // Exibir mensagem de carregamento enquanto verifica o usuário
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Seletor de orçamento */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Orçamento
                </label>
                <Select 
                  value={selectedBudgetId || ''} 
                  onValueChange={setSelectedBudgetId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsNewBudgetDialogOpen(true)}
                title="Adicionar orçamento"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsManageBudgetsDialogOpen(true)}
                title="Gerenciar orçamentos"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Nova Transação</h2>
              {selectedBudgetId && (
                <TransactionForm budgetId={selectedBudgetId} />
              )}
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
              {selectedBudgetId && (
                <Dashboard budgetId={selectedBudgetId} />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal para adicionar novo orçamento */}
      <Dialog open={isNewBudgetDialogOpen} onOpenChange={setIsNewBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome do orçamento"
              value={newBudgetName}
              onChange={(e) => setNewBudgetName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBudgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddBudget} disabled={isLoading}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para gerenciar orçamentos (drag-and-drop/excluir) */}
      <Dialog open={isManageBudgetsDialogOpen} onOpenChange={setIsManageBudgetsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Orçamentos</DialogTitle>
            <DialogDescription>
              Arraste para reorganizar ou clique no ícone da lixeira para excluir um orçamento.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="space-y-2">
              {budgets.map((budget) => (
                <li 
                  key={budget.id}
                  className={`flex items-center justify-between p-2 border rounded cursor-move
                    ${draggedItem?.id === budget.id ? 'opacity-50 bg-gray-100' : ''}
                    ${draggedOverItem === budget.id ? 'border-blue-500 bg-blue-50' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(budget)}
                  onDragOver={(e) => handleDragOver(e, budget.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={() => handleDrop(budget.id)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{budget.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={budgets.length <= 1 || isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteBudget(budget);
                    }}
                    title="Excluir orçamento"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            {budgets.length > 1 && (
              <p className="mt-4 text-sm text-gray-500">
                Dica: Arraste e solte os itens para reordenar.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsManageBudgetsDialogOpen(false)}>
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmação para excluir orçamento */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Atenção</span>
              </div>
              Você está prestes a excluir o orçamento "{budgetToDelete?.name}". Todas as transações associadas a este orçamento também serão excluídas permanentemente.
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteBudget();
              }}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isLoading ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;