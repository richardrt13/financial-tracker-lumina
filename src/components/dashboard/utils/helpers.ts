// helpers.ts
import { Transaction } from '../types';

export function getDaysToVencimento(dueDay: number | undefined) {
  if (!dueDay) return null;

  const today = new Date();
  const currentDay = today.getDate();

  return dueDay - currentDay;
}

export const getVencimentoStatus = (dueDay: number | undefined) => {
  if (!dueDay) return null;
  
  const daysLeft = getDaysToVencimento(dueDay);
  
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "atrasado";
  if (daysLeft === 0) return "hoje";
  if (daysLeft <= 3) return "proximo";
  return "normal";
};

export const sortTransactionsByDueDay = (transactions: Transaction[]) => {
  return [...transactions].sort((a, b) => {
    if (!a.due_day) return 1;
    if (!b.due_day) return -1;
    return a.due_day - b.due_day;
  });
};

export const checkSupabaseConnection = async (supabase: any) => {
  try {
    const { data, error } = await supabase.from('transactions').select('count').limit(1);
    if (error) {
      console.error('Erro de conexão com Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Falha ao verificar conexão com Supabase:', err);
    return false;
  }
};