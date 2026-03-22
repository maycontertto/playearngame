import { Gift, Flame, Trophy, Target, Zap, Star } from 'lucide-react';
import { pointsToBrl, useGameStore } from '@/stores/useGameStore';
import XPBar from '@/components/ui/XPBar';
import PointsBadge from '@/components/ui/PointsBadge';
import AppLayout from '@/components/layout/AppLayout';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import type { MissionItem } from '@/stores/useGameStore';

function DailyBonus({ onClaim, claimed }: { onClaim: () => number; claimed: boolean }) {
  const reward = claimed ? 'Recompensa diária recebida' : 'Toque para abrir sua recompensa';

  const handleClaim = () => {
    if (claimed) return;
    onClaim();
  };

  return (
    <button
      onClick={handleClaim}
      disabled={claimed}
      className={`glass-card p-4 w-full text-left transition-all duration-300 active:scale-[0.97] ${
        claimed ? 'opacity-70' : 'glow-primary cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
          claimed ? 'bg-secondary' : 'bg-primary/20 animate-float'
        }`}>
          🎁
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Caixa Surpresa Diária</p>
          <p className={`text-xs font-medium ${claimed ? 'text-accent' : 'text-muted-foreground'}`}>{reward}</p>
        </div>
        {!claimed && <Gift className="w-5 h-5 text-primary animate-pulse" />}
      </div>
    </button>
  );
}

function DailyCheckinStreak({ streak, claimed }: { streak: number; claimed: boolean }) {
  const currentDay = ((Math.max(streak, 1) - 1) % 7) + 1;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Check-in de 7 dias</p>
          <p className="text-xs text-muted-foreground">
            Complete a sequência para receber um bônus melhor no 7º dia.
          </p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
          Dia {currentDay}/7
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, index) => {
          const day = index + 1;
          const isCurrent = day === currentDay;
          const isCompleted = day < currentDay || (claimed && isCurrent);
          const isBonusDay = day === 7;

          return (
            <div
              key={day}
              className={`rounded-2xl border p-2 text-center transition-all ${
                isCompleted
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : isCurrent
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/40 bg-secondary text-muted-foreground'
              }`}
            >
              <p className="text-[10px] font-medium">D{day}</p>
              <p className="mt-1 text-xs font-bold">{isCompleted ? '✓' : isBonusDay ? '2x' : '+'}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {currentDay === 7
          ? claimed
            ? 'Bônus dobrado do 7º dia resgatado com sucesso.'
            : 'Hoje é dia de bônus dobrado. Faça o check-in para receber mais.'
          : 'Nos dias 1 a 6 o prêmio cresce normalmente. No 7º dia o bônus dobra.'}
      </p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, value, color, onClick }: {
  icon: typeof Trophy;
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="glass-card p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-foreground font-bold text-sm tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[10px]">{label}</span>
    </button>
  );
}

function DailyMissions({ missions }: { missions: MissionItem[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" /> Missões do Dia
      </h3>
      {missions.map((m, i) => {
        return (
          <div key={i} className="glass-card p-3 flex items-center gap-3" style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards' }}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${m.completed ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
              {m.completed ? '✓' : `${m.progress}/${m.target}`}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.description}</p>
              <div className="h-1 rounded-full bg-secondary mt-1 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${m.completed ? 'bg-accent' : 'bg-primary/60'}`} style={{ width: `${(m.progress / m.target) * 100}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-primary font-medium">+{m.reward}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { profile, claimDailyBonus, missions, economy } = useGameStore();
  const navigate = useNavigate();
  const currentCheckinDay = ((Math.max(profile.streak, 1) - 1) % 7) + 1;

  const handleDailyClaim = () => {
    const reward = claimDailyBonus();
    if (!reward) return 0;

    if (currentCheckinDay === 7) {
      toast.success(`Bônus dobrado liberado! Você recebeu ${reward} pontos no 7º dia.`);
    } else {
      toast.success(`Check-in concluído! Você recebeu ${reward} pontos hoje.`);
    }

    return reward;
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-xl">
              {profile.avatar}
            </div>
            <div>
              <p className="font-semibold text-sm">Olá, {profile.name}!</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="w-3 h-3 text-game-orange" />
                <span>{profile.streak} dias seguidos</span>
              </div>
            </div>
          </div>
          <PointsBadge points={profile.points} size="md" />
        </div>

        {/* XP Bar */}
        <div style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '60ms' }}>
          <XPBar xp={profile.xp} xpToNext={profile.xpToNext} level={profile.level} />
        </div>

        {/* Daily Bonus */}
        <div style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '120ms' }}>
          <DailyBonus onClaim={handleDailyClaim} claimed={profile.dailyBonusClaimed} />
        </div>

        <div style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '150ms' }}>
          <DailyCheckinStreak streak={profile.streak} claimed={profile.dailyBonusClaimed} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2" style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '180ms' }}>
          <QuickAction icon={Trophy} label="Nível" value={String(profile.level)} color="bg-primary/20 text-primary" />
          <QuickAction icon={Zap} label="Tarefas" value={String(profile.tasksCompleted)} color="bg-game-blue/20 text-game-blue" onClick={() => navigate('/tasks')} />
          <QuickAction icon={Star} label="Jogos" value={String(profile.gamesPlayed)} color="bg-game-pink/20 text-game-pink" onClick={() => navigate('/games')} />
          <QuickAction icon={Flame} label="Streak" value={`${profile.streak}d`} color="bg-game-orange/20 text-game-orange" />
        </div>

        {/* Daily Missions */}
        <div style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '240ms' }}>
          <DailyMissions missions={missions} />
        </div>

        <div className="glass-card p-4 space-y-2" style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '280ms' }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Modelo de distribuição</p>
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">{economy.userSharePct}% usuário / {economy.siteSharePct}% site</span>
          </div>
          <p className="text-xs text-muted-foreground">Receita validada: usuário {economy.userSharePct}%, indicação direta {economy.directReferralPct}%, indireta {economy.indirectReferralPct}% e site {economy.siteSharePct}%. O saque libera só após {economy.settlementDays} dias de conferência.</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Saldo sacável</p>
              <p className="font-semibold text-primary">R$ {pointsToBrl(profile.withdrawablePoints)}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Em validação</p>
              <p className="font-semibold">R$ {pointsToBrl(profile.pendingWithdrawablePoints)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Indicação disponível</p>
              <p className="font-semibold">R$ {pointsToBrl(profile.availableReferralEarningsCents)}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Risco atual</p>
              <p className="font-semibold capitalize">{profile.riskLevel}</p>
            </div>
          </div>
        </div>

        {/* Quick Play */}
        <div style={{ animation: 'slide-up 0.55s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '320ms' }}>
          <button
            onClick={() => navigate('/games')}
            className="w-full glass-card p-4 flex items-center gap-4 active:scale-[0.97] transition-transform glow-accent"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl animate-float">
              🎮
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm">Jogar e Ganhar</p>
              <p className="text-muted-foreground text-xs">3 mini jogos disponíveis</p>
            </div>
            <Zap className="w-5 h-5 text-accent" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
