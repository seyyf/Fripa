import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { api } from './api';
import type { CartResponse, NextItemResponse } from './types';
import { SwipeCard } from './components/SwipeCard';
import { Cart } from './components/Cart';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';

export default function App() {
  const [current, setCurrent] = useState<NextItemResponse['item']>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartResponse>({ lines: [], total: 0 });
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.next();
      setCurrent(r.item);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    setCart(await api.cart());
  }, []);

  useEffect(() => {
    fetchNext();
    refreshCart();
  }, [fetchNext, refreshCart]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  async function onPass() {
    if (!current) return;
    const wasLastChance = current.lastChance;
    try {
      await api.pass(current.id);
    } catch (e) {
      console.error('pass failed', e);
    }
    if (wasLastChance) flash('Parti pour de bon. 👋');
    fetchNext();
  }

  async function onAdd() {
    if (!current) return;
    const title = current.title;
    try {
      const updated = await api.add(current.id);
      setCart(updated);
      flash(`Ajouté au panier — ${title}`);
    } catch (e) {
      console.error('add failed', e);
    }
    fetchNext();
  }

  async function reset() {
    await api.reset();
    await refreshCart();
    fetchNext();
  }

  const cartCount = cart.lines.reduce((a, l) => a + l.quantity, 0);

  return (
    <div className="app">
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onReset={reset} />

      <main className="stage">
        {loading && !current ? (
          <div className="loader">Chargement de la fripa…</div>
        ) : current ? (
          <AnimatePresence mode="wait">
            <SwipeCard key={current.id} item={current} onPass={onPass} onAdd={onAdd} />
          </AnimatePresence>
        ) : (
          <EmptyState
            onReset={reset}
            onOpenCart={() => setCartOpen(true)}
            cartCount={cartCount}
          />
        )}

        {current && (
          <p className="hint">
            Glisse à gauche pour passer · 90% du temps, tu ne le reverras plus.
          </p>
        )}
      </main>

      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        refresh={refreshCart}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
