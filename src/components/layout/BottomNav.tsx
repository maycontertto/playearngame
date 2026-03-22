import { Home, ListChecks, Gamepad2, Wallet, User, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/useGameStore';

const navItems = [
  { icon: Home, label: 'Início', path: '/dashboard' },
  { icon: ListChecks, label: 'Tarefas', path: '/tasks' },
  { icon: Gamepad2, label: 'Jogos', path: '/games' },
  { icon: Wallet, label: 'Carteira', path: '/wallet' },
  { icon: User, label: 'Perfil', path: '/profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useGameStore();
  const items = isAdmin ? [...navItems, { icon: Shield, label: 'Admin', path: '/admin' }] : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card rounded-none border-t border-border/30 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                active
                  ? 'text-primary scale-105'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
