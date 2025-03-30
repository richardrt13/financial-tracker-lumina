import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from "@/components/ui/use-toast";

export const useSupabaseConnection = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const checkSupabaseConnection = async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('count').limit(1);
      if (error) {
        console.error('Erro de conexão com Supabase:', error);
        setIsConnected(false);
        return false;
      }
      setIsConnected(true);
      return true;
    } catch (err) {
      console.error('Falha ao verificar conexão com Supabase:', err);
      setIsConnected(false);
      return false;
    }
  };

  useEffect(() => {
    checkSupabaseConnection()
      .then(connected => {
        if (!connected) {
          toast({
            title: "Problemas de Conexão",
            description: "Não foi possível conectar ao banco de dados. Verifique sua conexão.",
            variant: "destructive"
          });
        }
      });
  }, []);

  return { isConnected, checkSupabaseConnection };
};
