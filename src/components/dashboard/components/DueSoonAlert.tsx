import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { DueSoonData } from '../types';
import { formatCurrency } from '../utils/formatters';

interface DueSoonAlertProps {
  dueSoonData: DueSoonData;
  onClick: () => void;
}

export const DueSoonAlert: React.FC<DueSoonAlertProps> = ({ dueSoonData, onClick }) => {
  if (dueSoonData.count === 0) {
    return null;
  }
  
  return (
    <div className="w-full sm:w-auto">
      <Button 
        variant="outline" 
        className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        onClick={onClick}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer 
        (R$ {formatCurrency(dueSoonData.amount)})
      </Button>
    </div>
  );
};
