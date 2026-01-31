// /components/dashboard/types.ts

export type Transaction = {
  id: number;
  type: 'receita' | 'despesa' | 'investimento';
  amount: number;
  category: string;
  description: string | null;
  date: string; // Nova coluna
  month: string;
  year: string;
  // is_completed: boolean; --> DEPRECATED
  status: 'pending' | 'verified' | 'cancelled' | 'scheduled' | 'overdue'; // Nova Fonte da Verdade
  is_completed?: boolean; // Mantido para compatibilidade retroativa temporária em alguns componentes UI
  completed_at: string | null;
  created_at: string;
  due_day: number | null;
  user_id: string;
  budget_id: string;
  linked_income_id?: string | null;
  linked_income_details?: {
    description?: string;
    category: string;
    amount: number;
  };
  remaining_after_links?: number; // Adicionado: Saldo restante da receita após débitos vinculados
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
  linked_income_id?: string | null;
};