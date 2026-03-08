import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sun, Moon, Monitor, Bell, Mail, MessageCircle,
  Download, Upload, Trash2, Palette, Globe, Shield,
  FolderOpen, Plus, Loader2
} from "lucide-react";

const Configuracoes = () => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [notificacoesEmail, setNotificacoesEmail] = useState(true);
  const [notificacoesPush, setNotificacoesPush] = useState(false);
  const [notificacoesTelegram, setNotificacoesTelegram] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('despesa');
  const [userId, setUserId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      const stored = localStorage.getItem('spendly-notifications');
      if (stored) {
        const prefs = JSON.parse(stored);
        setNotificacoesEmail(prefs.email ?? true);
        setNotificacoesPush(prefs.push ?? false);
        setNotificacoesTelegram(prefs.telegram ?? true);
      }

      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');
      if (data) setCategories(data);
    };
    init();
  }, []);

  const saveNotifications = () => {
    localStorage.setItem('spendly-notifications', JSON.stringify({
      email: notificacoesEmail,
      push: notificacoesPush,
      telegram: notificacoesTelegram,
    }));
    toast({ title: "Preferências salvas" });
  };

  const handleAddCategory = async () => {
    if (!userId || !newCategoryName.trim()) return;
    const { data, error } = await supabase.from('categories').insert({
      user_id: userId,
      name: newCategoryName.trim(),
      type: newCategoryType,
    }).select();

    if (error) {
      toast({ title: "Erro", description: "Não foi possível adicionar a categoria.", variant: "destructive" });
    } else if (data) {
      setCategories(prev => [...prev, data[0]]);
      setNewCategoryName('');
      setIsAddCategoryOpen(false);
      toast({ title: "Categoria adicionada" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
    toast({ title: "Categoria removida" });
  };

  const handleExportAll = async () => {
    if (!userId) return;
    setIsExporting(true);

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (data) {
      const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status', 'Orçamento'];
      const rows = data.map(t => [
        t.date, t.type, t.category, t.description || '', t.amount, t.status, t.budget_id,
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spendly-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Dados exportados!" });
    }
    setIsExporting(false);
  };

  const handleClearOnboarding = () => {
    localStorage.removeItem('spendly-onboarding-done');
    toast({ title: "Onboarding resetado", description: "O tutorial aparecerá na próxima vez que você acessar o dashboard." });
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Claro', icon: Sun },
    { value: 'dark' as const, label: 'Escuro', icon: Moon },
    { value: 'system' as const, label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground">Personalize sua experiência no Spendly</p>
          </div>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <CardTitle className="text-lg">Aparência</CardTitle>
              </div>
              <CardDescription>Escolha o tema visual da aplicação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {themeOptions.map(option => {
                  const isActive = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        isActive ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <option.icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle className="text-lg">Notificações</CardTitle>
              </div>
              <CardDescription>Configure como deseja receber alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="email-notif">Notificações por email</Label>
                </div>
                <Switch id="email-notif" checked={notificacoesEmail} onCheckedChange={setNotificacoesEmail} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="push-notif">Notificações push</Label>
                </div>
                <Switch id="push-notif" checked={notificacoesPush} onCheckedChange={setNotificacoesPush} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="telegram-notif">Notificações Telegram</Label>
                </div>
                <Switch id="telegram-notif" checked={notificacoesTelegram} onCheckedChange={setNotificacoesTelegram} />
              </div>
              <Button onClick={saveNotifications} className="w-full">Salvar Preferências</Button>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  <CardTitle className="text-lg">Categorias</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddCategoryOpen(true)} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Nova
                </Button>
              </div>
              <CardDescription>Gerencie suas categorias personalizadas</CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria personalizada</p>
              ) : (
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded border">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          cat.type === 'receita' ? 'bg-green-500' : cat.type === 'despesa' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-sm">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">({cat.type})</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle className="text-lg">Dados</CardTitle>
              </div>
              <CardDescription>Exporte ou gerencie seus dados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full gap-2" onClick={handleExportAll} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar todas as transações (CSV)
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleClearOnboarding}>
                <Upload className="h-4 w-4" />
                Resetar tutorial de boas-vindas
              </Button>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle className="text-lg">Privacidade e Segurança</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Seus dados financeiros são armazenados com criptografia e protegidos por Row Level Security.</p>
              <p>Apenas você tem acesso aos seus dados. Orçamentos compartilhados respeitam as permissões definidas.</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Supermercado"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newCategoryType} onValueChange={setNewCategoryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
