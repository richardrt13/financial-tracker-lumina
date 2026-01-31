// FilterControls.tsx
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { ptBR } from "date-fns/locale"
import { 
  startOfMonth, 
  endOfMonth, 
  subDays, 
  startOfYear, 
  endOfYear, 
  subMonths
} from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface FilterControlsProps {
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
}

export function FilterControls({ 
  dateRange,
  setDateRange
}: FilterControlsProps) {

  const presets = [
    { label: "Hoje", getValue: () => { const t = new Date(); return { from: t, to: t } } },
    { label: "Últimos 7 dias", getValue: () => { const t = new Date(); return { from: subDays(t, 6), to: t } } },
    { label: "Últimos 30 dias", getValue: () => { const t = new Date(); return { from: subDays(t, 29), to: t } } },
    { label: "Este Mês", getValue: () => { const t = new Date(); return { from: startOfMonth(t), to: endOfMonth(t) } } },
    { label: "Mês Passado", getValue: () => { const t = new Date(); const m = subMonths(t, 1); return { from: startOfMonth(m), to: endOfMonth(m) } } },
    { label: "Últimos 3 Meses", getValue: () => { const t = new Date(); return { from: subMonths(t, 3), to: t } } },
    { label: "Últimos 6 Meses", getValue: () => { const t = new Date(); return { from: subMonths(t, 6), to: t } } },
    { label: "Este Ano", getValue: () => { const t = new Date(); return { from: startOfYear(t), to: endOfYear(t) } } },
    { label: "Últimos 12 Meses", getValue: () => { const t = new Date(); return { from: subMonths(t, 12), to: t } } },
  ];

  const handlePresetSelect = (preset: typeof presets[0]) => {
    const newRange = preset.getValue();
    setDateRange(newRange);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] sm:w-[300px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 p-3 border-r overflow-y-auto max-h-[300px]">
                {presets.map(preset => (
                  <Button 
                    key={preset.label}
                    variant="ghost" 
                    className="justify-start font-normal text-sm"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
            </div>
            <div className="p-0">
               <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}