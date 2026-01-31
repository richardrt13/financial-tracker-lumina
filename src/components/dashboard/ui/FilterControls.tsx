// FilterControls.tsx
import { DateRange } from "react-day-picker"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"

interface FilterControlsProps {
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
}

export function FilterControls({ 
  dateRange,
  setDateRange
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <DatePickerWithRange 
        date={dateRange}
        setDate={setDateRange}
      />
    </div>
  );
}