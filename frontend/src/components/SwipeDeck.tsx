import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FieldItem } from '../types';
import { SwipeCard } from './SwipeCard';

interface Props {
  deck: FieldItem[];
  reducedMotion: boolean;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
}

// Graduated depth for the blank cards peeking behind the active one — a tactile
// "stack of pieces waiting their turn". They're intentionally photo-less so the
// revealed card reads as a clean stack, not a dim duplicate of the next photo.
const PEEK_DEPTH = [
  { scale: 0.95, y: 16, opacity: 1 },
  { scale: 0.9, y: 32, opacity: 0.7 },
];

export function SwipeDeck({ deck, reducedMotion, onKeep, onPass, onFavorite }: Props) {
  const top = deck[0];
  const peeks = deck.slice(1, 1 + PEEK_DEPTH.length);

  // Desktop: arrow keys act on the top card (← pass, → keep, ↑ favorite).
  const ref = useRef({ deck, onKeep, onPass, onFavorite });
  ref.current = { deck, onKeep, onPass, onFavorite };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { deck, onKeep, onPass, onFavorite } = ref.current;
      const card = deck[0];
      if (!card) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // Don't hijack arrows while a drawer/modal is open.
      if (document.querySelector('.drawer-backdrop, .modal-backdrop')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onKeep(card);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPass(card);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onFavorite(card);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="deck">
      {/* Layered peek of the upcoming cards for depth — non-interactive.
          Rendered back-to-front so the nearest card paints on top. */}
      {peeks
        .map((item, i) => ({ item, depth: PEEK_DEPTH[i] }))
        .reverse()
        .map(({ item, depth }) => (
          <motion.div
            key={item.id}
            className="deck__peek"
            aria-hidden="true"
            initial={
              reducedMotion ? false : { scale: depth.scale - 0.03, y: depth.y + 8, opacity: 0 }
            }
            animate={{ scale: depth.scale, y: depth.y, opacity: depth.opacity }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 320, damping: 32 }
            }
          />
        ))}

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
