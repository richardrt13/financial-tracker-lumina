import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, TrendingUp, PiggyBank, Shield, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TermsAndPrivacyDialog } from "@/components/legal/TermsAndPrivacyDialog";
import { TermsPrivacyLinks } from "@/components/legal/TermsPrivacyLinks";

function HeroIllustration() {
  return (
    <div className="relative w-full max-w-md mx-auto h-64">
      {/* Decorative blobs */}
      <div className="absolute top-4 right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse-soft" />
      <div className="absolute bottom-8 left-4 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-pulse-soft" style={{animationDelay: '1s'}} />

      {/* Main card illustration */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-60 animate-float">
        <div className="bg-card rounded-2xl shadow-soft border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Saldo total</p>
                <p className="text-sm font-bold">R$ 12.450,00</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">+24%</span>
          </div>
          <div className="flex gap-1.5">
            {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
              <div key={i} className="flex-1 bg-muted rounded-full overflow-hidden h-10">
                <div
                  className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-full transition-all duration-1000"
                  style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating savings card */}
      <div className="absolute bottom-2 left-4 animate-float-reverse" style={{animationDelay: '0.5s'}}>
        <div className="bg-accent/90 rounded-2xl shadow-soft px-4 py-3 flex items-center gap-2.5">
          <PiggyBank className="w-5 h-5 text-accent-foreground" />
          <div>
            <p className="text-[9px] font-medium text-accent-foreground/70">Economia</p>
            <p className="text-sm font-bold text-accent-foreground">R$ 2.300</p>
          </div>
        </div>
      </div>

      {/* Floating shield card */}
      <div className="absolute bottom-6 right-4 animate-float" style={{animationDelay: '1s'}}>
        <div className="bg-card rounded-2xl shadow-soft border px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs font-semibold">100% Seguro</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password: string) => password.length >= 8;

  const validateForm = () => {
    if (!validateEmail(email)) {
      toast({ title: "Email inválido", description: "Por favor, insira um email válido", variant: "destructive" });
      return false;
    }
    if (!validatePassword(password)) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 8 caracteres", variant: "destructive" });
      return false;
    }
    if (authMode === 'signup' && password !== confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "A confirmação de senha deve ser igual à senha", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        toast({ title: "Login realizado com sucesso", description: "Você será redirecionado para o dashboard" });
        navigate('/');
      }
    } catch (error: any) {
      toast({ title: "Erro ao fazer login", description: error.message || "Verifique suas credenciais e tente novamente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      toast({ title: "Cadastro realizado com sucesso", description: "Verifique seu email para confirmar o cadastro" });
      setAuthMode('login');
    } catch (error: any) {
      toast({ title: "Erro ao criar conta", description: error.message || "Tente novamente com um email diferente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validateEmail(email)) {
      toast({ title: "Email inválido", description: "Por favor, insira um email válido", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast({ title: "Email de recuperação enviado", description: "Verifique seu email para redefinir sua senha" });
    } catch (error: any) {
      toast({ title: "Erro ao enviar email de recuperação", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTermsClick = () => setTermsDialogOpen(true);
  const handlePrivacyClick = () => setTermsDialogOpen(true);
  const handleTermsAccept = () => { setTermsDialogOpen(false); toast({ title: "Termos aceitos" }); };
  const handleTermsClose = () => setTermsDialogOpen(false);

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Global decorative blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-accent/8 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      {/* Left illustration panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-8">
        <div className="relative w-full max-w-lg">
          {/* Logo + Tagline */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-6">
              <svg viewBox="0 0 40 40" fill="none" className="w-12 h-12">
                <rect width="40" height="40" rx="12" fill="hsl(var(--primary))" />
                <path d="M20 8C20 8 13 15 13 22C13 25.9 16.1 29 20 29C23.9 29 27 25.9 27 22C27 15 20 8 20 8Z" fill="white" opacity="0.9" />
                <path d="M20 12C20 12 16 17 16 21C16 23.2 17.8 25 20 25" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              </svg>
              <span className="text-3xl font-bold tracking-tight">
                Spend<span className="text-primary">ly</span>
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Suas finanças, simplificadas</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Controle inteligente de gastos, insights com IA e metas que te fazem crescer.
            </p>
          </div>

          <HeroIllustration />

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-8 animate-fade-in" style={{animationDelay: '0.3s'}}>
            {[
              { icon: TrendingUp, label: 'Dashboard Visual' },
              { icon: Sparkles, label: 'IA Integrada' },
              { icon: PiggyBank, label: 'Metas & Economia' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border shadow-soft text-sm">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <svg viewBox="0 0 36 36" fill="none" className="w-10 h-10">
              <rect width="36" height="36" rx="11" fill="hsl(var(--primary))" />
              <path d="M18 8C18 8 12 14 12 20C12 23.3 14.7 26 18 26C21.3 26 24 23.3 24 20C24 14 18 8 18 8Z" fill="white" opacity="0.9" />
            </svg>
            <span className="text-2xl font-bold tracking-tight">
              Spend<span className="text-primary">ly</span>
            </span>
          </div>

          <Card className="border shadow-soft">
            <CardHeader className="space-y-1 text-center pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {authMode === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
              </CardTitle>
              <CardDescription>
                {authMode === 'login'
                  ? 'Entre para continuar acompanhando suas finanças'
                  : 'Comece a controlar seus gastos hoje'
                }
              </CardDescription>
            </CardHeader>

            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'signup')} className="w-full">
              <TabsList className="grid grid-cols-2 mx-6 mb-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardContent className="space-y-4 pt-2">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="login-password">Senha</Label>
                        <button type="button" onClick={handleResetPassword} className="text-xs text-primary hover:underline">Esqueceu?</button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl" required />
                        <button type="button" onClick={togglePasswordVisibility} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 gap-2 font-semibold rounded-xl text-base" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                  </form>
                  <div className="text-center"><TermsPrivacyLinks onTermsClick={handleTermsClick} onPrivacyClick={handlePrivacyClick} /></div>
                </CardContent>
              </TabsContent>

              <TabsContent value="signup">
                <CardContent className="space-y-4 pt-2">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl" required />
                        <button type="button" onClick={togglePasswordVisibility} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl" required />
                        <button type="button" onClick={togglePasswordVisibility} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Alert className="bg-primary/5 border-primary/20 rounded-xl">
                      <AlertDescription className="text-xs"><TermsPrivacyLinks onTermsClick={handleTermsClick} onPrivacyClick={handlePrivacyClick} /></AlertDescription>
                    </Alert>
                    <Button type="submit" className="w-full h-11 gap-2 font-semibold rounded-xl text-base" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : <>Criar conta <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>
            </Tabs>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <div className="relative flex justify-center text-xs uppercase w-full">
                <span className="bg-card px-3 text-muted-foreground relative z-10">ou</span>
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              </div>
              <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => toast({ title: "Google Auth", description: "Funcionalidade em desenvolvimento" })}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <TermsAndPrivacyDialog isOpen={termsDialogOpen} onClose={handleTermsClose} onAccept={handleTermsAccept} />
    </div>
  );
}
