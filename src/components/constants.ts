// Lista de meses em português
export const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Função para obter o número máximo de dias em um mês específico
export const getDaysInMonth = (month, year) => {
  // Converte o nome do mês para o índice (0-11)
  const monthIndex = months.indexOf(month);
  // Retorna o último dia do mês (passando 0 como dia do próximo mês)
  return new Date(parseInt(year), monthIndex + 1, 0).getDate();
};

// Categorias padrão para transações
export const defaultCategories = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Outros"],
  investimento: ["Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Outros"]
};