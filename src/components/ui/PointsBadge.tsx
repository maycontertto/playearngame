import { Coins } from 'lucide-react';

export default function PointsBadge({ points, size = 'md' }: { points: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-lg px-4 py-1.5 gap-2 font-bold',
  };

  return (
    <span className={`inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/30 ${sizes[size]}`}>
      <Coins className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      {points.toLocaleString('pt-BR')}
    </span>
  );
}
