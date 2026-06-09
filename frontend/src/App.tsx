import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Route, Routes } from 'react-router-dom';
import { api } from './api';
import type {
  CartResponse,
  CheckoutResult,
  CustomerInfo,
  FavoritesResponse,
  FieldFilters,
  FieldItem,
  TShirt,
} from './types';
import { activeFilterCount } from './filters/fieldQuery';
import { holdState } from './cart/holdTimer';
import { SwipeDeck } from './components/SwipeDeck';
import { SwipeCoach } from './components/SwipeCoach';
import { QuickFilters } from './components/QuickFilters';
import { TrackOrder } from './components/TrackOrder';
import { HomePage } from './components/HomePage';
import { Catalogue } from './components/Catalogue';
import { ProductDetail } from './components/ProductDetail';
import { CheckoutPage } from './components/CheckoutPage';
import { Cart } from './components/Cart';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { FilterDrawer } from './components/FilterDrawer';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';

const BATCH = 60; // how many items we ask the backend for per refill
const LOW_WATER = 6; // refill the deck when it drops to this many cards
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Prefer a human-readable server message (e.g. the cart-hold cap); fall back to
// a generic line for opaque/network errors.
function errMsg(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : '';
  return m && !m.startsWith('HTTP') ? m : fallback;
}

export default function App() {
  const [deck, setDeck] = useState<FieldItem[]>([]);
  const [cart, setCart] = useState<CartResponse>({ lines: [], total: 0 });
  const [favorites, setFavorites] = useState<FavoritesResponse>({ lines: [] });
  const [filters, setFilters] = useState<FieldFilters>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [outOfCards, setOutOfCards] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  // A piece just removed from the cart → returned to the floor. The tick lets
  // the catalogue react even if the same piece is returned twice.
  const [returned, setReturned] = useState<{ item: TShirt; tick: number } | null>(null);
  // Pieces bought at checkout → the catalogue removes them from the floor.
  const [purchased, setPurchased] = useState<{ ids: string[]; tick: number } | null>(null);

  const deckRef = useRef<FieldItem[]>([]);
  const filtersRef = useRef<FieldFilters>({});
  const fetching = useRef(false);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  const refreshCart = useCallback(async () => setCart(await api.cart()), []);
  const refreshFavorites = useCallback(async () => setFavorites(await api.favorites()), []);

  // Fetch a fresh batch (honouring the active filters) and append any cards we
  // don't already hold, but only when the deck is running low.
  const topUp = useCallback(async () => {
    if (fetching.current || deckRef.current.length > LOW_WATER) return;
    fetching.current = true;
    try {
      const res = await api.field(BATCH, filtersRef.current);
      setDeck((prev) => {
        const have = new Set(prev.map((i) => i.id));
        const add = res.items.filter((i) => !have.has(i.id));
        const nextDeck = [...prev, ...add];
        if (nextDeck.length === 0 && res.remaining === 0) setOutOfCards(true);
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

  // Watch cart-hold timers: warn at <60s, and on expiry toast + refetch + drop
  // the piece back onto the floor. Keyed by id:expiresAt so a re-reserved piece
  // gets fresh warnings.
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);
  const warnedHolds = useRef<Set<string>>(new Set());
  const expiredHolds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      let released = false;
      for (const line of cartRef.current.lines) {
        const key = `${line.id}:${line.expiresAt}`;
        const { phase } = holdState(line.expiresAt, now);
        if (phase === 'expired') {
          if (!expiredHolds.current.has(key)) {
            expiredHolds.current.add(key);
            flash(`Trop tard — ${line.title} est reparti dans le rayon. 👋`);
            setReturned((r) => ({ item: line, tick: (r?.tick ?? 0) + 1 }));
            released = true;
          }
        } else if (phase === 'warning' && !warnedHolds.current.has(key)) {
          warnedHolds.current.add(key);
          flash(`⏳ ${line.title} expire bientôt !`);
        }
      }
      if (released) void refreshCart();
    }, 1000);
    return () => clearInterval(id);
  }, [refreshCart]);

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
      setHistoryCount((c) => c + 1);
      flash(`Ajouté au panier — ${item.title}`);
    } catch (e) {
      console.error('keep failed', e);
      restore(item);
      flash(errMsg(e, 'Oups, réessaie.'));
      return;
    }
    void topUp();
  }

  async function handlePass(item: FieldItem) {
    dropTop(item.id);
    try {
      await api.pass(item.id);
      setHistoryCount((c) => c + 1);
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
      setHistoryCount((c) => c + 1);
      flash(`Gardé pour plus tard — ${item.title} ⭐`);
    } catch (e) {
      console.error('favorite failed', e);
      restore(item);
      flash('Oups, réessaie.');
      return;
    }
    void topUp();
  }

  async function handleUndo() {
    try {
      const res = await api.undo();
      if (res.rateLimited) {
        flash('↩ Reviens : une seule fois par heure. À tout à l’heure !');
        return;
      }
      if (!res.undone) {
        setHistoryCount(0);
        return;
      }
      const { action, item } = res.undone;
      setHistoryCount((c) => Math.max(0, c - 1));
      // The piece is available again — drop it back on top of the deck.
      restore({ ...item, lastChance: false });
      setOutOfCards(false);
      if (action === 'keep') await refreshCart();
      if (action === 'favorite') await refreshFavorites();
      flash(`Reviens ! — ${item.title}`);
    } catch (e) {
      console.error('undo failed', e);
    }
  }

  // Cart / favorite actions from the catalogue detail page (no deck involved).
  async function addToCart(item: TShirt) {
    try {
      setCart(await api.add(item.id));
      flash(`Ajouté au panier — ${item.title}`);
    } catch (e) {
      console.error('add failed', e);
      flash(errMsg(e, 'Oups, réessaie.'));
    }
  }

  async function addFavorite(item: TShirt) {
    try {
      setFavorites(await api.favorite(item.id));
      flash(`Gardé pour plus tard — ${item.title} ⭐`);
    } catch (e) {
      console.error('favorite failed', e);
      flash('Oups, réessaie.');
    }
  }

  async function removeFromCart(itemId: string) {
    const line = cart.lines.find((l) => l.id === itemId);
    try {
      setCart(await api.remove(itemId));
      // Back on the rack — signal the catalogue floor to show it again.
      if (line) setReturned((r) => ({ item: line, tick: (r?.tick ?? 0) + 1 }));
    } catch (e) {
      console.error('remove failed', e);
    }
  }

  async function placeOrder(customer: CustomerInfo, promoCode?: string): Promise<CheckoutResult> {
    const ids = cart.lines.map((l) => l.id);
    const res = await api.checkout(customer, promoCode);
    if (res.ok) {
      setCart({ lines: [], total: 0 });
      // The bought pieces leave the floor for good.
      setPurchased((p) => ({ ids, tick: (p?.tick ?? 0) + 1 }));
    } else {
      // Refused (e.g. cart expired/lost) — re-sync the UI to the real cart.
      await refreshCart();
    }
    return res;
  }

  async function moveFavoriteToCart(itemId: string) {
    try {
      const res = await api.favoriteToCart(itemId);
      setCart(res.cart);
      setFavorites(res.favorites);
      flash('Déplacé au panier. 🛒');
    } catch (e) {
      console.error('move to cart failed', e);
      flash(errMsg(e, 'Oups, réessaie.'));
    }
  }

  async function removeFavorite(itemId: string) {
    try {
      setFavorites(await api.unfavorite(itemId));
    } catch (e) {
      console.error('unfavorite failed', e);
    }
  }

  // Replace the deck with a fresh batch under a new filter set.
  const reloadDeck = useCallback(
    async (next: FieldFilters) => {
      filtersRef.current = next;
      setFilters(next);
      deckRef.current = [];
      setDeck([]);
      setOutOfCards(false);
      await topUp();
    },
    [topUp],
  );

  const applyFilters = (next: FieldFilters) => void reloadDeck(next);
  const clearFilters = () => {
    setFilterOpen(false);
    void reloadDeck({});
  };

  async function refresh(opts: { keepCart: boolean }) {
    if (opts.keepCart) {
      await api.resetSwipes(); // ADR-0002 — preserves cart and favorites
    } else {
      await api.reset();
    }
    deckRef.current = [];
    setDeck([]);
    setOutOfCards(false);
    setHistoryCount(0);
    await refreshCart();
    await refreshFavorites();
    await topUp();
  }

  const stockRefresh = () => refresh({ keepCart: true });
  const hardReset = () => refresh({ keepCart: false });

  const cartCount = cart.lines.reduce((a, l) => a + l.quantity, 0);
  const favCount = favorites.lines.length;
  const filterCount = activeFilterCount(filters);
  const showEmpty = outOfCards && deck.length === 0;
  const filteredEmpty = showEmpty && filterCount > 0;

  return (
    <div className="app">
      <Header
        cartCount={cartCount}
        favCount={favCount}
        onCart={() => setCartOpen(true)}
        onFavorites={() => setFavOpen(true)}
        onReset={hardReset}
      />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/catalogue"
          element={
            <Catalogue
              onAddToCart={addToCart}
              onFavorite={addFavorite}
              onUnfavorite={removeFavorite}
              returned={returned}
              purchased={purchased}
            />
          }
        />
        <Route
          path="/piece/:id"
          element={<ProductDetail onAddToCart={addToCart} onFavorite={addFavorite} />}
        />
        <Route
          path="/checkout"
          element={<CheckoutPage cart={cart} onPlaceOrder={placeOrder} />}
        />
        <Route path="/suivi" element={<TrackOrder />} />
        <Route
          path="/shop"
          element={
            <main className="stage">
              <div className="shop-toolbar">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={handleUndo}
                  disabled={historyCount === 0}
                  title="Annule ton dernier swipe — 1 fois par heure"
                >
                  ↩ Reviens
                </button>
                <button
                  type="button"
                  className={`toolbar-btn ${filterCount > 0 ? 'toolbar-btn--active' : ''}`}
                  onClick={() => setFilterOpen(true)}
                >
                  ⚙ Filtrer{filterCount > 0 ? ` (${filterCount})` : ''}
                </button>
              </div>

              <QuickFilters filters={filters} deck={deck} onApply={applyFilters} />

              {showEmpty ? (
                filteredEmpty ? (
                  <div className="empty">
                    <div className="empty__emoji">🔍</div>
                    <h2>Aucune pièce ne correspond.</h2>
                    <p>Essaie d'élargir tes filtres pour voir plus de pièces.</p>
                    <div className="empty__actions">
                      <button className="btn btn--add btn--wide" onClick={clearFilters}>
                        Effacer les filtres
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    onStockRefresh={stockRefresh}
                    onHardReset={hardReset}
                    onOpenCart={() => setCartOpen(true)}
                    cartCount={cartCount}
                  />
                )
              ) : (
                <SwipeDeck
                  deck={deck}
                  reducedMotion={reducedMotion}
                  onKeep={handleKeep}
                  onPass={handlePass}
                  onFavorite={handleFavorite}
                />
              )}
              {!showEmpty && deck.length > 0 && <SwipeCoach />}
              {!showEmpty && (
                <p className="hint">
                  ← Passer · → Garder · ↑ Favori · ou utilise les boutons.
                </p>
              )}
            </main>
          }
        />
      </Routes>

      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
        onPlaceOrder={placeOrder}
      />
      <FavoritesDrawer
        open={favOpen}
        onClose={() => setFavOpen(false)}
        favorites={favorites}
        onMoveToCart={moveFavoriteToCart}
        onRemove={removeFavorite}
      />
      <FilterDrawer
        open={filterOpen}
        filters={filters}
        onApply={applyFilters}
        onClear={clearFilters}
        onClose={() => setFilterOpen(false)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            aria-live="polite"
            initial={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 24, scale: 0.9 }}
            animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 12, scale: 0.95 }}
            transition={
              reducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 28 }
            }
          >
            <span className="toast__dot" aria-hidden="true" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
