// formatters.ts
export const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  // Ajusta para o timezone local
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  
  return localDate.toLocaleDateString('pt-BR');
};

export const formatDateTime = (dateString: string | undefined) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  // Ajusta para o timezone local
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  
  return localDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};