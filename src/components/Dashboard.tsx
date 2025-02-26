
import { useState } from 'react';
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

export function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // TODO: Implementar integração com Supabase para buscar os dados reais
  const mockData = {
    receita: 5000,
    despesa: 3000,
    investimento: 1000,
    saldo: 1000,
  };

  // TODO: Implementar integração com Supabase para buscar as transações
  const mockTransactions = {
    receita: [
      { id: 1, description: "Salário", amount: 4000, category: "Salário", date: "2024-03-15" },
      { id: 2, description: "Freelance", amount: 1000, category: "Freelance", date: "2024-03-20" },
    ],
    despesa: [
      { id: 3, description: "Aluguel", amount: 2000, category: "Moradia", date: "2024-03-05" },
      { id: 4, description: "Mercado", amount: 1000, category: "Alimentação", date: "2024-03-10" },
    ],
    investimento: [
      { id: 5, description: "Tesouro Direto", amount: 500, category: "Renda Fixa", date: "2024-03-01" },
      { id: 6, description: "Ações", amount: 500, category: "Ações", date: "2024-03-01" },
    ],
  };

  const handleCardClick = (type: string) => {
    if (type !== 'saldo') {
      setSelectedType(type);
      setIsDialogOpen(true);
    }
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
                R$ {mockData[card.type as keyof typeof mockData].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

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
            {selectedType && mockTransactions[selectedType as keyof typeof mockTransactions]?.map((transaction) => (
              <div 
                key={transaction.id} 
                className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{transaction.description}</h3>
                    <p className="text-sm text-gray-500">{transaction.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
