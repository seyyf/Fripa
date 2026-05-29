import { AnimatePresence } from 'framer-motion';
import type { FieldItem } from '../types';
import { SwipeCard } from './SwipeCard';

interface Props {
  deck: FieldItem[];
  reducedMotion: boolean;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
}

export function SwipeDeck({ deck, reducedMotion, onKeep, onPass, onFavorite }: Props) {
  const top = deck[0];
  const next = deck[1];

  return (
    <div className="deck">
      {/* Faint peek of the next card for depth — non-interactive. */}
      {next && (
        <div
          className="deck__peek"
          aria-hidden="true"
          style={{ backgroundImage: `url(${next.imageUrl})` }}
        />
      )}

      <AnimatePresence>
        {top && (
          <SwipeCard
            key={top.id}
            item={top}
            reducedMotion={reducedMotion}
            onKeep={onKeep}
            onPass={onPass}
            onFavorite={onFavorite}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
