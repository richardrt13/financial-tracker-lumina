import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

export interface BudgetShare {
  id: string;
  budget_id: string;
  owner_id: string;
  shared_with_id: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface SharedBudgetView {
  share_id: string;
  budget_id: string;
  budget_name: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  shared_with_id: string;
  recipient_email: string;
  recipient_name: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export const useBudgetSharing = (userId: string | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const [sharedByMe, setSharedByMe] = useState<SharedBudgetView[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedBudgetView[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SharedBudgetView[]>([]);

  // Buscar usuário por email
  const searchUserByEmail = async (email: string): Promise<UserProfile | null> => {
    try {
      const emailLower = email.toLowerCase().trim();
      
      // Primeiro tenta buscar na tabela profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .eq('email', emailLower)
        .maybeSingle();

      // Se encontrou no profiles, retorna
      if (profileData) {
        return profileData;
      }

      // Se não encontrou, busca diretamente em auth.users via RPC
      // Isso funciona porque auth.users sempre tem o usuário quando ele se cadastra
      const { data: userData, error: userError } = await supabase.rpc(
        'get_user_by_email',
        { user_email: emailLower }
      );

      if (userError) {
        console.error('Error in RPC:', userError);
        
        // Se a função RPC não existe, tenta uma abordagem alternativa
        // Buscar todos os usuários que compartilharam algo (eles existem em auth.users)
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        
        if (!listError && users) {
          const foundUser = users.find(u => u.email?.toLowerCase() === emailLower);
          
          if (foundUser) {
            return {
              id: foundUser.id,
              email: foundUser.email || emailLower,
              full_name: foundUser.user_metadata?.full_name || null,
              avatar_url: foundUser.user_metadata?.avatar_url || null,
            };
          }
        }
        
        toast({
          title: 'Usuário não encontrado',
          description: 'Nenhum usuário encontrado com este email.',
          variant: 'destructive',
        });
        return null;
      }

      if (!userData || userData.length === 0) {
        toast({
          title: 'Usuário não encontrado',
          description: 'Nenhum usuário encontrado com este email.',
          variant: 'destructive',
        });
        return null;
      }

      return {
        id: userData[0].id,
        email: userData[0].email,
        full_name: userData[0].raw_user_meta_data?.full_name || null,
        avatar_url: userData[0].raw_user_meta_data?.avatar_url || null,
      };
    } catch (error) {
      console.error('Error searching user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar o usuário.',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Compartilhar orçamento
  const shareBudget = async (
    budgetId: string,
    targetEmail: string,
    permission: 'view' | 'edit' = 'view'
  ): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      // Buscar usuário por email
      const targetUser = await searchUserByEmail(targetEmail);
      if (!targetUser) {
        setIsLoading(false);
        return false;
      }

      // Verificar se está tentando compartilhar consigo mesmo
      if (targetUser.id === userId) {
        toast({
          title: 'Erro',
          description: 'Você não pode compartilhar um orçamento com você mesmo.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Verificar se já existe um compartilhamento
      const { data: existingShare } = await supabase
        .from('budget_shares')
        .select('*')
        .eq('budget_id', budgetId)
        .eq('shared_with_id', targetUser.id)
        .maybeSingle();

      if (existingShare) {
        toast({
          title: 'Já compartilhado',
          description: 'Este orçamento já foi compartilhado com este usuário.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Criar compartilhamento
      const { error } = await supabase
        .from('budget_shares')
        .insert({
          budget_id: budgetId,
          owner_id: userId,
          shared_with_id: targetUser.id,
          permission,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Convite enviado para ${targetUser.email}!`,
      });

      // Atualizar lista de compartilhamentos
      await fetchSharedBudgets();
      return true;
    } catch (error) {
      console.error('Error sharing budget:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível compartilhar o orçamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Aceitar convite
  const acceptInvite = async (shareId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('budget_shares')
        .update({ status: 'accepted' })
        .eq('id', shareId)
        .eq('shared_with_id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Convite aceito! Agora você tem acesso ao orçamento.',
      });

      await fetchSharedBudgets();
      return true;
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aceitar o convite.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Rejeitar convite
  const rejectInvite = async (shareId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('budget_shares')
        .update({ status: 'rejected' })
        .eq('id', shareId)
        .eq('shared_with_id', userId);

      if (error) throw error;

      toast({
        title: 'Convite rejeitado',
        description: 'O convite foi rejeitado.',
      });

      await fetchSharedBudgets();
      return true;
    } catch (error) {
      console.error('Error rejecting invite:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar o convite.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Remover compartilhamento
  const removeShare = async (shareId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('budget_shares')
        .delete()
        .eq('id', shareId)
        .eq('owner_id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Compartilhamento removido.',
      });

      await fetchSharedBudgets();
      return true;
    } catch (error) {
      console.error('Error removing share:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o compartilhamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar permissão
  const updatePermission = async (
    shareId: string,
    permission: 'view' | 'edit'
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('budget_shares')
        .update({ permission })
        .eq('id', shareId)
        .eq('owner_id', userId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Permissão atualizada.',
      });

      await fetchSharedBudgets();
      return true;
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a permissão.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar todos os compartilhamentos
  const fetchSharedBudgets = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Orçamentos compartilhados por mim
      const { data: myShares, error: mySharesError } = await supabase
        .from('shared_budgets_view')
        .select('*')
        .eq('owner_id', userId);

      if (mySharesError) throw mySharesError;
      setSharedByMe(myShares || []);

      // Orçamentos compartilhados comigo (aceitos)
      const { data: withMe, error: withMeError } = await supabase
        .from('shared_budgets_view')
        .select('*')
        .eq('shared_with_id', userId)
        .eq('status', 'accepted');

      if (withMeError) throw withMeError;
      setSharedWithMe(withMe || []);

      // Convites pendentes
      const { data: pending, error: pendingError } = await supabase
        .from('shared_budgets_view')
        .select('*')
        .eq('shared_with_id', userId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;
      setPendingInvites(pending || []);
    } catch (error) {
      console.error('Error fetching shared budgets:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os compartilhamentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Verificar se usuário tem permissão para editar
  const canEditBudget = useCallback(
    async (budgetId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        // Verificar se é o dono
        const { data: budget } = await supabase
          .from('budgets')
          .select('user_id')
          .eq('id', budgetId)
          .single();

        if (budget?.user_id === userId) return true;

        // Verificar se tem permissão de edição compartilhada
        const { data: share } = await supabase
          .from('budget_shares')
          .select('permission')
          .eq('budget_id', budgetId)
          .eq('shared_with_id', userId)
          .eq('status', 'accepted')
          .maybeSingle();

        return share?.permission === 'edit';
      } catch (error) {
        console.error('Error checking edit permission:', error);
        return false;
      }
    },
    [userId]
  );

  // Carregar compartilhamentos ao montar
  useEffect(() => {
    if (userId) {
      fetchSharedBudgets();
    }
  }, [userId, fetchSharedBudgets]);

  return {
    isLoading,
    sharedByMe,
    sharedWithMe,
    pendingInvites,
    shareBudget,
    acceptInvite,
    rejectInvite,
    removeShare,
    updatePermission,
    searchUserByEmail,
    canEditBudget,
    refreshShares: fetchSharedBudgets,
  };
};
