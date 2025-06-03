import React from 'react';
import { Input } from './input'; // Seu componente Input existente
import { cn } from '@/lib/utils';

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ date, onDateChange, className, disabled }: DatePickerProps) {
  const formatDateForInput = (dateObj: Date | undefined) => {
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    // Formato YYYY-MM-DD exigido pelo input type="date"
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      // O mês no construtor Date é 0-indexado
      const newDate = new Date(year, month - 1, day);
       if (!isNaN(newDate.getTime())) {
        onDateChange(newDate);
      } else {
        onDateChange(undefined); // Data inválida
      }
    } else {
      onDateChange(undefined);
    }
  };

  return (
    <Input
      type="date"
      value={formatDateForInput(date)}
      onChange={handleInputChange}
      className={cn("w-full", className)}
      disabled={disabled}
    />
  );
}