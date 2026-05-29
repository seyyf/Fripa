import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { CartResponse, FieldItem } from './types';
import { type FieldBox, makeBox } from './field/fieldLayout';
import { FloatingField } from './components/FloatingField';
import { Cart } from './components/Cart';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';

const isMobile = window.matchMedia('(max-width: 600px)').matches;
const TARGET = isMobile ? 9 : 16;
const DECK_FETCH = 60;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [boxes, setBoxes] = useState<FieldBox[]>([]);
  const [cart, setCart] = useState<CartResponse>({ lines: [], total: 0 });
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const deck = useRef<FieldItem[]>([]);
  const onScreen = useRef<Set<string>>(new Set());

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  const refillDeck = useCallback(async () => {
    const res = await api.field(DECK_FETCH);
    for (const item of res.items) {
      if (onScreen.current.has(item.id)) continue;
      if (deck.current.some((d) => d.id === item.id)) continue;
      deck.current.push(item);
    }
    return res.remaining;
  }, []);

  const topUp = useCallback(async () => {
    const next: FieldBox[] = [];
    while (true) {
      if (deck.current.length === 0) {
        const remaining = await refillDeck();
        if (deck.current.length === 0) {
          if (remaining === 0) setExhausted(true);
          break;
        }
      }
      const item = deck.current.shift()!;
      const box = makeBox(item);
      onScreen.current.add(item.id);
      next.push(box);
      // Stop once we've queued enough to reach the target.
      if (onScreen.current.size >= TARGET) break;
    }
    if (next.length) setBoxes((prev) => [...prev, ...next]);
  }, [refillDeck]);

  const refreshCart = useCallback(async () => {
    setCart(await api.cart());
  }, []);

  useEffect(() => {
    void (async () => {
      await refillDeck();
      await topUp();
    })();
    void refreshCart();
  }, [refillDeck, topUp, refreshCart]);

  function removeBox(boxKey: string) {
    setBoxes((prev) => {
      const leaving = prev.find((b) => b.boxKey === boxKey);
      if (leaving) onScreen.current.delete(leaving.item.id);
      return prev.filter((b) => b.boxKey !== boxKey);
    });
  }

  async function handleGrab(box: FieldBox) {
    removeBox(box.boxKey);
    try {
      setCart(await api.add(box.item.id));
      flash(`Ajouté au panier — ${box.item.title}`);
    } catch (e) {
      console.error('add failed', e);
    }
    void topUp();
  }

  async function handleSnatch(boxKey: string) {
    const box = boxes.find((b) => b.boxKey === boxKey);
    if (!box) return;
    removeBox(boxKey);
    try {
      // The phantom crowd "snatches" — hits the backend pass mechanic.
      // See ADR-0001 for the naming split.
      await api.snatch(box.item.id);
    } catch (e) {
      console.error('snatch failed', e);
    }
    if (Math.random() < 0.35) flash('Quelqu’un l’a pris… 👀');
    void topUp();
  }

  async function refresh(opts: { keepCart: boolean }) {
    if (opts.keepCart) {
      await api.resetSwipes(); // ADR-0002
    } else {
      await api.reset();
    }
    deck.current = [];
    onScreen.current = new Set();
    setBoxes([]);
    setExhausted(false);
    await refreshCart();
    await refillDeck();
    await topUp();
  }

  const stockRefresh = () => refresh({ keepCart: true });
  const hardReset = () => refresh({ keepCart: false });

  const cartCount = cart.lines.reduce((a, l) => a + l.quantity, 0);
  const showEmpty = exhausted && boxes.length === 0;

  return (
    <div className="app app--field">
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onReset={hardReset} />

      <main className="stage stage--field">
        {showEmpty ? (
          // EmptyState exposes the stock-refresh (preserves cart) as primary,
          // hard reset as secondary. See ADR-0002.
          <EmptyState
            onStockRefresh={stockRefresh}
            onHardReset={hardReset}
            onOpenCart={() => setCartOpen(true)}
            cartCount={cartCount}
          />
        ) : (
          <FloatingField
            boxes={boxes}
            reducedMotion={reducedMotion}
            minFieldSize={Math.min(4, TARGET)}
            onGrab={handleGrab}
            onSnatch={handleSnatch}
          />
        )}
        {!showEmpty && (
          <p className="hint">Survole ou tape une pièce pour la révéler. Les autres chinent aussi…</p>
        )}
      </main>

      <Cart open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} refresh={refreshCart} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
