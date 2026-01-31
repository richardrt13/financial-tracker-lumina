// EXEMPLO DE INTEGRAÇÃO DO SISTEMA DE COMPARTILHAMENTO DE ORÇAMENTOS
// Este arquivo mostra como integrar os componentes de compartilhamento na página Index.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BudgetSharingDialog, PendingInvites, SharedWithMeBudgets } from '@/components/BudgetSharingDialog';
import { useBudgetSharing } from '@/hooks/useBudgetSharing';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';

// ... seus imports existentes ...

const IndexWithSharing = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Hook de compartilhamento
  const { sharedWithMe, canEditBudget } = useBudgetSharing(userId);

  // Obter usuário atual
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
        await fetchBudgets(session.user.id);
      }
    };
    
    checkUser();
  }, []);

  // Buscar orçamentos (próprios + compartilhados)
  const fetchBudgets = async (uid: string) => {
    // Seus orçamentos
    const { data: myBudgets, error: myError } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', uid)
      .order('order_position', { ascending: true });
      
    if (myError) {
      console.error('Erro ao buscar orçamentos:', myError);
      return;
    }
    
    // Orçamentos compartilhados aceitos
    const { data: shared } = await supabase
      .from('shared_budgets_view')
      .select('*')
      .eq('shared_with_id', uid)
      .eq('status', 'accepted');

    // Combinar orçamentos próprios e compartilhados
    const allBudgets = [
      ...(myBudgets || []),
      ...(shared || []).map(s => ({
        id: s.budget_id,
        name: `${s.budget_name} (${s.owner_name || s.owner_email})`,
        user_id: s.owner_id,
        created_at: s.created_at,
        order_position: 999, // Colocar compartilhados no final
        is_shared: true,
        permission: s.permission,
      }))
    ];
    
    setBudgets(allBudgets);
    
    if (allBudgets.length > 0) {
      setSelectedBudgetId(allBudgets[0].id);
    }
  };

  // Obter orçamento selecionado
  const selectedBudget = budgets.find(b => b.id === selectedBudgetId);

  // Verificar se pode editar o orçamento selecionado
  const [canEdit, setCanEdit] = useState(true);
  
  useEffect(() => {
    const checkEditPermission = async () => {
      if (selectedBudgetId && userId) {
        const hasPermission = await canEditBudget(selectedBudgetId);
        setCanEdit(hasPermission);
      }
    };
    
    checkEditPermission();
  }, [selectedBudgetId, userId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto p-4 space-y-6">
        {/* Convites Pendentes - Mostra no topo quando houver convites */}
        {userId && <PendingInvites userId={userId} />}

        {/* Seletor de Orçamento com Botão de Compartilhar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Select 
              value={selectedBudgetId || ''} 
              onValueChange={setSelectedBudgetId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um orçamento" />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((budget) => (
                  <SelectItem key={budget.id} value={budget.id}>
                    {budget.name}
                    {budget.is_shared && (
                      <Badge variant="secondary" className="ml-2">
                        Compartilhado
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão de Compartilhar - Só mostra se for proprietário */}
          {selectedBudget && userId && selectedBudget.user_id === userId && (
            <BudgetSharingDialog budget={selectedBudget} userId={userId} />
          )}

          {/* Indicador de permissão se for orçamento compartilhado */}
          {selectedBudget && selectedBudget.is_shared && (
            <Badge variant={selectedBudget.permission === 'edit' ? 'default' : 'secondary'}>
              {selectedBudget.permission === 'edit' ? 'Pode Editar' : 'Apenas Visualizar'}
            </Badge>
          )}
        </div>

        {/* Formulário de Transação - Desabilitar se não puder editar */}
        {selectedBudgetId && (
          <TransactionForm 
            budgetId={selectedBudgetId}
            userId={userId}
            disabled={!canEdit}
          />
        )}

        {/* Dashboard */}
        {selectedBudgetId && (
          <Dashboard 
            budgetId={selectedBudgetId}
            userId={userId}
            readOnly={!canEdit}
          />
        )}

        {/* Orçamentos Compartilhados Comigo - Seção adicional */}
        {userId && <SharedWithMeBudgets userId={userId} />}
      </div>
    </div>
  );
};

export default IndexWithSharing;


// =====================================================
// ALTERNATIVA: ADICIONAR APENAS O BOTÃO DE COMPARTILHAR
// =====================================================

// Se você preferir adicionar apenas o botão de compartilhar sem modificar muito,
// adicione estas linhas no seu Index.tsx existente:

/*
// 1. Importar os componentes necessários
import { BudgetSharingDialog } from '@/components/BudgetSharingDialog';

// 2. Na seção onde você renderiza o seletor de orçamentos, adicione:

<div className="flex items-center gap-2">
  <Select value={selectedBudgetId || ''} onValueChange={setSelectedBudgetId}>
    // ... suas opções de orçamento ...
  </Select>
  
  {selectedBudget && userId && selectedBudget.user_id === userId && (
    <BudgetSharingDialog budget={selectedBudget} userId={userId} />
  )}
</div>

// 3. Para mostrar convites pendentes no topo da página:
import { PendingInvites } from '@/components/BudgetSharingDialog';

// No início do seu return:
<div className="container mx-auto p-4">
  {userId && <PendingInvites userId={userId} />}
  
  // ... resto do seu conteúdo ...
</div>
*/


// =====================================================
// EXEMPLO: NOTIFICAÇÕES EM TEMPO REAL
// =====================================================

// Adicione este useEffect para receber notificações em tempo real
// quando alguém compartilhar um orçamento com você:

useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel('budget-shares-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'budget_shares',
      filter: `shared_with_id=eq.${userId}`,
    }, (payload) => {
      // Notificar usuário sobre novo convite
      toast({
        title: '📨 Novo Convite!',
        description: 'Você recebeu um convite para compartilhamento de orçamento.',
        action: (
          <Button size="sm" onClick={() => {
            // Abrir seção de convites ou atualizar dados
            window.location.reload();
          }}>
            Ver Convite
          </Button>
        ),
      });
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'budget_shares',
      filter: `owner_id=eq.${userId}`,
    }, (payload) => {
      // Notificar quando alguém aceitar/rejeitar seu convite
      const newData = payload.new as any;
      
      if (newData.status === 'accepted') {
        toast({
          title: '✅ Convite Aceito!',
          description: 'Um usuário aceitou o compartilhamento do seu orçamento.',
        });
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);


// =====================================================
// EXEMPLO: CONTROLE DE ACESSO EM COMPONENTES
// =====================================================

// Componente de Transação com Controle de Permissão
const SecureTransactionForm = ({ budgetId, userId }) => {
  const { canEditBudget } = useBudgetSharing(userId);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      const hasPermission = await canEditBudget(budgetId);
      setCanEdit(hasPermission);
    };
    
    checkPermission();
  }, [budgetId, userId]);

  if (!canEdit) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          🔒 Você tem permissão apenas para visualizar este orçamento.
        </p>
      </div>
    );
  }

  return <TransactionForm budgetId={budgetId} userId={userId} />;
};
