import { useMemo, useState } from 'react';
import { ShieldCheck, CheckCircle2, Ban, Banknote, RefreshCcw, Copy } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { pointsToBrl, useGameStore } from '@/stores/useGameStore';
import { toast } from '@/components/ui/sonner';

const actionStyles = {
  approve: 'bg-game-blue text-white',
  pay: 'bg-accent text-accent-foreground',
  reject: 'bg-game-red text-white',
} as const;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function maskPixKey(pixKey: string) {
  if (pixKey.includes('@')) {
    const [name, domain] = pixKey.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }

  if (pixKey.length <= 8) return pixKey;
  return `${pixKey.slice(0, 4)}••••${pixKey.slice(-4)}`;
}

export default function Admin() {
  const {
    adminRole,
    adminWithdrawals,
    isAdmin,
    mode,
    refreshAdminWithdrawals,
    reviewWithdrawalRequest,
    sessionUserId,
  } = useGameStore();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const counters = useMemo(() => ({
    pending: adminWithdrawals.filter(item => item.status === 'pending').length,
    approved: adminWithdrawals.filter(item => item.status === 'approved').length,
    paid: adminWithdrawals.filter(item => item.status === 'paid').length,
  }), [adminWithdrawals]);

  const handleRefresh = async () => {
    await refreshAdminWithdrawals();
    toast.success('Fila administrativa atualizada.');
  };

  const handleReview = async (requestId: string, action: 'approve' | 'pay' | 'reject') => {
    setLoadingAction(`${requestId}:${action}`);
    const result = await reviewWithdrawalRequest(requestId, action, notes[requestId]);
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setLoadingAction(null);
  };

  const handleCopyUserId = async () => {
    if (!sessionUserId) return;
    await navigator.clipboard.writeText(sessionUserId);
    toast.success('UUID da sessão copiado.');
  };

  if (mode !== 'supabase') {
    return (
      <AppLayout>
        <div className="px-4 pt-6 space-y-4">
          <h1 className="text-xl font-bold">Painel Admin</h1>
          <div className="glass-card p-4 space-y-2">
            <p className="font-medium">Supabase obrigatório</p>
            <p className="text-sm text-muted-foreground">Conecte o projeto ao Supabase para usar revisão de saques e auditoria.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 space-y-4">
          <h1 className="text-xl font-bold">Painel Admin</h1>
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <p className="font-medium">Acesso restrito</p>
            </div>
            <p className="text-sm text-muted-foreground">Seu usuário atual ainda não está cadastrado na tabela <span className="font-medium text-foreground">admin_users</span>.</p>
            <div className="rounded-xl bg-secondary p-3 text-xs space-y-1">
              <p className="text-muted-foreground">UUID atual da sessão</p>
              <p className="font-mono break-all">{sessionUserId || 'Sessão ainda não carregada'}</p>
            </div>
            <button
              onClick={handleCopyUserId}
              disabled={!sessionUserId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> Copiar UUID da sessão
            </button>
            <p className="text-xs text-muted-foreground">Depois insira esse UUID em <span className="font-medium text-foreground">public.admin_users</span> no Supabase. Assim que fizer isso, recarregue a página.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Revisão manual de saques • papel atual: {adminRole || 'admin'}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium"
          >
            <RefreshCcw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="glass-card p-3">
            <p className="text-muted-foreground text-xs">Pendentes</p>
            <p className="font-bold text-primary">{counters.pending}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-muted-foreground text-xs">Aprovados</p>
            <p className="font-bold">{counters.approved}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-muted-foreground text-xs">Pagos</p>
            <p className="font-bold text-accent">{counters.paid}</p>
          </div>
        </div>

        <div className="space-y-3">
          {adminWithdrawals.length ? adminWithdrawals.map(item => (
            <div key={item.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.userAvatar}</span>
                    <div>
                      <p className="font-semibold text-sm">{item.userName}</p>
                      <p className="text-xs text-muted-foreground break-all">{item.userId}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Criado em {formatDate(item.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  item.status === 'pending'
                    ? 'bg-primary/10 text-primary'
                    : item.status === 'approved'
                      ? 'bg-game-blue/10 text-game-blue'
                      : item.status === 'paid'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-game-red/10 text-game-red'
                }`}>
                  {item.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-semibold">R$ {item.amountBrl.toFixed(2)}</p>
                  <p className="text-muted-foreground">{item.pointsUsed.toLocaleString('pt-BR')} pontos</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Pix</p>
                  <p className="font-semibold break-all">{maskPixKey(item.pixKey)}</p>
                  <p className="text-muted-foreground">{item.lockedEventsCount} eventos travados</p>
                </div>
              </div>

              <div className="rounded-xl bg-secondary p-3 text-xs space-y-1">
                <p className="text-muted-foreground">Saldo reservado no saque</p>
                <p className="font-medium">R$ {pointsToBrl(item.lockedRevenuePoints)}</p>
                <p className="text-muted-foreground">Processado em: {formatDate(item.processedAt)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Risco</p>
                  <p className={`font-semibold ${item.riskLevel === 'high' ? 'text-game-red' : item.riskLevel === 'medium' ? 'text-game-orange' : 'text-accent'}`}>
                    {item.riskLevel} • score {item.riskScore}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Antifraude</p>
                  <p className="font-semibold">{item.fraudHold ? 'Revisão reforçada' : 'Fluxo normal'}</p>
                </div>
              </div>

              <textarea
                value={notes[item.id] || ''}
                onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Observação administrativa"
                className="min-h-20 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40"
              />

              {item.adminNote ? (
                <div className="rounded-xl bg-secondary p-3 text-xs">
                  <p className="text-muted-foreground">Última observação</p>
                  <p className="font-medium">{item.adminNote}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleReview(item.id, 'approve')}
                  disabled={item.status !== 'pending' || loadingAction !== null}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50 ${actionStyles.approve}`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprovar
                </button>
                <button
                  onClick={() => handleReview(item.id, 'pay')}
                  disabled={!['pending', 'approved'].includes(item.status) || loadingAction !== null}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50 ${actionStyles.pay}`}
                >
                  <Banknote className="w-4 h-4" /> Pagar
                </button>
                <button
                  onClick={() => handleReview(item.id, 'reject')}
                  disabled={!['pending', 'approved'].includes(item.status) || loadingAction !== null}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50 ${actionStyles.reject}`}
                >
                  <Ban className="w-4 h-4" /> Rejeitar
                </button>
              </div>
            </div>
          )) : (
            <div className="glass-card p-4 text-sm text-muted-foreground">
              Nenhum saque na fila administrativa.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
