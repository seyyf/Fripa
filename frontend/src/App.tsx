import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { CartResponse, FavoritesResponse, FieldItem } from './types';
import { SwipeDeck } from './components/SwipeDeck';
import { Cart } from './components/Cart';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';

const BATCH = 60; // how many items we ask the backend for per refill
const LOW_WATER = 6; // refill the deck when it drops to this many cards
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [deck, setDeck] = useState<FieldItem[]>([]);
  const [cart, setCart] = useState<CartResponse>({ lines: [], total: 0 });
  const [favorites, setFavorites] = useState<FavoritesResponse>({ lines: [] });
  const [cartOpen, setCartOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const deckRef = useRef<FieldItem[]>([]);
  const fetching = useRef(false);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  const refreshCart = useCallback(async () => setCart(await api.cart()), []);
  const refreshFavorites = useCallback(async () => setFavorites(await api.favorites()), []);

  // Fetch a fresh batch and append any cards we don't already hold, but only
  // when the deck is running low. The backend already excludes passed / cart /
  // favorited items and mixes in any "Dernière chance" reprise.
  const topUp = useCallback(async () => {
    if (fetching.current || deckRef.current.length > LOW_WATER) return;
    fetching.current = true;
    try {
      const res = await api.field(BATCH);
      setDeck((prev) => {
        const have = new Set(prev.map((i) => i.id));
        const add = res.items.filter((i) => !have.has(i.id));
        const nextDeck = [...prev, ...add];
        if (nextDeck.length === 0 && res.remaining === 0) setExhausted(true);
        return nextDeck;
      });
    } catch (e) {
      console.error('topUp failed', e);
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    void topUp();
    void refreshCart();
    void refreshFavorites();
  }, [topUp, refreshCart, refreshFavorites]);

  function dropTop(itemId: string) {
    setDeck((prev) => prev.filter((i) => i.id !== itemId));
  }

  function restore(item: FieldItem) {
    setDeck((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]));
  }

  async function handleKeep(item: FieldItem) {
    dropTop(item.id);
    try {
      setCart(await api.add(item.id));
      flash(`Ajouté au panier — ${item.title}`);
    } catch (e) {
      console.error('keep failed', e);
      restore(item);
      flash('Oups, réessaie.');
      return;
    }
    void topUp();
  }

  async function handlePass(item: FieldItem) {
    dropTop(item.id);
    try {
      await api.pass(item.id);
    } catch (e) {
      console.error('pass failed', e);
      restore(item);
      flash('Oups, réessaie.');
      return;
    }
    if (item.lastChance) flash('Parti pour de bon. 👋');
    void topUp();
  }

  async function handleFavorite(item: FieldItem) {
    dropTop(item.id);
    try {
      setFavorites(await api.favorite(item.id));
      flash(`Gardé pour plus tard — ${item.title} ⭐`);
    } catch (e) {
      console.error('favorite failed', e);
      restore(item);
      flash('Oups, réessaie.');
      return;
    }
    void topUp();
  }

  async function moveFavoriteToCart(itemId: string) {
    try {
      const res = await api.favoriteToCart(itemId);
      setCart(res.cart);
      setFavorites(res.favorites);
      flash('Déplacé au panier. 🛒');
    } catch (e) {
      console.error('move to cart failed', e);
    }
  }

  async function removeFavorite(itemId: string) {
    try {
      setFavorites(await api.unfavorite(itemId));
    } catch (e) {
      console.error('unfavorite failed', e);
    }
  }

  async function refresh(opts: { keepCart: boolean }) {
    if (opts.keepCart) {
      await api.resetSwipes(); // ADR-0002 — preserves cart and favorites
    } else {
      await api.reset();
    }
    deckRef.current = [];
    setDeck([]);
    setExhausted(false);
    await refreshCart();
    await refreshFavorites();
    await topUp();
  }

  const stockRefresh = () => refresh({ keepCart: true });
  const hardReset = () => refresh({ keepCart: false });

  const cartCount = cart.lines.reduce((a, l) => a + l.quantity, 0);
  const favCount = favorites.lines.length;
  const showEmpty = exhausted && deck.length === 0;

  return (
    <div className="app">
      <Header
        cartCount={cartCount}
        favCount={favCount}
        onCart={() => setCartOpen(true)}
        onFavorites={() => setFavOpen(true)}
        onReset={hardReset}
      />

      <main className="stage">
        {showEmpty ? (
          <EmptyState
            onStockRefresh={stockRefresh}
            onHardReset={hardReset}
            onOpenCart={() => setCartOpen(true)}
            cartCount={cartCount}
          />
        ) : (
          <SwipeDeck
            deck={deck}
            reducedMotion={reducedMotion}
            onKeep={handleKeep}
            onPass={handlePass}
            onFavorite={handleFavorite}
          />
        )}
        {!showEmpty && (
          <p className="hint">
            ← Passer · → Garder · ↑ Favori · ou utilise les boutons.
          </p>
        )}
      </main>

      <Cart open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} refresh={refreshCart} />
      <FavoritesDrawer
        open={favOpen}
        onClose={() => setFavOpen(false)}
        favorites={favorites}
        onMoveToCart={moveFavoriteToCart}
        onRemove={removeFavorite}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
