import { TransactionForm } from "@/components/TransactionForm";
import { Dashboard } from "@/components/dashboard/index";
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
import { Plus, Trash2, GripVertical, AlertCircle, Settings } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ProcessBankStatement } from "@/components/ProcessBankStatement"; 

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
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Budget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedOverItem, setDraggedOverItem] = useState<string | null>(null);
  
  // Referência para rastrear se houve reordenação
  const reorderingOccurred = useRef(false);
  // Referência para o elemento fantasma temporário
  const ghostElementRef = useRef<HTMLDivElement | null>(null);
  // Referência para o timeout da animação de reordenação
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Limpar elemento fantasma e timeouts quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (ghostElementRef.current && document.body.contains(ghostElementRef.current)) {
        document.body.removeChild(ghostElementRef.current);
      }
      
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
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

  // Funções otimizadas para Drag and Drop
  const handleDragStart = (e: React.DragEvent, budget: Budget) => {
    // Definir os dados transferidos
    e.dataTransfer.setData('text/plain', budget.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Criar elemento fantasma personalizado para melhorar a visualização
    const ghostElement = document.createElement('div');
    ghostElement.innerHTML = `
      <div style="
        padding: 8px 12px;
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        width: 200px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
        ${budget.name}
      </div>
    `;
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = '-1000px';
    ghostElement.style.pointerEvents = 'none';
    
    // Adicionar o elemento ao corpo e armazenar a referência
    document.body.appendChild(ghostElement);
    ghostElementRef.current = ghostElement;
    
    // Definir a imagem personalizada para o arrasto
    const firstElement = ghostElement.firstElementChild as HTMLElement;
    if (firstElement) {
      e.dataTransfer.setDragImage(firstElement, 15, 15);
    }
    
    // Atualizar o estado
    setDraggedItem(budget);
    setIsDragging(true);
    
    // Aplicar classe que impede seleção de texto durante o arrasto
    document.body.classList.add('user-select-none');
    
    // Programar a remoção do elemento fantasma
    setTimeout(() => {
      if (ghostElementRef.current && document.body.contains(ghostElementRef.current)) {
        document.body.removeChild(ghostElementRef.current);
        ghostElementRef.current = null;
      }
    }, 0);
  };

  // Manipular evento dragover no contêiner
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Manipular evento dragover em um item
  const handleDragOver = (e: React.DragEvent, budgetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedItem || draggedItem.id === budgetId) return;
    
    // Atualizar o item sobre o qual estamos arrastando
    setDraggedOverItem(budgetId);
    
    // Mover o item visualmente enquanto arrasta
    moveItem(draggedItem.id, budgetId);
  };

  // Função para mover o item visualmente durante o arrasto
  const moveItem = (sourceId: string, targetId: string) => {
    const draggedItemIndex = budgets.findIndex(b => b.id === sourceId);
    const targetIndex = budgets.findIndex(b => b.id === targetId);
    
    if (draggedItemIndex === targetIndex) return;
    
    // Criar uma cópia da lista de orçamentos
    const newBudgets = [...budgets];
    
    // Remover o item arrastado da lista
    const [draggedBudget] = newBudgets.splice(draggedItemIndex, 1);
    
    // Inserir o item na nova posição
    newBudgets.splice(targetIndex, 0, draggedBudget);
    
    // Atualizar a lista sem alterar as posições order_position ainda
    // Isso permite o movimento visual durante o arrasto
    setBudgets(newBudgets);
  };

  // Manipular evento dragenter em um item
  const handleDragEnter = (e: React.DragEvent, budgetId: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== budgetId) {
      setDraggedOverItem(budgetId);
    }
  };

  // Manipular evento dragleave em um item
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Não limpe o draggedOverItem aqui para manter a posição durante o arrasto
  };

  // Manipular evento dragend
  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Limpar estados e classes
    setIsDragging(false);
    setDraggedOverItem(null);
    
    // Salvar as mudanças apenas após todos os movimentos visuais
    if (draggedItem) {
      updateOrderPositions();
      reorderingOccurred.current = true;
      saveBudgetOrder();
    }
    
    setDraggedItem(null);
    document.body.classList.remove('user-select-none');
    
    // Certifique-se de que o elemento fantasma foi removido
    if (ghostElementRef.current && document.body.contains(ghostElementRef.current)) {
      document.body.removeChild(ghostElementRef.current);
      ghostElementRef.current = null;
    }
    
    // Limpar qualquer timeout pendente
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  // Atualizar as posições order_position após a reordenação visual
  const updateOrderPositions = () => {
    // Atualizar as posições de ordem em memória
    const updatedBudgets = budgets.map((budget, index) => ({
      ...budget,
      order_position: index
    }));
    
    // Atualizar o estado
    setBudgets(updatedBudgets);
  };

  // Manipular evento drop
  const handleDrop = (e: React.DragEvent, targetBudgetId: string) => {
    e.preventDefault();
    
    const draggedItemId = e.dataTransfer.getData('text/plain');
    if (!draggedItemId) return;
    
    const draggedItemObject = budgets.find(b => b.id === draggedItemId);
    if (!draggedItemObject) return;
    
    // A reordenação visual já foi feita durante os eventos dragOver
    // Agora apenas confirmar a operação
    
    // Atualizar as posições order_position
    updateOrderPositions();
    
    // Sinalizar que houve reordenação
    reorderingOccurred.current = true;
    
    // Limpar estados
    setDraggedOverItem(null);
  };

  // Salvar a nova ordem no banco de dados
  const saveBudgetOrder = async () => {
    setIsLoading(true);
    
    try {
      // Criar atualizações para todos os orçamentos com posições atualizadas
      const updates = budgets.map((budget, index) => ({
        id: budget.id,
        order_position: index
      }));
      
      for (const update of updates) {
        const { error } = await supabase
          .from('budgets')
          .update({ order_position: update.order_position })
          .eq('id', update.id);
          
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

  // Adicione um estilo global para impedir seleção durante o arrasto
  // e para animar transições de posição
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .user-select-none {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
      
      .budget-item {
        transition: transform 0.12s ease-out;
      }
      
      .dragging {
        opacity: 0.5;
        background-color: #f9fafb;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
                {/* Alterado de <label> para <Label> para consistência, assumindo importação de ui/label */}
                <Label htmlFor="budget-select" className="block text-sm font-medium mb-1">
                  Orçamento Ativo
                </Label>
                <Select 
                  value={selectedBudgetId || ''} 
                  onValueChange={(value) => setSelectedBudgetId(value === '' ? null : value)}
                  disabled={budgets.length === 0 && !isLoading} // Desabilitar se não houver orçamentos e não estiver carregando
                >
                  <SelectTrigger id="budget-select" disabled={isLoading && budgets.length === 0}>
                    <SelectValue placeholder={isLoading && budgets.length === 0 ? "Carregando orçamentos..." : (budgets.length === 0 ? "Crie um orçamento para começar" : "Selecione um orçamento")} />
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
                title="Adicionar novo orçamento"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsManageBudgetsDialogOpen(true)}
                title="Gerenciar orçamentos"
                disabled={budgets.length === 0 || isLoading} // Desabilitar se não houver orçamentos ou estiver carregando
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* NOVA SEÇÃO PARA IMPORTAR EXTRATO BANCÁRIO */}
          {selectedBudgetId && !isLoading && ( // Mostrar apenas se um orçamento estiver selecionado e não estiver carregando orçamentos
            <div className="bg-white p-6 rounded-lg shadow-md">
               <ProcessBankStatement budgetId={selectedBudgetId} />
            </div>
          )}
          
          {/* Layout principal: Formulário de Transação e Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 items-start">
            {/* Coluna do Formulário de Transação (sticky) */}
            <div className="bg-white p-6 rounded-lg shadow-md lg:sticky lg:top-4">
              <h2 className="text-xl font-semibold mb-4">Nova Transação</h2>
              {isLoading && !selectedBudgetId ? ( // Se estiver carregando e nenhum orçamento selecionado
                <div className="flex items-center text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando orçamentos...
                </div>
              ) : !selectedBudgetId ? ( // Se não estiver carregando e nenhum orçamento selecionado
                <p className="text-gray-500">Selecione ou crie um orçamento para adicionar transações.</p>
              ) : ( // Se houver um orçamento selecionado (e não estiver carregando orçamentos)
                <TransactionForm budgetId={selectedBudgetId} />
              )}
            </div>
            
            {/* Coluna do Dashboard */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Visão Geral do Orçamento</h2>
               {isLoading && !selectedBudgetId ? (
                <div className="flex items-center text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando dados do orçamento...
                </div>
              ) : !selectedBudgetId ? (
                 <p className="text-gray-500">Selecione ou crie um orçamento para visualizar o dashboard.</p>
              ) : (
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
              placeholder="Nome do orçamento (ex: Pessoal, Viagem)"
              value={newBudgetName}
              onChange={(e) => setNewBudgetName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewBudgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddBudget} disabled={isActionLoading || !newBudgetName.trim()}>
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para gerenciar orçamentos */}
      <Dialog open={isManageBudgetsDialogOpen} onOpenChange={setIsManageBudgetsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Orçamentos</DialogTitle>
            <DialogDescription>
              Arraste para reorganizar ou clique no ícone da lixeira para excluir.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {budgets.length === 0 && !isLoading ? (
                <p className="text-sm text-gray-500 text-center">Nenhum orçamento encontrado. Crie um novo.</p>
            ) : (
                <ul 
                className="space-y-2"
                onDragOver={handleContainerDragOver}
                >
                {budgets.map((budget) => (
                    <li 
                    key={budget.id}
                    className={`flex items-center justify-between p-2 border rounded cursor-move budget-item
                        ${draggedItem?.id === budget.id ? 'dragging' : ''}
                        ${draggedOverItem === budget.id ? 'border-blue-500 bg-blue-50' : ''}`}
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, budget)}
                    onDragOver={(e) => handleDragOver(e, budget.id)}
                    onDragEnter={(e) => handleDragEnter(e, budget.id)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, budget.id)}
                    >
                    <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{budget.name}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={budgets.length <= 1 || isActionLoading}
                        onClick={(e) => {
                        e.stopPropagation(); // Evitar que o drag comece ao clicar no botão
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
            )}
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
            <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteBudget();
              }}
              disabled={isActionLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;