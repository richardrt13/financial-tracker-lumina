import { createClient } from '@supabase/supabase-js';

// Estas variáveis são lidas do ambiente do SERVIDOR na Vercel.
// Elas NÃO devem ter o prefixo VITE_, exceto a URL que pode ser compartilhada.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Verificação para garantir que as variáveis de ambiente foram carregadas corretamente
if (!supabaseUrl || !supabaseServiceKey) {
  // Este erro será mostrado nos logs da Vercel se as variáveis não estiverem configuradas
  throw new Error('As variáveis de ambiente do Supabase (URL ou Service Key) não foram encontradas.');
}

/**
 * Cliente Supabase Admin
 * * Usa a chave de serviço para bypassar o Row Level Security (RLS).
 * IMPORTANTE: Use este cliente APENAS em código do lado do servidor (como em /api),
 * NUNCA exponha no frontend.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);