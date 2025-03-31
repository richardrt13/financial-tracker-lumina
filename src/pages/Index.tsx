import { TransactionForm } from "@/components/TransactionFormm";
import { Dashboard } from "@/components/Dashboardd";
import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Budget = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
};

const Index = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [isNewBudgetDialogOpen, setIsNewBudgetDialogOpen] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Erro ao buscar orçamentos:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setBudgets(data);
      // Selecionar o orçamento mais recente por padrão
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
        user_id: uid
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
    
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        name: newBudgetName.trim(),
        user_id: userId
      })
      .select();
      
    if (error) {
      console.error('Erro ao adicionar orçamento:', error);
    } else if (data && data.length > 0) {
      setBudgets(prev => [...prev, data[0]]);
      setSelectedBudgetId(data[0].id);
    }
    
    setNewBudgetName("");
    setIsNewBudgetDialogOpen(false);
    setIsLoading(false);
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
              >
                <Plus className="h-4 w-4" />
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
    </div>
  );
};

export default Index;
