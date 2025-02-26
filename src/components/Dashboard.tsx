
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

  // TODO: Implementar integração com Supabase para buscar os dados reais
  const mockData = {
    receita: 5000,
    despesa: 3000,
    investimento: 1000,
    saldo: 1000,
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
          <Card key={card.type} className="hover:shadow-lg transition-shadow cursor-pointer">
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
    </div>
  );
}
