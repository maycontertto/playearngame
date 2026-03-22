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

  const bitlabsEntryUrl = useMemo(() => {
    if (!sessionUserId) return null;

    const url = new URL('/api/bitlabs-entry', window.location.origin);
    url.searchParams.set('uid', sessionUserId);
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

  const openPartnerWall = (partnerName: string, url: string | null, errorMessage: string) => {
    if (!sessionUserId) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em alguns segundos.');
      return;
    }

    if (!url) {
      toast.error(errorMessage);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success(`${partnerName} aberta em uma nova aba com seu usuário identificado.`);
  };

  const copyPartnerLink = async (url: string | null, label: string) => {
    if (!url) {
      toast.error(`O link da ${label} ainda não está disponível.`);
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success(`Link de entrada da ${label} copiado.`);
  };

  const handleOpenCpx = () => {
    openPartnerWall('CPX', cpxEntryUrl, 'Não foi possível preparar o link de entrada da CPX.');
  };

  const handleOpenBitLabs = () => {
    openPartnerWall('BitLabs', bitlabsEntryUrl, 'Não foi possível preparar o link de entrada da BitLabs.');
  };

  const handleCopyCpxLink = async () => {
    await copyPartnerLink(cpxEntryUrl, 'CPX');
  };

  const handleCopyBitLabsLink = async () => {
    await copyPartnerLink(bitlabsEntryUrl, 'BitLabs');
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

        <div className="glass-card overflow-hidden p-0" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '55ms' }}>
          <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Oferta em destaque
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">Pesquisas premiadas CPX</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Responda ofertas e pesquisas liberadas, some recompensas extras e aumente seu saldo com validação automática.
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${cpxEntryUrl ? 'bg-accent/10 text-accent' : 'bg-game-orange/10 text-game-orange'}`}>
                {cpxEntryUrl ? 'Acesso liberado' : 'Preparando acesso'}
              </span>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-background/70 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Ganhe mais com ofertas de maior valor</p>
                  <p className="text-xs text-muted-foreground">
                    Seu acesso já está identificado. Basta abrir a vitrine CPX, escolher uma oportunidade e concluir para receber o crédito quando a conversão for aprovada.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-muted-foreground">Ativação</p>
                <p className="mt-1 font-semibold">1 toque</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-muted-foreground">Crédito</p>
                <p className="mt-1 font-semibold">Automático</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-muted-foreground">Acesso</p>
                <p className="mt-1 font-semibold">Pronto agora</p>
              </div>
            </div>

            <button
              onClick={handleOpenCpx}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" /> Quero ver ofertas agora
            </button>

            <p className="text-center text-[11px] text-muted-foreground">
              Abra agora e aproveite as campanhas disponíveis enquanto houver inventário liberado.
            </p>
          </div>

          <div className="border-t border-border/60 p-4 space-y-3 bg-background/40">
            <div className="grid grid-cols-2 gap-2">
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
            </div>

            <details className="rounded-xl bg-secondary/80 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none font-medium text-foreground">
                Ver detalhes do acesso
              </summary>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg bg-background/70 p-3 text-[11px] font-mono break-all">
                  {sessionUserId || 'Carregando UUID do usuário...'}
                </div>
                <div className="rounded-lg bg-background/70 p-3 text-[11px] break-all">
                  {cpxEntryUrl || 'Link de entrada da CPX será gerado assim que a sessão carregar.'}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A abertura usa um redirecionamento interno seguro para identificar seu usuário automaticamente antes de enviar você para a CPX.
                </p>
              </div>
            </details>
          </div>
        </div>

        <div className="glass-card overflow-hidden p-0" style={{ animation: 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '63ms' }}>
          <div className="bg-gradient-to-br from-accent/15 via-primary/5 to-transparent p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Novo parceiro
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">BitLabs ofertas e pesquisas</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Libere campanhas extras com jogos, pesquisas e missões que podem aumentar seu faturamento diário dentro do app.
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${bitlabsEntryUrl ? 'bg-accent/10 text-accent' : 'bg-game-orange/10 text-game-orange'}`}>
                {bitlabsEntryUrl ? 'BitLabs pronta' : 'Configurando'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-muted-foreground">Formato</p>
                <p className="mt-1 font-semibold">Jogos + pesquisas</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-muted-foreground">Identificação</p>
                <p className="mt-1 font-semibold">UID automático</p>
              </div>
            </div>

            <div className="rounded-2xl border border-accent/15 bg-background/70 p-4 shadow-sm">
              <p className="text-sm font-semibold">Pronta para integração com callback seguro</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A abertura usa um link interno do app para enviar seu usuário com segurança e receber as conversões pelo backend.
              </p>
            </div>

            <button
              onClick={handleOpenBitLabs}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" /> Abrir BitLabs agora
            </button>
          </div>

          <div className="border-t border-border/60 p-4 space-y-3 bg-background/40">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopySessionUserId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3 text-xs font-medium"
              >
                <Copy className="h-4 w-4" /> Copiar UID
              </button>
              <button
                onClick={handleCopyBitLabsLink}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3 text-xs font-medium"
              >
                <LinkIcon className="h-4 w-4" /> Copiar link
              </button>
            </div>

            <details className="rounded-xl bg-secondary/80 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none font-medium text-foreground">
                Ver detalhes da BitLabs
              </summary>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg bg-background/70 p-3 text-[11px] font-mono break-all">
                  {sessionUserId || 'Carregando UID do usuário...'}
                </div>
                <div className="rounded-lg bg-background/70 p-3 text-[11px] break-all">
                  {bitlabsEntryUrl || 'Link de entrada da BitLabs será gerado assim que a sessão carregar.'}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A BitLabs usa o parâmetro `uid` com o UUID do usuário, via redirecionamento interno do app.
                </p>
              </div>
            </details>
          </div>
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
