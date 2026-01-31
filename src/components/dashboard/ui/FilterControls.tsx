// FilterControls.tsx
import { DateRange } from "react-day-picker"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { 
  startOfMonth, 
  endOfMonth, 
  subDays, 
  startOfYear,
  endOfYear,
  subMonths
} from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"

interface FilterControlsProps {
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
}

export function FilterControls({ 
  dateRange,
  setDateRange
}: FilterControlsProps) {
  const [preset, setPreset] = useState<string>("thisMonth");

  // Helper to check if current range matches a preset
  useEffect(() => {
     // Simple logic to detect if the current manual selection matches a preset could go here
     // For now, we just let it be loose. If user changes dateRange manually, preset might stay or we can clear it.
     // Let's clear preset value if dateRange changes and doesn't match the logic, but that's complex to sync perfectly.
     // We will just use the select to SET the range.
  }, [dateRange]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const today = new Date();
    
    switch (value) {
      case "today":
        setDateRange({ from: today, to: today });
        break;
      case "last7":
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case "last30":
        setDateRange({ from: subDays(today, 29), to: today });
        break;
      case "thisMonth":
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case "last3Months":
        setDateRange({ from: subMonths(today, 3), to: today });
        break;
        case "last6Months":
        setDateRange({ from: subMonths(today, 6), to: today });
        break;
      case "thisYear":
        setDateRange({ from: startOfYear(today), to: endOfYear(today) });
        break;
      case "last12Months":
        setDateRange({ from: subMonths(today, 12), to: today });
        break;
    }
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Período Rápido" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="last7">Últimos 7 dias</SelectItem>
          <SelectItem value="last30">Últimos 30 dias</SelectItem>
          <SelectItem value="thisMonth">Este Mês</SelectItem>
          <SelectItem value="lastMonth">Mês Passado</SelectItem>
          <SelectItem value="last3Months">Últimos 3 Meses</SelectItem>
          <SelectItem value="last6Months">Últimos 6 Meses</SelectItem>
          <SelectItem value="thisYear">Este Ano</SelectItem>
          <SelectItem value="last12Months">Últimos 12 Meses</SelectItem>
        </SelectContent>
      </Select>

      <div className="h-8 w-[1px] bg-border hidden sm:block" />

      <DatePickerWithRange 
        date={dateRange}
        setDate={(range) => {
            setPreset(""); // Clear preset if manual selection happens
            setDateRange(range);
        }}
        className="w-[260px]"
      />
    </div>
  );
}