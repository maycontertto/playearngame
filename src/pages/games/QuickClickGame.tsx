import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useGameStore } from '@/stores/useGameStore';

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

const COLORS = ['bg-primary', 'bg-game-blue', 'bg-game-pink', 'bg-accent', 'bg-game-red'];
const GAME_DURATION = 15;

export default function QuickClickGame() {
  const navigate = useNavigate();
  const { addPoints, incrementGamesPlayed } = useGameStore();
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targets, setTargets] = useState<Target[]>([]);
  const nextId = useRef(0);

  const spawnTarget = useCallback(() => {
    const t: Target = {
      id: nextId.current++,
      x: 10 + Math.random() * 75,
      y: 10 + Math.random() * 70,
      size: 36 + Math.random() * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    setTargets(prev => [...prev.slice(-5), t]);
  }, []);

  const startGame = () => {
    setPhase('playing');
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setTargets([]);
    nextId.current = 0;
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const spawner = setInterval(spawnTarget, 800);
    spawnTarget();
    return () => clearInterval(spawner);
  }, [phase, spawnTarget]);

  useEffect(() => {
    if (phase === 'done') {
      const pts = score * 3;
      addPoints(pts);
      incrementGamesPlayed();
    }
  }, [phase]);

  const hitTarget = (id: number) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    setScore(prev => prev + 1);
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/games')} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Clique Rápido</h1>
          </div>
          {phase === 'playing' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary tabular-nums">{score} alvos</span>
              <span className={`text-sm font-bold tabular-nums ${timeLeft <= 5 ? 'text-game-red' : 'text-muted-foreground'}`}>{timeLeft}s</span>
            </div>
          )}
        </div>

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-6 pt-12" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="text-6xl animate-float">🎯</div>
            <div className="text-center">
              <p className="font-semibold">Clique nos alvos!</p>
              <p className="text-sm text-muted-foreground mt-1">Você tem {GAME_DURATION} segundos. Cada alvo = 3 pontos.</p>
            </div>
            <button onClick={startGame} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
              Começar
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="relative w-full h-[60vh] glass-card overflow-hidden rounded-2xl">
            {targets.map(t => (
              <button
                key={t.id}
                onClick={() => hitTarget(t.id)}
                className={`absolute rounded-full ${t.color} animate-pop-in active:scale-75 transition-transform shadow-lg`}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: t.size,
                  height: t.size,
                }}
              />
            ))}
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-6 pt-12 animate-pop-in">
            <div className="text-6xl">🏆</div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{score} alvos</p>
              <p className="text-accent font-semibold mt-1">+{score * 3} pontos ganhos!</p>
            </div>
            <button onClick={startGame} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
              Jogar Novamente
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
