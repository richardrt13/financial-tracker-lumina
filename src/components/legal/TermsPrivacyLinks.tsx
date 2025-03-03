import React from 'react';
import { Link } from '@/components/ui/link';

interface TermsPrivacyLinksProps {
  onTermsClick: () => void;
  onPrivacyClick: () => void;
  className?: string;
}

export const TermsPrivacyLinks = ({
  onTermsClick,
  onPrivacyClick,
  className = "",
}: TermsPrivacyLinksProps) => {
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      Ao continuar, você concorda com nossos{" "}
      <button 
        onClick={onTermsClick}
        className="text-primary hover:underline"
      >
        Termos de Serviço
      </button>{" "}
      e{" "}
      <button 
        onClick={onPrivacyClick}
        className="text-primary hover:underline"
      >
        Política de Privacidade
      </button>
      .
    </div>
  );
};
