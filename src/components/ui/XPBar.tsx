interface XPBarProps {
  xp: number;
  xpToNext: number;
  level: number;
}

export default function XPBar({ xp, xpToNext, level }: XPBarProps) {
  const pct = Math.min((xp / xpToNext) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 border border-primary/40 text-primary font-bold text-sm">
        {level}
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Nível {level}</span>
          <span className="text-muted-foreground">{xp}/{xpToNext} XP</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-game-orange transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
