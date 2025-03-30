// Funções de formatação

/**
 * Formata um número para exibição em moeda brasileira
 */
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

/**
 * Formata uma data para o formato brasileiro
 */
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
};

/**
 * Formata uma porcentagem para exibição
 */
export const formatPercentage = (value: number): string => {
  return `${value}%`;
};
