import { Share2, Copy, Trophy, Zap, Flame, Medal, ShieldCheck, LogOut } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import XPBar from '@/components/ui/XPBar';
import PointsBadge from '@/components/ui/PointsBadge';
import { centsToBrl, useGameStore } from '@/stores/useGameStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';

const AVATARS = ['🎮', '🦊', '🐱', '🐶', '🦄', '🐼', '🦁', '🐸', '🎃', '🤖', '👾', '🎯'];

const BADGES = [
  { icon: '🔥', label: 'Streak 3 dias', unlocked: true },
  { icon: '⭐', label: 'Nível 5', unlocked: false },
  { icon: '🏆', label: '50 tarefas', unlocked: false },
  { icon: '🎯', label: '10 jogos', unlocked: false },
  { icon: '💎', label: 'R$ 50 sacados', unlocked: false },
  { icon: '👥', label: '5 indicações', unlocked: false },
];

const RANKING = [
  { name: 'Maria S.', points: 12450, avatar: '🦊' },
  { name: 'Carlos R.', points: 9820, avatar: '🐱' },
  { name: 'Ana L.', points: 7340, avatar: '🦄' },
  { name: 'Pedro M.', points: 5100, avatar: '🐼' },
  { name: 'Julia F.', points: 3200, avatar: '🐸' },
];

export default function Profile() {
  const { profile, updateProfile, sessionUserId, isAdmin, adminRole, economy, applyReferralCode, referralLeaderboard, signOut } = useGameStore();
  const [showAvatars, setShowAvatars] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [applyingReferral, setApplyingReferral] = useState(false);
  const navigate = useNavigate();

  const copyReferral = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${profile.referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySessionId = () => {
    if (!sessionUserId) return;
    navigator.clipboard.writeText(sessionUserId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
  };

  const handleApplyReferral = async () => {
    setApplyingReferral(true);
    const result = await applyReferralCode(referralInput);
    if (result.ok) {
      toast.success(result.message);
      setReferralInput('');
    } else {
      toast.error(result.message);
    }
    setApplyingReferral(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sessão encerrada com sucesso.');
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        <div className="flex items-center justify-between" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
          <div>
            <h1 className="text-xl font-bold">Perfil</h1>
            <p className="text-xs text-muted-foreground">Gerencie sua conta e seus dados</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>

        {/* Profile Header */}
        <div className="flex flex-col items-center gap-3 pt-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <button
            onClick={() => setShowAvatars(!showAvatars)}
            className="w-20 h-20 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-4xl active:scale-95 transition-transform"
          >
            {profile.avatar}
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold">{profile.name}</h1>
            <PointsBadge points={profile.points} size="md" />
          </div>
        </div>

        {showAvatars && (
          <div className="grid grid-cols-6 gap-2 animate-pop-in">
            {AVATARS.map(a => (
              <button
                key={a}
                onClick={() => { updateProfile({ avatar: a }); setShowAvatars(false); }}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center active:scale-90 transition-transform ${
                  profile.avatar === a ? 'bg-primary/20 border border-primary/40' : 'bg-secondary'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {/* XP */}
        <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '60ms' }}>
          <XPBar xp={profile.xp} xpToNext={profile.xpToNext} level={profile.level} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '100ms' }}>
          {[
            { icon: Zap, label: 'Tarefas', value: profile.tasksCompleted },
            { icon: Trophy, label: 'Jogos', value: profile.gamesPlayed },
            { icon: Flame, label: 'Streak', value: `${profile.streak}d` },
          ].map((s, i) => (
            <div key={i} className="glass-card p-3 text-center">
              <s.icon className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="font-bold text-sm">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Referral */}
        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '140ms' }}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" /> Convide Amigos
          </h3>
          <p className="text-xs text-muted-foreground">Receba {economy.directReferralPct}% da receita qualificada de cada indicação direta e {economy.indirectReferralPct}% do segundo nível. Esse valor sai da margem do site, sem reduzir os 80% do usuário indicado.</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs font-mono truncate">
              {window.location.origin}/?ref={profile.referralCode}
            </div>
            <button onClick={copyReferral} className="bg-primary text-primary-foreground px-3 rounded-lg active:scale-95 transition-transform text-xs font-medium">
              {copied ? '✓' : 'Copiar'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Indicados</p>
              <p className="font-semibold">{profile.referralCount}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Comissão total</p>
              <p className="font-semibold">R$ {centsToBrl(profile.referralEarningsCents)}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Disponível</p>
              <p className="font-semibold">R$ {centsToBrl(profile.availableReferralEarningsCents)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Em validação: R$ {centsToBrl(profile.pendingReferralEarningsCents)} {profile.referredByCode ? `• Sua conta foi indicada por ${profile.referredByCode}` : ''}</p>
          {!profile.referredByCode ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Se você entrou por convite, vincule agora seu indicador. Isso só pode ser feito uma vez.</p>
              <div className="flex gap-2">
                <input
                  value={referralInput}
                  onChange={event => setReferralInput(event.target.value.toUpperCase())}
                  placeholder="Código de indicação"
                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-xs outline-none transition-colors focus:border-primary/40"
                />
                <button
                  onClick={handleApplyReferral}
                  disabled={!referralInput.trim() || applyingReferral}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {applyingReferral ? 'Aplicando...' : 'Vincular'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '150ms' }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-sm">Status de risco</h3>
            <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
              profile.riskLevel === 'high'
                ? 'bg-game-red/10 text-game-red'
                : profile.riskLevel === 'medium'
                  ? 'bg-game-orange/10 text-game-orange'
                  : 'bg-accent/10 text-accent'
            }`}>
              {profile.riskLevel === 'high' ? 'alto' : profile.riskLevel === 'medium' ? 'médio' : 'baixo'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Score atual: {profile.riskScore}. {profile.withdrawalBlocked ? 'Sua conta entrou em revisão antifraude antes do saque.' : 'Seu saque segue o fluxo normal de revisão manual.'}</p>
        </div>

        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '160ms' }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Painel Admin
            </h3>
            <span className="text-[10px] rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
              {isAdmin ? adminRole || 'admin' : 'sem acesso'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Use o painel para revisar saques, aprovar pagamentos e devolver saldo em caso de rejeição.</p>
          <div className="rounded-xl bg-secondary px-3 py-2 text-xs font-mono break-all">
            {sessionUserId || 'Sessão carregando...'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copySessionId} className="rounded-xl bg-secondary px-3 py-3 text-xs font-medium">
              {copiedSession ? 'UUID copiado' : 'Copiar UUID'}
            </button>
            <button onClick={() => navigate('/admin')} className="rounded-xl bg-primary px-3 py-3 text-xs font-semibold text-primary-foreground">
              Abrir painel
            </button>
          </div>
        </div>

        <div className="space-y-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '170ms' }}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Top Indicadores
          </h3>
          {referralLeaderboard.length ? referralLeaderboard.map((entry, index) => (
            <div key={entry.id} className="glass-card p-3 flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-primary">{index + 1}</span>
              <span className="text-lg">{entry.avatar}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{entry.name}</p>
                <p className="text-[10px] text-muted-foreground">{entry.referralCount} indicados • disponível R$ {centsToBrl(entry.availableReferralEarningsCents)}</p>
              </div>
              <span className="text-xs font-medium text-primary">R$ {centsToBrl(entry.totalReferralEarningsCents)}</span>
            </div>
          )) : (
            <div className="glass-card p-3 text-xs text-muted-foreground">Ainda não há ranking de indicações para mostrar.</div>
          )}
        </div>

        {/* Badges */}
        <div className="space-y-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '180ms' }}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Medal className="w-4 h-4 text-primary" /> Conquistas
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {BADGES.map((b, i) => (
              <div key={i} className={`glass-card p-3 text-center ${!b.unlocked ? 'opacity-40' : ''}`}>
                <span className="text-2xl">{b.icon}</span>
                <p className="text-[10px] text-muted-foreground mt-1">{b.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking */}
        <div className="space-y-2" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '220ms' }}>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Ranking Global
          </h3>
          {RANKING.map((r, i) => (
            <div key={i} className="glass-card p-3 flex items-center gap-3">
              <span className={`w-6 text-center font-bold text-sm ${i === 0 ? 'text-primary' : i === 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                {i + 1}
              </span>
              <span className="text-lg">{r.avatar}</span>
              <span className="flex-1 text-sm font-medium">{r.name}</span>
              <span className="text-xs text-primary font-medium">{r.points.toLocaleString('pt-BR')} pts</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
