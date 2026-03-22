import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, CheckCircle2, Coins, Sparkles, ExternalLink, Copy, Link as LinkIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { centsToBrl, useGameStore } from '@/stores/useGameStore';
import { toast } from '@/components/ui/sonner';
import type { TaskItem } from '@/stores/useGameStore';

const AUTO_VIDEO_MODE_STORAGE_KEY = 'playgame_auto_video_mode';
function getReadableError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir o vídeo remunerado agora.';
}

function AdSimulator({
  title,
  autoStart = false,
  onComplete,
}: {
  title: string;
  autoStart?: boolean;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const stopCurrentInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAd = useCallback(() => {
    if (playing) return;

    setPlaying(true);
    setProgress(0);
    stopCurrentInterval();

    intervalRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          stopCurrentInterval();
          onComplete();
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  }, [onComplete, playing, stopCurrentInterval]);

  useEffect(() => {
    if (autoStart) {
      startAd();
    }
  }, [autoStart, startAd]);

  useEffect(() => () => stopCurrentInterval(), [stopCurrentInterval]);

  if (!playing) {
    return (
      <button onClick={startAd} className="w-full glass-card p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Play className="w-8 h-8 text-primary" />
        </div>
        <span className="text-sm font-medium">Assistir e Ganhar</span>
        <span className="text-xs text-muted-foreground text-center">{title}</span>
      </button>
    );
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Assistindo vídeo remunerado...</span>
        <span>{Math.min(progress, 100)}%</span>
      </div>
      <p className="text-sm font-medium">{title}</p>
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
  const { completeTask, tasks, economy, mode, sessionUserId } = useGameStore();
  const [showAd, setShowAd] = useState<string | null>(null);
  const [autoVideoMode, setAutoVideoMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(AUTO_VIDEO_MODE_STORAGE_KEY) === 'true';
  });

  const availableAdTasks = useMemo(
    () => tasks.filter(task => task.type === 'ad' && !task.completed),
    [tasks],
  );

  const activeAdTask = useMemo(
    () => tasks.find(task => task.id === showAd) || null,
    [showAd, tasks],
  );

  const cpxEntryUrl = useMemo(() => {
    if (!sessionUserId) return null;

    const url = new URL('/api/cpx-entry', window.location.origin);
    url.searchParams.set('ext_user_id', sessionUserId);
    url.searchParams.set('subid_1', sessionUserId);
    url.searchParams.set('subid_2', 'playgame-web');
    return url.toString();
  }, [sessionUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTO_VIDEO_MODE_STORAGE_KEY, String(autoVideoMode));
  }, [autoVideoMode]);

  useEffect(() => {
    if (!autoVideoMode || showAd || !availableAdTasks.length) return;
    setShowAd(availableAdTasks[0].id);
  }, [autoVideoMode, availableAdTasks, showAd]);

  const toggleAutoVideoMode = () => {
    setAutoVideoMode(previous => {
      const next = !previous;

      if (next) {
        if (availableAdTasks.length) {
          toast.success('Modo contínuo ativado. O próximo vídeo remunerado vai iniciar sozinho.');
        } else {
          toast.info('Modo contínuo ativado. Quando houver vídeo remunerado liberado, ele inicia automaticamente.');
        }
      } else {
        toast.message('Modo contínuo desativado.');
      }

      return next;
    });
  };

  const handleOpenCpx = () => {
    if (!sessionUserId) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em alguns segundos.');
      return;
    }

    if (!cpxEntryUrl) {
      toast.error('Não foi possível preparar o link de entrada da CPX.');
      return;
    }

    window.open(cpxEntryUrl, '_blank', 'noopener,noreferrer');
    toast.success('CPX aberta em uma nova aba com seu usuário identificado.');
  };

  const handleCopyCpxLink = async () => {
    if (!cpxEntryUrl) {
      toast.error('O link da CPX ainda não está disponível.');
      return;
    }

    await navigator.clipboard.writeText(cpxEntryUrl);
    toast.success('Link de entrada da CPX copiado.');
  };

  const handleCopySessionUserId = async () => {
    if (!sessionUserId) {
      toast.error('Sua sessão ainda não está pronta para copiar o UUID.');
      return;
    }

    await navigator.clipboard.writeText(sessionUserId);
    toast.success('UUID do usuário copiado.');
  };

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
    if (!task) {
      setShowAd(null);
      return;
    }

    try {
      await completeTask(task.points, {
        taskId: task.id,
        taskType: task.type,
        title: task.title,
        estimatedRevenueCents: task.estimatedRevenueCents,
      });

      toast.success(`Vídeo concluído: +${task.points} pontos liberados.`);

      const nextAdTask = tasks.find(candidate => candidate.type === 'ad' && !candidate.completed && candidate.id !== task.id);

      if (autoVideoMode && nextAdTask) {
        window.setTimeout(() => setShowAd(nextAdTask.id), 900);
        return;
      }

      if (autoVideoMode && !nextAdTask) {
        toast.message('Todos os vídeos remunerados liberados por hoje já foram concluídos.');
      }

      window.setTimeout(() => setShowAd(null), 1200);
    } catch (error) {
      toast.error(getReadableError(error));
      setShowAd(null);
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

        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '55ms' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Ofertas CPX Research</p>
              <p className="text-xs text-muted-foreground mt-1">
                Abra a parede de pesquisas/ofertas já identificada com o UUID do usuário para receber o postback automático.
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${cpxEntryUrl ? 'bg-accent/10 text-accent' : 'bg-game-orange/10 text-game-orange'}`}>
              {cpxEntryUrl ? 'CPX pronta' : 'Sessão pendente'}
            </span>
          </div>

          <div className="rounded-xl bg-secondary p-3 text-[11px] font-mono break-all text-muted-foreground">
            {sessionUserId || 'Carregando UUID do usuário...'}
          </div>

          <div className="rounded-xl bg-secondary p-3 text-[11px] break-all text-muted-foreground">
            {cpxEntryUrl || 'Link de entrada da CPX será gerado assim que a sessão carregar.'}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleCopySessionUserId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3 text-xs font-medium"
            >
              <Copy className="h-4 w-4" /> Copiar UUID
            </button>
            <button
              onClick={handleCopyCpxLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3 text-xs font-medium"
            >
              <LinkIcon className="h-4 w-4" /> Copiar link
            </button>
            <button
              onClick={handleOpenCpx}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-semibold text-primary-foreground"
            >
              <ExternalLink className="h-4 w-4" /> Abrir CPX
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            O app agora usa um redirecionamento interno para a CPX e envia `ext_user_id` e `subid_1` com o UUID do usuário, evitando erro por parâmetro incorreto na abertura da wall.
          </p>
        </div>

        <div className="glass-card p-4 space-y-3" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '70ms' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Modo contínuo de vídeos
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Deixe ativado para abrir automaticamente o próximo vídeo remunerado enquanto houver inventário liberado.
              </p>
            </div>
            <button
              onClick={toggleAutoVideoMode}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                autoVideoMode ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {autoVideoMode ? 'Ligado' : 'Desligado'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Vídeos liberados</p>
              <p className="font-semibold text-primary">{availableAdTasks.length}</p>
            </div>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-muted-foreground">Próximo status</p>
              <p className="font-semibold">{autoVideoMode ? 'Auto iniciar' : 'Manual'}</p>
            </div>
          </div>
        </div>

        {showAd && activeAdTask && (
          <div style={{ animation: 'slide-up 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
            <AdSimulator
              key={showAd}
              title={activeAdTask.title}
              autoStart={autoVideoMode}
              onComplete={() => handleAdComplete(showAd)}
            />
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
