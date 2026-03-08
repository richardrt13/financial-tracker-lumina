import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Loader2, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se há uma sessão de recuperação válida
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsValidSession(true);
        } else {
          // Verificar se há um token de recuperação na URL
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          
          if (type === 'recovery') {
            setIsValidSession(true);
          } else {
            toast({
              title: "Link inválido ou expirado",
              description: "Por favor, solicite um novo link de recuperação de senha",
              variant: "destructive",
            });
            setTimeout(() => navigate('/login'), 2000);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        toast({
          title: "Erro",
          description: "Não foi possível verificar o link de recuperação",
          variant: "destructive",
        });
        setTimeout(() => navigate('/login'), 2000);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate, toast]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword(password)) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "A confirmação de senha deve ser igual à senha",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      
      if (error) throw error;
      
      toast({
        title: "Senha redefinida com sucesso!",
        description: "Você será redirecionado para o login",
      });

      // Aguardar um pouco para o usuário ver a mensagem
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verificando link de recuperação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidSession) {
    return null; // Será redirecionado
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-center">
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-2.5"
                >
                  {showPassword ? 
                    <EyeOff className="h-5 w-5 text-muted-foreground" /> : 
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  }
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                A senha deve ter pelo menos 8 caracteres
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-2.5"
                >
                  {showPassword ? 
                    <EyeOff className="h-5 w-5 text-muted-foreground" /> : 
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  }
                </button>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Redefinir Senha
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => navigate('/login')}
              className="text-sm text-muted-foreground"
            >
              Voltar para o login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
