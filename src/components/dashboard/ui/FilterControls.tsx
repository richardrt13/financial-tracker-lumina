// FilterControls.tsx
import { useMemo, useState } from "react"
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
  subMonths,
  isSameDay,
} from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { MonthYearDrilldown } from "./MonthYearDrilldown"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface FilterControlsProps {
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
}

function isFullCalendarMonthRange(range: DateRange | undefined): boolean {
  if (!range?.from || !range?.to) return false
  const start = startOfMonth(range.from)
  const end = endOfMonth(range.from)
  return (
    isSameDay(range.from, start) &&
    isSameDay(range.to, end) &&
    range.from.getMonth() === range.to.getMonth() &&
    range.from.getFullYear() === range.to.getFullYear()
  )
}

function isFullCalendarYearRange(range: DateRange | undefined): boolean {
  if (!range?.from || !range?.to) return false
  const start = startOfYear(range.from)
  const end = endOfYear(range.from)
  return (
    isSameDay(range.from, start) &&
    isSameDay(range.to, end) &&
    range.from.getFullYear() === range.to.getFullYear()
  )
}

function formatPeriodButtonLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Selecione um período"
  if (range.to && isFullCalendarYearRange(range)) {
    const y = range.from.getFullYear()
    return `Ano ${y}`
  }
  if (range.to && isFullCalendarMonthRange(range)) {
    const s = format(range.from, "MMMM yyyy", { locale: ptBR })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  if (range.to) {
    return `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`
  }
  return format(range.from, "dd/MM/yyyy", { locale: ptBR })
}

export function FilterControls({
  dateRange,
  setDateRange,
}: FilterControlsProps) {
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => dateRange?.from ?? new Date()
  )

  const drilldownValue = useMemo(() => {
    if (!dateRange?.from) return calendarMonth
    if (dateRange.to && isFullCalendarYearRange(dateRange)) return dateRange.from
    if (dateRange.to && isFullCalendarMonthRange(dateRange)) return dateRange.from
    return calendarMonth
  }, [dateRange, calendarMonth])

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
    if (newRange.from) {
      setCalendarMonth(newRange.from)
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover
        onOpenChange={(open) => {
          if (open) {
            setCalendarMonth(dateRange?.from ?? new Date())
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] sm:w-[300px] justify-start text-left font-normal",
              !dateRange?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {formatPeriodButtonLabel(dateRange)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r overflow-y-auto max-h-[min(50vh,320px)] w-full sm:w-[220px] shrink-0">
                {presets.map(preset => (
                  <Button 
                    key={preset.label}
                    variant="ghost" 
                    className="justify-start font-normal text-sm h-9 shrink-0"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
            </div>
            <div className="flex flex-col min-w-0 gap-2 p-2 sm:pt-3 sm:pr-3 sm:pb-2">
              <MonthYearDrilldown
                value={drilldownValue}
                onMonthSelect={(monthStart) => {
                  setCalendarMonth(monthStart)
                  setDateRange({
                    from: startOfMonth(monthStart),
                    to: endOfMonth(monthStart),
                  })
                }}
                onYearSelect={(year) => {
                  const anchor = new Date(year, 0, 1)
                  setCalendarMonth(anchor)
                  setDateRange({
                    from: startOfYear(anchor),
                    to: endOfYear(anchor),
                  })
                }}
                className="w-full max-w-[min(100%,280px)]"
              />
               <Calendar
                initialFocus
                mode="range"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
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
