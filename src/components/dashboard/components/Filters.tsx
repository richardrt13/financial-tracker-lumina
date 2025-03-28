import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { years, months } from "../types";

interface FiltersProps {
  selectedYear: string;
  selectedMonth: string;
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
}

export function Filters({ selectedYear, selectedMonth, onYearChange, onMonthChange }: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Select value={selectedYear} onValueChange={onYearChange}>
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

      <Select value={selectedMonth} onValueChange={onMonthChange}>
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
  );
}
