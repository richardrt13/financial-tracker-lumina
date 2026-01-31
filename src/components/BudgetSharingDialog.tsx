import { useState } from 'react';
import { Share2, Users, UserPlus, Check, X, Mail, Shield, Trash2 } from 'lucide-react';
import { useBudgetSharing } from '@/hooks/useBudgetSharing';
import { Budget } from '@/hooks/useBudgets';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BudgetSharingDialogProps {
  budget: Budget;
  userId: string;
}

export const BudgetSharingDialog = ({ budget, userId }: BudgetSharingDialogProps) => {
  const {
    isLoading,
    sharedByMe,
    shareBudget,
    removeShare,
    updatePermission,
  } = useBudgetSharing(userId);

  const [open, setOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<string | null>(null);

  // Filtrar compartilhamentos deste orçamento
  const currentBudgetShares = sharedByMe.filter(
    (share) => share.budget_id === budget.id
  );

  const handleShare = async () => {
    if (!shareEmail.trim()) return;

    const success = await shareBudget(budget.id, shareEmail, sharePermission);
    if (success) {
      setShareEmail('');
      setSharePermission('view');
    }
  };

  const handleRemoveShare = async () => {
    if (!shareToDelete) return;
    const success = await removeShare(shareToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setShareToDelete(null);
    }
  };

  const confirmRemove = (shareId: string) => {
    setShareToDelete(shareId);
    setDeleteDialogOpen(true);
  };

  const getPermissionBadge = (permission: 'view' | 'edit') => {
    return permission === 'edit' ? (
      <Badge variant="default" className="bg-blue-500">
        <Shield className="w-3 h-3 mr-1" />
        Editar
      </Badge>
    ) : (
      <Badge variant="secondary">
        <Shield className="w-3 h-3 mr-1" />
        Visualizar
      </Badge>
    );
  };

  const getStatusBadge = (status: 'pending' | 'accepted' | 'rejected') => {
    switch (status) {
      case 'accepted':
        return (
          <Badge variant="default" className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            Aceito
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
            Pendente
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <X className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Compartilhar Orçamento: {budget.name}
            </DialogTitle>
            <DialogDescription>
              Compartilhe este orçamento com outros usuários da plataforma
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="share" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="share">
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Pessoa
              </TabsTrigger>
              <TabsTrigger value="manage">
                <Users className="w-4 h-4 mr-2" />
                Gerenciar ({currentBudgetShares.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="share" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Convidar usuário</CardTitle>
                  <CardDescription>
                    Digite o email do usuário que você deseja convidar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email do usuário</Label>
                    <div className="flex gap-2">
                      <Mail className="w-4 h-4 mt-3 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleShare();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="permission">Nível de permissão</Label>
                    <Select
                      value={sharePermission}
                      onValueChange={(value: 'view' | 'edit') =>
                        setSharePermission(value)
                      }
                    >
                      <SelectTrigger id="permission">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <div>
                              <div className="font-medium">Visualizar</div>
                              <div className="text-xs text-gray-500">
                                Pode apenas ver transações e relatórios
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="edit">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-medium">Editar</div>
                              <div className="text-xs text-gray-500">
                                Pode adicionar, editar e excluir transações
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>💡 Dica de segurança:</strong> O usuário receberá um
                      convite que precisa ser aceito antes de ter acesso ao orçamento.
                      Você pode revogar o acesso a qualquer momento.
                    </p>
                  </div>

                  <Button
                    onClick={handleShare}
                    disabled={!shareEmail.trim() || isLoading}
                    className="w-full"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Enviar Convite
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manage" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                {currentBudgetShares.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Este orçamento ainda não foi compartilhado</p>
                        <p className="text-sm mt-2">
                          Use a aba "Adicionar Pessoa" para convidar alguém
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {currentBudgetShares.map((share) => (
                      <Card key={share.share_id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                                  {share.recipient_name
                                    ? share.recipient_name.charAt(0).toUpperCase()
                                    : share.recipient_email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {share.recipient_name || 'Usuário'}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {share.recipient_email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-3">
                                {getStatusBadge(share.status)}
                                {getPermissionBadge(share.permission)}
                              </div>

                              <p className="text-xs text-gray-500 mt-2">
                                Compartilhado em{' '}
                                {new Date(share.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2">
                              {share.status === 'accepted' && (
                                <Select
                                  value={share.permission}
                                  onValueChange={(value: 'view' | 'edit') =>
                                    updatePermission(share.share_id, value)
                                  }
                                  disabled={isLoading}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="view">Visualizar</SelectItem>
                                    <SelectItem value="edit">Editar</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmRemove(share.share_id)}
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover compartilhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover o acesso do usuário a este orçamento. Esta ação
              não pode ser desfeita, mas você pode compartilhar novamente no futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveShare}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Componente para exibir convites pendentes
interface PendingInvitesProps {
  userId: string;
}

export const PendingInvites = ({ userId }: PendingInvitesProps) => {
  const { pendingInvites, acceptInvite, rejectInvite, isLoading } =
    useBudgetSharing(userId);

  if (pendingInvites.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
          <Mail className="w-5 h-5" />
          Convites Pendentes ({pendingInvites.length})
        </CardTitle>
        <CardDescription className="text-yellow-700 dark:text-yellow-300">
          Você tem convites para compartilhamento de orçamentos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingInvites.map((invite) => (
          <Card key={invite.share_id} className="bg-white dark:bg-gray-900">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-lg mb-1">{invite.budget_name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Convidado por{' '}
                    <strong>{invite.owner_name || invite.owner_email}</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    {invite.permission === 'edit' ? (
                      <Badge variant="default" className="bg-blue-500">
                        <Shield className="w-3 h-3 mr-1" />
                        Permissão de edição
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Shield className="w-3 h-3 mr-1" />
                        Apenas visualização
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => acceptInvite(invite.share_id)}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectInvite(invite.share_id)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

// Componente para exibir orçamentos compartilhados comigo
interface SharedWithMeBudgetsProps {
  userId: string;
}

export const SharedWithMeBudgets = ({ userId }: SharedWithMeBudgetsProps) => {
  const { sharedWithMe } = useBudgetSharing(userId);

  if (sharedWithMe.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Orçamentos Compartilhados Comigo ({sharedWithMe.length})
        </CardTitle>
        <CardDescription>
          Orçamentos que outros usuários compartilharam com você
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sharedWithMe.map((share) => (
          <div
            key={share.share_id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                {share.budget_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{share.budget_name}</p>
                <p className="text-sm text-gray-500">
                  Por {share.owner_name || share.owner_email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {share.permission === 'edit' ? (
                <Badge variant="default" className="bg-blue-500">
                  <Shield className="w-3 h-3 mr-1" />
                  Editar
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Shield className="w-3 h-3 mr-1" />
                  Visualizar
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
