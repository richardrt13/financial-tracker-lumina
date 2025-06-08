// src/pages/MinhaConta.tsx
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Link, Link2Off } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Tipos para os dados que vamos buscar
type Budget = {
  id: string;
  name: string;
};

type TelegramLink = {
  id: number;
  chat_id: number;
  default_budget_id: string | null;
};

// Obtenha o nome de usuário do bot a partir das variáveis de ambiente
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "seu_finance_bot";

const MinhaConta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados para o formulário de perfil
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [nome, setNome] = useState(user?.user_metadata?.nome || "");
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  // Estados para a seção de integrações
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [userBudgets, setUserBudgets] = useState<Budget[]>([]);
  const [telegramLink, setTelegramLink] = useState<TelegramLink | null>(null);
  const [selectedDefaultBudget, setSelectedDefaultBudget] = useState<string>("");

  // Função para buscar os dados de integrações e orçamentos
  const fetchIntegrationData = useCallback(async () => {
    if (!user) return;
    setIsLoadingIntegrations(true);

    try {
      // Buscar orçamentos do usuário
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select('id, name')
        .eq('user_id', user.id);
      
      if (budgetsError) throw budgetsError;
      setUserBudgets(budgetsData || []);

      // Verificar se existe um vínculo com o Telegram
      const { data: linkData, error: linkError } = await supabase
        .from('telegram_links')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (linkError && linkError.code !== 'PGRST116') { // PGRST116 = 0 rows, o que é esperado se não houver link
        throw linkError;
      }

      if (linkData) {
        setTelegramLink(linkData);
        setSelectedDefaultBudget(linkData.default_budget_id || "");
      } else {
        setTelegramLink(null);
        setSelectedDefaultBudget("");
      }

    } catch (error: any) {
      toast({
        title: "Erro ao carregar integrações",
        description: error.message || "Não foi possível buscar seus dados de integração.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, [user, toast]);

  // Executar a busca de dados quando o componente montar
  useEffect(() => {
    fetchIntegrationData();
  }, [fetchIntegrationData]);


  const atualizarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);

    try {
      // Atualizar metadados (nome)
      if (nome && nome !== user?.user_metadata?.nome) {
        await supabase.auth.updateUser({ data: { nome } });
      }

      // Atualizar senha
      if (senha) {
        if (senha !== confirmaSenha) {
          toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
          return; // Não continuar
        }
        await supabase.auth.updateUser({ password: senha });
        setSenha("");
        setConfirmaSenha("");
      }

      toast({ title: "Sucesso", description: "Perfil atualizado com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Ocorreu um erro ao atualizar o perfil.", variant: "destructive" });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveIntegration = async () => {
      if (!user || !telegramLink) return;

      setIsLoadingIntegrations(true);
      try {
          const { error } = await supabase
            .from('telegram_links')
            .update({ default_budget_id: selectedDefaultBudget || null })
            .eq('user_id', user.id);
        
          if (error) throw error;
          
          toast({ title: "Sucesso", description: "Orçamento padrão salvo!" });
          fetchIntegrationData(); // Re-fetch para confirmar
      } catch (error: any) {
          toast({ title: "Erro", description: "Não foi possível salvar o orçamento padrão.", variant: "destructive" });
      } finally {
          setIsLoadingIntegrations(false);
      }
  };

  const handleUnlinkTelegram = async () => {
      if (!user || !telegramLink) return;

      setIsLoadingIntegrations(true);
      try {
          const { error } = await supabase
            .from('telegram_links')
            .delete()
            .eq('user_id', user.id);
          
          if (error) throw error;
          
          toast({ title: "Sucesso", description: "Sua conta do Telegram foi desvinculada." });
          setTelegramLink(null);
          setSelectedDefaultBudget("");
          fetchIntegrationData(); // Re-fetch
      } catch (error: any) {
          toast({ title: "Erro", description: "Não foi possível desvincular a conta.", variant: "destructive" });
      } finally {
          setIsLoadingIntegrations(false);
      }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="p-4">
        <div className="max-w-3xl mx-auto grid gap-8">
          
          {/* Seção de Minha Conta */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">Minha Conta</h1>
            
            <div className="mb-6">
              <p className="text-gray-600">Email: {user?.email}</p>
              <p className="text-gray-600">Último login: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
            </div>
            
            <form onSubmit={atualizarPerfil} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="senha">Nova Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmaSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmaSenha"
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loadingProfile}
                className="w-full"
              >
                {loadingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loadingProfile ? "Atualizando..." : "Atualizar Perfil"}
              </Button>
            </form>
          </div>

          {/* Seção de Integrações */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">Integrações</h1>
            
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Telegram Bot</h2>
                {isLoadingIntegrations ? (
                    <div className="flex items-center text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        Carregando informações...
                    </div>
                ) : telegramLink ? (
                    <div className="space-y-4">
                        <p className="text-green-600">Sua conta está vinculada ao Telegram (Chat ID: {telegramLink.chat_id}).</p>
                        
                        <div>
                            <Label htmlFor="default-budget">Orçamento Padrão para Lançamentos</Label>
                            <Select
                                value={selectedDefaultBudget}
                                onValueChange={setSelectedDefaultBudget}
                            >
                                <SelectTrigger id="default-budget" className="mt-1">
                                    <SelectValue placeholder="Selecione um orçamento padrão..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {userBudgets.map(budget => (
                                        <SelectItem key={budget.id} value={budget.id}>{budget.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             <p className="text-xs text-gray-500 mt-1">As transações criadas pelo bot serão adicionadas a este orçamento.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                           <Button onClick={handleSaveIntegration} disabled={isLoadingIntegrations || !selectedDefaultBudget}>
                                {isLoadingIntegrations && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Salvar Orçamento Padrão
                           </Button>
                           <Button variant="destructive" onClick={handleUnlinkTelegram} disabled={isLoadingIntegrations}>
                                <Link2Off className="mr-2 h-4 w-4"/>
                                Desvincular Telegram
                           </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-gray-600">Vincule sua conta ao nosso bot do Telegram para lançar transações rapidamente usando mensagens de texto.</p>
                        <Button asChild>
                           <a 
                             href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${user?.id}`}
                             target="_blank"
                             rel="noopener noreferrer"
                           >
                            <Link className="mr-2 h-4 w-4"/>
                            Vincular com Telegram
                           </a>
                        </Button>
                        <p className="text-xs text-gray-500">Você será redirecionado para o Telegram para iniciar uma conversa com o bot e completar a vinculação.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MinhaConta;
