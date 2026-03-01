// helpers.ts
import { Transaction } from '../types';

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Retorna a data de vencimento (início do dia) com base em month, year e due_day da transação. */
export function getDueDate(transaction: Pick<Transaction, 'due_day' | 'month' | 'year'>): Date | null {
  if (transaction.due_day == null || !transaction.month || !transaction.year) return null;
  const monthIndex = MONTH_NAMES.indexOf(transaction.month);
  if (monthIndex === -1) return null;
  const year = parseInt(transaction.year, 10);
  if (isNaN(year)) return null;
  const due = new Date(year, monthIndex, transaction.due_day);
  if (due.getDate() !== transaction.due_day) return null;
  return due;
}

/** Dias até o vencimento (negativo = atrasado). Usa a data completa (dia + mês + ano). */
export function getDaysToVencimento(transaction: Pick<Transaction, 'due_day' | 'month' | 'year'>): number | null {
  const due = getDueDate(transaction);
  if (!due) return null;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueStart.getTime() - todayStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const getVencimentoStatus = (transaction: Pick<Transaction, 'due_day' | 'month' | 'year'>) => {
  if (!transaction.due_day) return null;
  const daysLeft = getDaysToVencimento(transaction);
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