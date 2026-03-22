import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useGameStore } from '@/stores/useGameStore';

const EMOJIS = ['🎮', '⚡', '🔥', '💎', '🎯', '🏆', '⭐', '🎪'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function createDeck(): Card[] {
  const pairs = EMOJIS.slice(0, 6);
  const cards = [...pairs, ...pairs].map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export default function MemoryGame() {
  const navigate = useNavigate();
  const { addPoints, incrementGamesPlayed } = useGameStore();
  const [cards, setCards] = useState<Card[]>(createDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);

  const flipCard = (id: number) => {
    if (locked) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;
    if (selected.length >= 2) return;

    const newCards = cards.map(c => c.id === id ? { ...c, flipped: true } : c);
    setCards(newCards);
    const newSelected = [...selected, id];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newSelected;
      const ca = newCards.find(c => c.id === a)!;
      const cb = newCards.find(c => c.id === b)!;

      if (ca.emoji === cb.emoji) {
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c));
          setSelected([]);
          setLocked(false);
        }, 400);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c));
          setSelected([]);
          setLocked(false);
        }, 800);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every(c => c.matched) && !done) {
      setDone(true);
      const pts = Math.max(60 - moves * 3, 15);
      addPoints(pts);
      incrementGamesPlayed();
    }
  }, [cards, done]);

  const restart = () => {
    setCards(createDeck());
    setSelected([]);
    setMoves(0);
    setDone(false);
    setLocked(false);
  };

  const matchedCount = cards.filter(c => c.matched).length / 2;

  return (
    <AppLayout>
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/games')} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Jogo da Memória</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{moves} jogadas</span>
            <span className="text-primary font-medium">{matchedCount}/6 pares</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5 pt-2">
          {cards.map((card, i) => (
            <button
              key={card.id}
              onClick={() => flipCard(card.id)}
              className={`aspect-square rounded-xl text-2xl font-bold flex items-center justify-center transition-all duration-300 active:scale-90 ${
                card.matched
                  ? 'bg-accent/20 border border-accent/40 scale-95'
                  : card.flipped
                  ? 'bg-primary/20 border border-primary/40 rotate-0'
                  : 'bg-secondary border border-border hover:border-primary/30'
              }`}
              style={{ animation: 'slide-up 0.4s cubic-bezier(0.16,1,0.3,1) backwards', animationDelay: `${i * 30}ms` }}
            >
              {(card.flipped || card.matched) ? card.emoji : '?'}
            </button>
          ))}
        </div>

        {done && (
          <div className="flex flex-col items-center gap-4 pt-4 animate-pop-in">
            <div className="text-5xl">🎉</div>
            <div className="text-center">
              <p className="font-bold text-lg">Parabéns!</p>
              <p className="text-primary font-semibold">+{Math.max(60 - moves * 3, 15)} pontos</p>
              <p className="text-sm text-muted-foreground">{moves} jogadas</p>
            </div>
            <button onClick={restart} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
              Jogar Novamente
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
