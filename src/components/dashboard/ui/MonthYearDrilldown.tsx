import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

/** Abreviações como em calendários PT-BR (jan., fev., …) */
const MONTH_ABBR_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
] as const

export interface MonthYearDrilldownProps {
  /** Referência do mês exibido (ex.: primeiro dia do mês). */
  value: Date
  /** Mês civil completo selecionado (1º ao último dia). */
  onMonthSelect: (monthStart: Date) => void
  /** Ano civil completo (1 jan – 31 dez). */
  onYearSelect: (year: number) => void
  minYear?: number
  maxYear?: number
  className?: string
}

function triggerLabel(value: Date): string {
  const s = format(value, "MMMM 'de' yyyy", { locale: ptBR })
  return s.charAt(0).toLowerCase() + s.slice(1)
}

export function MonthYearDrilldown({
  value,
  onMonthSelect,
  onYearSelect,
  minYear = 1970,
  maxYear = 2100,
  className,
}: MonthYearDrilldownProps) {
  const [open, setOpen] = useState(false)
  const [expandedYear, setExpandedYear] = useState<number | null>(null)
  const yearRowRefs = useRef<Map<number, HTMLDivElement | null>>(new Map())

  /** Mais recente primeiro — menos rolagem até o ano atual. */
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)

  useEffect(() => {
    if (open) {
      const y = value.getFullYear()
      setExpandedYear(y)
      requestAnimationFrame(() => {
        yearRowRefs.current.get(y)?.scrollIntoView({ block: "nearest" })
      })
    }
  }, [open, value])

  const selectMonth = (year: number, monthIndex: number) => {
    const monthStart = new Date(year, monthIndex, 1)
    onMonthSelect(monthStart)
    setOpen(false)
  }

  const selectFullYear = (year: number) => {
    onYearSelect(year)
    setOpen(false)
  }

  const isMonthSelected = (year: number, monthIndex: number) =>
    value.getFullYear() === year && value.getMonth() === monthIndex

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 justify-between gap-2 font-normal text-sm px-3",
            className
          )}
          aria-expanded={open}
        >
          <span className="truncate">{triggerLabel(value)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 overflow-hidden"
        align="start"
        sideOffset={6}
      >
        <ScrollArea className="h-[min(70vh,320px)]">
          <div className="py-1">
            {years.map((y) => {
              const expanded = expandedYear === y
              return (
                <div
                  key={y}
                  ref={(el) => {
                    if (el) yearRowRefs.current.set(y, el)
                    else yearRowRefs.current.delete(y)
                  }}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      "hover:bg-muted/80",
                      expanded && "bg-muted/40"
                    )}
                    onClick={() =>
                      setExpandedYear((prev) => (prev === y ? null : y))
                    }
                  >
                    <span>{y}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                  {expanded && (
                    <div className="border-t border-border/40 bg-muted/20 px-2 pb-3 pt-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {MONTH_ABBR_PT.map((abbr, monthIndex) => {
                          const selected = isMonthSelected(y, monthIndex)
                          return (
                            <button
                              key={abbr}
                              type="button"
                              className={cn(
                                "rounded-md px-1 py-2 text-center text-xs font-medium transition-colors",
                                "hover:bg-muted",
                                selected &&
                                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                              )}
                              onClick={() => selectMonth(y, monthIndex)}
                            >
                              {abbr}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md border border-border/80 bg-background py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => selectFullYear(y)}
                      >
                        Ano inteiro ({y})
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
