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
import {
  getSizeProfile,
  setSizeProfile,
  sizesEqual,
  useSizeProfile,
  type Size,
} from './filters/sizeProfile';
import { holdState } from './cart/holdTimer';
import { SizePrompt } from './components/SizePrompt';
import { SwipeDeck } from './components/SwipeDeck';
import { QuickFilters } from './components/QuickFilters';
import { TrackOrder } from './components/TrackOrder';
import { useAccount } from './account/AccountContext';
import { useT } from './i18n/LanguageContext';
import { accountApi } from './account/accountApi';
import { AccountPage } from './account/AccountPage';
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
  // Seed the deck filter from the saved size profile (anonymous, no login).
  const [filters, setFilters] = useState<FieldFilters>(() => {
    const s = getSizeProfile();
    return s.length ? { sizes: s } : {};
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [outOfCards, setOutOfCards] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  // A piece just removed from the cart → returned to the floor. The tick lets
  // the catalogue react even if the same piece is returned twice.
  const [returned, setReturned] = useState<{ item: TShirt; tick: number } | null>(null);
  // Pieces bought at checkout → the catalogue removes them from the floor.
  const [purchased, setPurchased] = useState<{ ids: string[]; tick: number } | null>(null);

  const { user } = useAccount();
  const { t } = useT();
  const deckRef = useRef<FieldItem[]>([]);
  const filtersRef = useRef<FieldFilters>({});
  const fetching = useRef(false);
  // Latest favourites snapshot, used to push anonymous favourites to the account on login.
  const favRef = useRef<FavoritesResponse>({ lines: [] });
  favRef.current = favorites;
  const syncedRef = useRef(false);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // `error` tone = louder treatment (red, shake, icon) and stays up longer —
  // used for refusals the shopper must read, like the 10-piece cart cap.
  function flash(msg: string, tone: 'info' | 'error' = 'info') {
    const entry = { text: msg, tone };
    setToast(entry);
    setTimeout(() => setToast((t) => (t === entry ? null : t)), tone === 'error' ? 4500 : 2200);
  }

  const refreshCart = useCallback(async () => setCart(await api.cart()), []);
  // Favourites come from the account when signed in (synced across devices),
  // otherwise from the anonymous per-browser session.
  const refreshFavorites = useCallback(async () => {
    setFavorites(user ? await accountApi.favorites() : await api.favorites());
  }, [user]);

  // On login, push the anonymous favourites up to the account once, then reload.
  useEffect(() => {
    if (user && !syncedRef.current) {
      syncedRef.current = true;
      accountApi
        .syncFavorites(favRef.current.lines.map((l) => l.id))
        .then(setFavorites)
        .catch(() => void refreshFavorites());
    }
    if (!user) syncedRef.current = false;
  }, [user, refreshFavorites]);

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
            flash(t('toast.expired', { title: line.title }));
            setReturned((r) => ({ item: line, tick: (r?.tick ?? 0) + 1 }));
            released = true;
          }
        } else if (phase === 'warning' && !warnedHolds.current.has(key)) {
          warnedHolds.current.add(key);
          flash(t('toast.expiring', { title: line.title }));
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
      flash(t('toast.added', { title: item.title }));
    } catch (e) {
      console.error('keep failed', e);
      restore(item);
      flash(errMsg(e, t('toast.retry')), 'error');
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
      flash(t('toast.retry'));
      return;
    }
    if (item.lastChance) flash(t('toast.goneForGood'));
    void topUp();
  }

  async function handleFavorite(item: FieldItem) {
    dropTop(item.id);
    try {
      await api.favorite(item.id);
      if (user) await accountApi.addFavorite(item.id);
      await refreshFavorites();
      flash(t('toast.favorited', { title: item.title }));
    } catch (e) {
      console.error('favorite failed', e);
      restore(item);
      flash(t('toast.retry'));
      return;
    }
    void topUp();
  }

  async function handleUndo() {
    try {
      const res = await api.undo();
      if (res.rateLimited) {
        flash(t('toast.undoLimited'));
        return;
      }
      if (!res.undone) {
        setHistoryCount(0);
        return;
      }
      const { item } = res.undone; // always a pass — keeps/favorites aren't undoable
      setHistoryCount((c) => Math.max(0, c - 1));
      // The piece is available again — drop it back on top of the deck.
      restore({ ...item, lastChance: false });
      setOutOfCards(false);
      flash(t('toast.undone', { title: item.title }));
    } catch (e) {
      console.error('undo failed', e);
    }
  }

  // Cart / favorite actions from the catalogue detail page (no deck involved).
  async function addToCart(item: TShirt) {
    try {
      setCart(await api.add(item.id));
      flash(t('toast.added', { title: item.title }));
    } catch (e) {
      console.error('add failed', e);
      flash(errMsg(e, t('toast.retry')), 'error');
    }
  }

  async function addFavorite(item: TShirt) {
    try {
      await api.favorite(item.id);
      if (user) await accountApi.addFavorite(item.id);
      await refreshFavorites();
      flash(t('toast.favorited', { title: item.title }));
    } catch (e) {
      console.error('favorite failed', e);
      flash(t('toast.retry'));
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

  async function placeOrder(
    customer: CustomerInfo,
    promoCode?: string,
    referralCode?: string,
  ): Promise<CheckoutResult> {
    const ids = cart.lines.map((l) => l.id);
    const res = await api.checkout(customer, promoCode, referralCode);
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
      if (user) await accountApi.removeFavorite(itemId);
      await refreshFavorites();
      flash(t('toast.movedToCart'));
    } catch (e) {
      console.error('move to cart failed', e);
      flash(errMsg(e, t('toast.retry')), 'error');
    }
  }

  async function removeFavorite(itemId: string) {
    try {
      await api.unfavorite(itemId);
      if (user) await accountApi.removeFavorite(itemId);
      await refreshFavorites();
    } catch (e) {
      console.error('unfavorite failed', e);
    }
  }

  // Replace the deck with a fresh batch under a new filter set. The chosen
  // sizes are mirrored to the anonymous size profile so they stick across
  // visits/devices with no login.
  const reloadDeck = useCallback(
    async (next: FieldFilters) => {
      filtersRef.current = next;
      setFilters(next);
      setSizeProfile((next.sizes as Size[] | undefined) ?? []);
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

  // Keep the deck in sync if the size profile changes elsewhere (e.g. from the
  // catalogue or the first-run prompt). Guarded so it never loops with the
  // mirror above.
  const sizeProfile = useSizeProfile();
  useEffect(() => {
    if (!sizesEqual(sizeProfile, filtersRef.current.sizes)) {
      void reloadDeck({
        ...filtersRef.current,
        sizes: sizeProfile.length ? sizeProfile : undefined,
      });
    }
  }, [sizeProfile, reloadDeck]);

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
        <Route path="/compte" element={<AccountPage />} />
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
                  title="Reprends la dernière pièce passée (swipe gauche) — 1 fois par heure"
                >
                  {t('deck.undo')}
                </button>
                <button
                  type="button"
                  className={`toolbar-btn ${filterCount > 0 ? 'toolbar-btn--active' : ''}`}
                  onClick={() => setFilterOpen(true)}
                >
                  {t('deck.filter')}{filterCount > 0 ? ` (${filterCount})` : ''}
                </button>
              </div>

              <QuickFilters filters={filters} onApply={applyFilters} />
              <SizePrompt />

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
              {!showEmpty && (
                <p className="hint">{t('deck.hint')}</p>
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
            className={`toast ${toast.tone === 'error' ? 'toast--error' : ''}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            initial={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 24, scale: 0.9 }}
            animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: 12, scale: 0.95 }}
            transition={
              reducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 28 }
            }
          >
            {/* The shake lives on the inner span — the outer transform belongs
                to framer-motion and must not be fought by a CSS animation. */}
            <span className="toast__inner">
              {toast.tone === 'error' ? (
                <span className="toast__warn" aria-hidden="true">⚠️</span>
              ) : (
                <span className="toast__dot" aria-hidden="true" />
              )}
              {toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
