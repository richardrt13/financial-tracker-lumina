// /components/dashboard/ui/DueSoonAlert.tsx
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { DueSoonData } from "../types";

interface DueSoonAlertProps {
  dueSoonData: DueSoonData;
  onShowDetails: () => void;
}

export function DueSoonAlert({ dueSoonData, onShowDetails }: DueSoonAlertProps) {
  if (dueSoonData.count === 0) return null;

  return (
    <div className="w-full sm:w-auto">
      <Button 
        variant="outline" 
        className="w-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        onClick={onShowDetails}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        {dueSoonData.count} pagamento{dueSoonData.count > 1 ? 's' : ''} a vencer 
        (R$ {dueSoonData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
      </Button>
    </div>
  );
}