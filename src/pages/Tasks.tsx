import { useState } from 'react';
import { Play, CheckCircle2, Coins } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { centsToBrl, useGameStore } from '@/stores/useGameStore';
import type { TaskItem } from '@/stores/useGameStore';

function AdSimulator({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  const startAd = () => {
    setPlaying(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          onComplete();
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  if (!playing) {
    return (
      <button onClick={startAd} className="w-full glass-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Play className="w-8 h-8 text-primary" />
        </div>
        <span className="text-sm font-medium">Assistir e Ganhar</span>
      </button>
    );
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Assistindo anúncio...</span>
        <span>{Math.min(progress, 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
      </div>
      {progress >= 100 && (
        <p className="text-accent text-sm font-medium text-center animate-pop-in">✅ Recompensa recebida!</p>
      )}
    </div>
  );
}

export default function Tasks() {
  const { completeTask, tasks, economy, mode } = useGameStore();
  const [showAd, setShowAd] = useState<string | null>(null);

  const handleTaskAction = async (task: TaskItem) => {
    if (task.completed) return;
    if (task.type === 'ad') {
      setShowAd(task.id);
    } else {
      await completeTask(task.points, {
        taskId: task.id,
        taskType: task.type,
        title: task.title,
        estimatedRevenueCents: task.estimatedRevenueCents,
      });
    }
  };

  const handleAdComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      await completeTask(task.points, {
        taskId: task.id,
        taskType: task.type,
        title: task.title,
        estimatedRevenueCents: task.estimatedRevenueCents,
      });
      setTimeout(() => setShowAd(null), 1500);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <h1 className="text-xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Complete tarefas e ganhe pontos</p>
        </div>

        <div className="glass-card p-4 space-y-1" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '40ms' }}>
          <p className="text-sm font-semibold">Retenção + receita</p>
          <p className="text-xs text-muted-foreground">Você está em <span className="text-primary font-medium">{mode === 'supabase' ? 'modo sincronizado' : 'modo local'}</span>. Cada tarefa validada envia {economy.userSharePct}% para o usuário e {economy.siteSharePct}% para o site. O saldo entra em saque só após {economy.settlementDays} dias.</p>
        </div>

        {showAd && (
          <div style={{ animation: 'slide-up 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
            <AdSimulator onComplete={() => handleAdComplete(showAd)} />
          </div>
        )}

        <div className="space-y-2">
          {tasks.map((task, i) => (
            <button
              key={task.id}
              onClick={() => handleTaskAction(task)}
              disabled={task.completed}
              className={`w-full glass-card p-3.5 flex items-center gap-3 text-left transition-all duration-200 ${
                task.completed ? 'opacity-50' : 'active:scale-[0.97] hover:border-primary/30'
              }`}
              style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: `${i * 60}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg">
                {task.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                {task.estimatedRevenueCents ? (
                  <p className="text-[10px] text-muted-foreground mt-1">Receita estimada: R$ {centsToBrl(task.estimatedRevenueCents)} • usuário: R$ {centsToBrl(Math.round(task.estimatedRevenueCents * (economy.userSharePct / 100)))}</p>
                ) : null}
              </div>
              {task.completed ? (
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full flex-shrink-0">
                  <Coins className="w-3 h-3" /> +{task.points}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
