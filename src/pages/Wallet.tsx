import { ArrowDownToLine, Clock, CheckCircle2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import PointsBadge from '@/components/ui/PointsBadge';
import {
  centsToBrl,
  MIN_WITHDRAW_POINTS,
  POINTS_PER_REAL,
  pointsToBrl,
  useGameStore,
} from '@/stores/useGameStore';
import { useState } from 'react';

const statusConfig = {
  pending: { label: 'Pendente', icon: Clock, color: 'text-primary bg-primary/10' },
  approved: { label: 'Aprovado', icon: CheckCircle2, color: 'text-game-blue bg-game-blue/10' },
  paid: { label: 'Pago', icon: CheckCircle2, color: 'text-accent bg-accent/10' },
};

export default function Wallet() {
  const { profile, withdrawals, requestWithdrawal, economy, mode, revenueEvents } = useGameStore();
  const [pixKey, setPixKey] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const withdrawableReais = pointsToBrl(profile.withdrawablePoints);
  const pendingReais = pointsToBrl(profile.pendingWithdrawablePoints);
  const canWithdraw = profile.withdrawablePoints >= MIN_WITHDRAW_POINTS;
  const recentRevenue = revenueEvents.slice(0, 4);

  const handleWithdrawal = async () => {
    setSubmitting(true);
    const result = await requestWithdrawal(pixKey);
    setFeedback(result.message);
    if (result.ok) {
      setPixKey('');
    }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <h1 className="text-xl font-bold">Carteira</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus ganhos</p>
        </div>

        {/* Balance Card */}
        <div className="glass-card p-5 space-y-4 glow-primary" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '60ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Saldo sacável</span>
            <PointsBadge points={profile.withdrawablePoints} size="sm" />
          </div>
          <p className="text-3xl font-bold text-gradient-primary">R$ {withdrawableReais}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Pendente de validação</p>
              <p className="font-semibold">R$ {pendingReais}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Score total</p>
              <p className="font-semibold">{profile.points.toLocaleString('pt-BR')} pts</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{POINTS_PER_REAL} pontos sacáveis = R$ 1,00 • Mínimo: R$ {pointsToBrl(MIN_WITHDRAW_POINTS)} • {mode === 'supabase' ? 'dados sincronizados' : 'fallback local ativo'}</p>
        </div>

        <div className="glass-card p-4 space-y-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '90ms' }}>
          <h3 className="font-semibold text-sm">Modelo recomendado de distribuição</h3>
          <p className="text-xs text-muted-foreground">{economy.recommendedModel}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-primary/10 rounded-xl p-2">
              <p className="text-[10px] text-muted-foreground">Usuário</p>
              <p className="font-bold text-primary">{economy.userSharePct}%</p>
            </div>
            <div className="bg-secondary rounded-xl p-2">
              <p className="text-[10px] text-muted-foreground">Site</p>
              <p className="font-bold">{economy.siteSharePct}%</p>
            </div>
            <div className="bg-secondary rounded-xl p-2">
              <p className="text-[10px] text-muted-foreground">Liquidação</p>
              <p className="font-bold">{economy.settlementDays} dias</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Receita qualificada acumulada: R$ {centsToBrl(economy.qualifiedRevenueCents)} • quota total do usuário: R$ {centsToBrl(economy.userShareCents)} • quota do site: R$ {centsToBrl(economy.siteShareCents)}</p>
          <p className="text-[11px] text-muted-foreground">Dentro dos 20% do site: {economy.operatorSharePct}% para operação e {economy.reserveSharePct}% para reserva, eventos e promoções.</p>
        </div>

        {/* Withdraw */}
        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '120ms' }}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-primary" /> Solicitar Saque via Pix
          </h3>
          <p className="text-xs text-muted-foreground">Só entra em saque o saldo já validado. Bônus, jogos e receita ainda em análise não viram saque imediato.</p>
          <input
            type="text"
            placeholder="Sua chave Pix"
            value={pixKey}
            onChange={e => setPixKey(e.target.value)}
            className="w-full bg-secondary rounded-xl px-3.5 py-2.5 text-sm border border-border focus:border-primary/50 outline-none transition-colors"
          />
          <button
            onClick={handleWithdrawal}
            disabled={!canWithdraw || !pixKey || submitting}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
              canWithdraw && pixKey && !submitting
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {submitting ? 'Enviando...' : canWithdraw ? `Sacar R$ ${withdrawableReais}` : `Mínimo R$ ${pointsToBrl(MIN_WITHDRAW_POINTS)} para saque`}
          </button>
          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
        </div>

        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '150ms' }}>
          <h3 className="font-semibold text-sm">Observabilidade de receita</h3>
          {recentRevenue.length ? recentRevenue.map(event => (
            <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3 text-xs">
              <div>
                <p className="font-medium text-sm">{event.title}</p>
                <p className="text-muted-foreground">Receita: R$ {centsToBrl(event.qualifiedRevenueCents)} • Usuário: R$ {centsToBrl(event.userShareCents)}</p>
              </div>
              <span className={`rounded-full px-2 py-1 font-medium ${event.status === 'available' ? 'bg-accent/15 text-accent' : event.status === 'withdrawn' ? 'bg-game-blue/15 text-game-blue' : event.status === 'locked' ? 'bg-game-orange/15 text-game-orange' : 'bg-primary/10 text-primary'}`}>
                {event.status === 'available' ? 'liberado' : event.status === 'withdrawn' ? 'sacado' : event.status === 'locked' ? 'reservado' : 'pendente'}
              </span>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground">Ainda não há eventos de receita registrados.</p>
          )}
        </div>

        {/* History */}
        <div className="space-y-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '180ms' }}>
          <h3 className="font-semibold text-sm">Histórico de Saques</h3>
          {withdrawals.map(w => {
            const cfg = statusConfig[w.status];
            return (
              <div key={w.id} className="glass-card p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                  <cfg.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">R$ {w.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{w.date}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
