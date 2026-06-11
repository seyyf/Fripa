import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FieldItem } from '../types';
import { SwipeCard } from './SwipeCard';
import { SwipeBurstEngine, type BurstAction } from '../fx/swipeBurst';

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

  // Particle layer + the direction of the last decision. The action drives both
  // the burst colours and the exiting card's throw (via AnimatePresence custom).
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SwipeBurstEngine | null>(null);
  const lastAction = useRef<BurstAction | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SwipeBurstEngine(canvas);
    engineRef.current = engine;
    engine.resize();
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Every decision funnels through here (drag, gesture buttons, keyboard):
  // remember the throw direction, fire the matching burst, notify the parent.
  function decide(action: BurstAction, item: FieldItem) {
    lastAction.current = action;
    const canvas = canvasRef.current;
    if (!reducedMotion && canvas) {
      // Burst from the edge the card exits through, so the splash visibly
      // trails the throw: right edge on keep, left on pass, top on favorite.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const origin =
        action === 'keep'
          ? { x: w * 0.8, y: h * 0.3 }
          : action === 'pass'
            ? { x: w * 0.2, y: h * 0.3 }
            : { x: w * 0.5, y: h * 0.1 };
      engineRef.current?.burst(action, origin.x, origin.y);
    }
    if (action === 'keep') onKeep(item);
    else if (action === 'pass') onPass(item);
    else onFavorite(item);
  }

  // Desktop: arrow keys act on the top card (← pass, → keep, ↑ favorite).
  const ref = useRef({ deck, decide });
  ref.current = { deck, decide };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { deck, decide } = ref.current;
      const card = deck[0];
      if (!card) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // Don't hijack arrows while a drawer/modal is open.
      if (document.querySelector('.drawer-backdrop, .modal-backdrop')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        decide('keep', card);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        decide('pass', card);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        decide('favorite', card);
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

      {/* popLayout pops the exiting card out of the flex flow while it flies,
          so the incoming card centres immediately instead of sharing the row
          with the ghost of the old one. */}
      <AnimatePresence mode="popLayout" custom={lastAction.current}>
        {top && (
          <SwipeCard
            key={top.id}
            item={top}
            reducedMotion={reducedMotion}
            onKeep={(i) => decide('keep', i)}
            onPass={(i) => decide('pass', i)}
            onFavorite={(i) => decide('favorite', i)}
          />
        )}
      </AnimatePresence>

      {/* Particle bursts paint above the cards; never intercepts input. */}
      <canvas ref={canvasRef} className="deck__fx" aria-hidden="true" />
    </div>
  );
}
