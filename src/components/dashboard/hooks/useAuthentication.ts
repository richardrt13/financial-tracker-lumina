import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";

export const useAuthentication = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      setIsAuthChecking(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUserId(session.user.id);
        } else {
          console.error("Usuário não autenticado");
          toast({
            title: "Erro de Autenticação",
            description: "Você precisa estar logado para acessar esta página.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        toast({
          title: "Erro de Autenticação",
          description: "Houve um problema ao verificar sua autenticação.",
          variant: "destructive"
        });
      } finally {
        setIsAuthChecking(false);
      }
    };
    
    checkUser();
  }, []);

  return { userId, isAuthChecking };
};
