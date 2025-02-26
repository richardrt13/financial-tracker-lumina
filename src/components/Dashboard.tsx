import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Importe o cliente Supabase
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const summaryCards = [
  { title: "Receitas", type: "receita", color: "text-green-600" },
  { title: "Despesas", type: "despesa", color: "text-red-600" },
  { title: "Investimentos", type: "investimento", color: "text-blue-600" },
  { title: "Saldo", type: "saldo", color: "text-purple-600" },
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type Transaction = {
  id: number;
  year: string;
  month: string;
  type: string;
  category: string;
  amount: number;
  description?: string;
  created_at: string;
};

type TransactionsData = {
  receita: Transaction[];
  despesa: Transaction[];
  investimento: Transaction[];
};

type SummaryData = {
  receita: number;
  despesa: number;
  investimento: number;
  saldo: number;
};

export function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    receita: 0,
    despesa: 0,
    investimento: 0,
    saldo: 0,
  });
  const [transactionsData, setTransactionsData] = useState<TransactionsData>({
    receita: [],
    despesa: [],
    investimento: [],
  });
  const [userId, setUserId] = useState<string | null>(null);

  // Verificar se o usuário está autenticado
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    
    checkUser();
  }, []);

  // Buscar dados com base na seleção de ano e mês
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      setIsLoading(true);
      
      try {
        // Buscar todas as transações do mês e ano selecionados
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('year', selectedYear)
          .eq('month', selectedMonth);
          
        if (error) {
          console.error('Erro ao buscar transações:', error);
          return;
        }
        
        // Organizar transações por tipo
        const transactionsByType: TransactionsData = {
          receita: [],
          despesa: [],
          investimento: [],
        };
        
        // Calcular valores totais
        let totalReceita = 0;
        let totalDespesa = 0;
        let totalInvestimento = 0;
        
        data.forEach((transaction: Transaction) => {
          // Adicionar à lista do tipo correspondente
          if (transaction.type === 'receita' || transaction.type === 'despesa' || transaction.type === 'investimento') {
            transactionsByType[transaction.type as keyof TransactionsData].push(transaction);
          }
          
          // Somar aos totais
          if (transaction.type === 'receita') {
            totalReceita += transaction.amount;
          } else if (transaction.type === 'despesa') {
            totalDespesa += transaction.amount;
          } else if (transaction.type === 'investimento') {
            totalInvestimento += transaction.amount;
          }
        });
        
        // Calcular saldo
        const saldo = totalReceita - totalDespesa - totalInvestimento;
        
        // Atualizar estados
        setTransactionsData(transactionsByType);
        setSummaryData({
          receita: totalReceita,
          despesa: totalDespesa,
          investimento: totalInvestimento,
          saldo: saldo,
        });
      } catch (err) {
        console.error('Erro ao processar dados:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [userId, selectedYear, selectedMonth]);

  const handleCardClick = (type: string) => {
    if (type !== 'saldo') {
      setSelectedType(type);
      setIsDialogOpen(true);
    }
  };

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-6">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o ano" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card 
              key={card.type} 
              className={`hover:shadow-lg transition-shadow ${card.type !== 'saldo' ? 'cursor-pointer' : ''}`}
              onClick={() => handleCardClick(card.type)}
            >
              <CardHeader>
                <CardTitle className={card.color}>{card.title}</CardTitle>
                <CardDescription>
                  {selectedMonth} / {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${card.color}`}>
                  R$ {summaryData[card.type as keyof SummaryData].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Detalhes das {selectedType === 'receita' ? 'Receitas' : 
                           selectedType === 'despesa' ? 'Despesas' : 'Investimentos'}
              <span className="text-gray-500 text-sm ml-2">
                {selectedMonth} / {selectedYear}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedType && transactionsData[selectedType as keyof TransactionsData]?.length > 0 ? (
              transactionsData[selectedType as keyof TransactionsData]?.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{transaction.description || transaction.category}</h3>
                      <p className="text-sm text-gray-500">{transaction.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-gray-500">
                Nenhuma transação encontrada para este período.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
