import { Transaction, VencimentoStatus } from '../types';

/**
 * Ordena transações por data de vencimento
 */
export const sortTransactionsByDueDay = (transactions: Transaction[]): Transaction[] => {
  return [...transactions].sort((a, b) => {
    // Se não tiver due_day, coloca no final
    if (!a.due_day) return 1;
    if (!b.due_day) return -1;
    return a.due_day - b.due_day;
  });
};

/**
 * Calcula os dias restantes até o vencimento
 */
export const getDaysToVencimento = (dueDay: number | undefined): number | null => {
  if (!dueDay) return null;
  
  const today = new Date();
  const currentDay = today.getDate();
  
  // Calcular dias restantes
  return dueDay - currentDay;
};

/**
 * Determina o status de vencimento (atrasado, hoje, próximo, normal)
 */
export const getVencimentoStatus = (dueDay: number | undefined): VencimentoStatus => {
  if (!dueDay) return null;
  
  const daysLeft = getDaysToVencimento(dueDay);
  
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "atrasado";
  if (daysLeft === 0) return "hoje";
  if (daysLeft <= 3) return "proximo";
  return "normal";
};

/**
 * Funções relacionadas à definição dos meses e anos para filtros
 */
export const getYears = (): number[] => {
  return Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
};

export const getMonths = (): string[] => {
  return [
    "Todos os Meses",
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
};

/**
 * Obtém o mês atual como string
 */
export const getCurrentMonthName = (): string => {
  const currentMonth = new Date().getMonth() + 1;
  return getMonths()[currentMonth];
};
