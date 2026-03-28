import { useNavigate } from 'react-router-dom';
import { Disc3, MousePointerClick, Brain, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AdSenseUnit from '@/components/ui/AdSenseUnit';
import { useGameStore } from '@/stores/useGameStore';

const gamesFluidAdSlot = '3236664978';
const gamesFluidLayoutKey = '-fb+5w+4e-db+86';

const games = [
  {
    id: 'roulette',
    name: 'Roleta da Sorte',
    description: 'Gire e ganhe pontos aleatórios',
    icon: '🎯',
    color: 'from-game-orange/20 to-game-red/20 border-game-orange/30',
    path: '/games/roulette',
  },
  {
    id: 'quickclick',
    name: 'Clique Rápido',
    description: 'Clique nos alvos o mais rápido possível',
    icon: '🎮',
    color: 'from-game-blue/20 to-game-pink/20 border-game-blue/30',
    path: '/games/quickclick',
  },
  {
    id: 'memory',
    name: 'Jogo da Memória',
    description: 'Encontre todos os pares',
    icon: '🧠',
    color: 'from-game-green/20 to-accent/20 border-game-green/30',
    path: '/games/memory',
  },
];

export default function Games() {
  const navigate = useNavigate();
  const { profile } = useGameStore();

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-5">
        <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <h1 className="text-xl font-bold">Mini Jogos</h1>
          <p className="text-muted-foreground text-sm">Jogue e ganhe pontos extras</p>
        </div>

        <div className="space-y-3">
          {games.map((game, i) => (
            <button
              key={game.id}
              onClick={() => navigate(game.path)}
              className={`w-full glass-card p-4 flex items-center gap-4 bg-gradient-to-r ${game.color} active:scale-[0.97] transition-all duration-200`}
              style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: `${i * 80}ms` }}
            >
              <div className="w-14 h-14 rounded-2xl bg-background/50 flex items-center justify-center text-3xl animate-float" style={{ animationDelay: `${i * 200}ms` }}>
                {game.icon}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{game.name}</p>
                <p className="text-sm text-muted-foreground">{game.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '260ms' }}>
          <AdSenseUnit
            slot={gamesFluidAdSlot}
            format="fluid"
            layoutKey={gamesFluidLayoutKey}
            title="Patrocinado para jogadores"
            description="Bloco responsivo exibido entre os mini jogos para reforçar a monetização da área de jogos."
            minHeight={180}
          />
        </div>

        <div className="glass-card p-4 text-center" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: '300ms' }}>
          <p className="text-sm text-muted-foreground">Jogos jogados hoje</p>
          <p className="text-2xl font-bold text-primary">{profile.gamesPlayed}</p>
        </div>
      </div>
    </AppLayout>
  );
}
