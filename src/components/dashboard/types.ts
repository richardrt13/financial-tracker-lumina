// Definição de tipos para o Dashboard

export type Transaction = {
  id: number;
  year: string;
  month: string;
  type: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
  user_id: string;
  is_completed: boolean;
  completed_at?: string;
  due_day?: number;
};

export type TransactionsData = {
  receita: Transaction[];
  despesa: Transaction[];
  investimento: Transaction[];
  [key: string]: Transaction[];
};

export type SummaryData = {
  receita: number;
  despesa: number;
  investimento: number;
  saldo: number;
  [key: string]: number;
};

export type CompletionData = {
  receita: {
    count: number;
    completed: number;
    percentage: number;
  };
  despesa: {
    count: number;
    completed: number;
    percentage: number;
  };
  investimento: {
    count: number;
    completed: number;
    percentage: number;
  };
  [key: string]: {
    count: number;
    completed: number;
    percentage: number;
  };
};

export type DueSoonData = {
  count: number;
  amount: number;
  transactions: Transaction[];
};

export type EditFormData = {
  description: string;
  category: string;
  amount: string;
  due_day: string;
};

export type SummaryCardType = {
  title: string;
  type: string;
  color: string;
};
