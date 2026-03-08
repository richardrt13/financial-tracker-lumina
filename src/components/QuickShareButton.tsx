import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { useBudgetSharing } from '@/hooks/useBudgetSharing';
import { Budget } from '@/hooks/useBudgets';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QuickShareButtonProps {
  budget: Budget;
  userId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Botão de compartilhamento rápido
 * Versão simplificada para adicionar facilmente em qualquer lugar
 */
export const QuickShareButton = ({ 
  budget, 
  userId,
  variant = 'outline',
  size = 'sm'
}: QuickShareButtonProps) => {
  const { shareBudget, isLoading } = useBudgetSharing(userId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [success, setSuccess] = useState(false);

  const handleShare = async () => {
    if (!email.trim()) return;

    const result = await shareBudget(budget.id, email, permission);
    
    if (result) {
      setSuccess(true);
      setEmail('');
      
      // Fechar após 2 segundos de sucesso
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Compartilhar Orçamento</h4>
            <p className="text-sm text-muted-foreground">
              Envie um convite para outro usuário
            </p>
          </div>

          {success ? (
            <div className="flex items-center justify-center py-4 text-green-600">
              <Check className="w-6 h-6 mr-2" />
              <span className="font-medium">Convite enviado!</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="quick-share-email">Email do usuário</Label>
                <Input
                  id="quick-share-email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleShare();
                    }
                  }}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-share-permission">Permissão</Label>
                <Select
                  value={permission}
                  onValueChange={(value: 'view' | 'edit') => setPermission(value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="quick-share-permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Apenas Visualizar</SelectItem>
                    <SelectItem value="edit">Visualizar e Editar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleShare} 
                className="w-full"
                disabled={!email.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Badge de indicação de orçamento compartilhado
 */
interface SharedBadgeProps {
  isShared: boolean;
  permission?: 'view' | 'edit';
  sharedCount?: number;
}

export const SharedBadge = ({ isShared, permission, sharedCount }: SharedBadgeProps) => {
  if (!isShared) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/15 text-primary">
      <Share2 className="w-3 h-3" />
      {sharedCount ? `${sharedCount} ${sharedCount === 1 ? 'pessoa' : 'pessoas'}` : 'Compartilhado'}
      {permission && ` • ${permission === 'edit' ? 'Edição' : 'Visualização'}`}
    </span>
  );
};

/**
 * Indicador compacto de status de compartilhamento
 */
interface ShareStatusIndicatorProps {
  userId: string;
  budgetId: string;
}

export const ShareStatusIndicator = ({ userId, budgetId }: ShareStatusIndicatorProps) => {
  const { sharedByMe } = useBudgetSharing(userId);
  
  const sharesForBudget = sharedByMe.filter(
    (share) => share.budget_id === budgetId && share.status === 'accepted'
  );

  if (sharesForBudget.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Share2 className="w-3 h-3" />
      <span>{sharesForBudget.length}</span>
    </div>
  );
};
