import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useGameStore } from '@/stores/useGameStore';

const SEGMENTS = [5, 10, 20, 50, 15, 30, 8, 100];
const COLORS = [
  'hsl(36,95%,54%)', 'hsl(220,80%,56%)', 'hsl(330,80%,60%)', 'hsl(152,60%,48%)',
  'hsl(0,72%,55%)', 'hsl(36,95%,44%)', 'hsl(220,80%,46%)', 'hsl(280,60%,50%)',
];

export default function Roulette() {
  const navigate = useNavigate();
  const { profile, addPoints, useRouletteSpin } = useGameStore();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);

  const spin = useCallback(() => {
    if (spinning || profile.rouletteSpinsLeft <= 0) return;
    if (!useRouletteSpin()) return;

    setResult(null);
    setSpinning(true);

    const segIndex = Math.floor(Math.random() * SEGMENTS.length);
    const segAngle = 360 / SEGMENTS.length;
    const targetAngle = 360 * 5 + (360 - segIndex * segAngle - segAngle / 2);
    
    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      const won = SEGMENTS[segIndex];
      setResult(won);
      addPoints(won);
      setSpinning(false);
    }, 3500);
  }, [spinning, profile.rouletteSpinsLeft, addPoints, useRouletteSpin]);

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/games')} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Roleta da Sorte</h1>
            <p className="text-xs text-muted-foreground">{profile.rouletteSpinsLeft} giros restantes hoje</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Wheel */}
          <div className="relative w-72 h-72">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
            
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full drop-shadow-2xl"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}
            >
              {SEGMENTS.map((seg, i) => {
                const angle = 360 / SEGMENTS.length;
                const startAngle = (i * angle - 90) * (Math.PI / 180);
                const endAngle = ((i + 1) * angle - 90) * (Math.PI / 180);
                const x1 = 100 + 95 * Math.cos(startAngle);
                const y1 = 100 + 95 * Math.sin(startAngle);
                const x2 = 100 + 95 * Math.cos(endAngle);
                const y2 = 100 + 95 * Math.sin(endAngle);
                const midAngle = ((i + 0.5) * angle - 90) * (Math.PI / 180);
                const tx = 100 + 65 * Math.cos(midAngle);
                const ty = 100 + 65 * Math.sin(midAngle);

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                      fill={COLORS[i]}
                      stroke="hsl(228,14%,7%)"
                      strokeWidth="1"
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="11"
                      fontWeight="bold"
                      transform={`rotate(${(i + 0.5) * angle}, ${tx}, ${ty})`}
                    >
                      {seg}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="18" fill="hsl(228,14%,7%)" stroke="hsl(36,95%,54%)" strokeWidth="2" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fill="hsl(36,95%,54%)" fontSize="10" fontWeight="bold">GIRAR</text>
            </svg>
          </div>

          {result !== null && (
            <div className="animate-pop-in glass-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">+{result} pontos!</p>
              <p className="text-sm text-muted-foreground">Parabéns!</p>
            </div>
          )}

          <button
            onClick={spin}
            disabled={spinning || profile.rouletteSpinsLeft <= 0}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
              spinning || profile.rouletteSpinsLeft <= 0
                ? 'bg-secondary text-muted-foreground'
                : 'bg-primary text-primary-foreground animate-pulse-glow'
            }`}
          >
            {spinning ? 'Girando...' : profile.rouletteSpinsLeft <= 0 ? 'Sem giros restantes' : 'Girar Roleta'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
