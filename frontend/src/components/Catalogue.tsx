import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api';
import type { CatalogueItem, Category, FieldFilters, TShirt } from '../types';
import { activeFilterCount } from '../filters/fieldQuery';
import { formatHold } from '../cart/holdTimer';
import { usePhantomCrowd } from '../crowd/usePhantomCrowd';
import { FilterDrawer } from './FilterDrawer';
import { Modal } from './Modal';
import { ProductDetailContent } from './ProductDetailContent';

interface Props {
  onAddToCart: (item: TShirt) => void | Promise<void>;
  onFavorite: (item: TShirt) => void | Promise<void>;
  onUnfavorite: (itemId: string) => void | Promise<void>;
  // A piece released from the cart (removed or hold expired) → un-blur it.
  returned?: { item: TShirt; tick: number } | null;
  // Pieces just bought at checkout → remove them from the floor for good.
  purchased?: { ids: string[]; tick: number } | null;
}

const NAMES = ['Sarra', 'Yassine', 'Amine', 'Mariem', 'Khalil', 'Nour', 'Fares', 'Ines', 'Hela', 'Bilel'];
const MIN_FLOOR = 6; // the crowd never holds below this many available pieces
const MAX_CROWD_HOLDS = 6; // at most this many crowd-held pieces at once
const SNATCH_MIN = 4500;
const SNATCH_MAX = 9000;
const CART_HOLD_MS = 10 * 60 * 1000; // mirrors the backend cart TTL
const CROWD_HOLD_MS = 30 * 1000; // a phantom shopper holds a piece this long

type Hold = { by: 'you' | 'crowd'; until: number };

export function Catalogue({ onAddToCart, onFavorite, onUnfavorite, returned, purchased }: Props) {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [filters, setFilters] = useState<FieldFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogueItem | null>(null);
  const [holds, setHolds] = useState<Record<string, Hold>>({});
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [ticker, setTicker] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (f: FieldFilters) => {
    setLoading(true);
    try {
      const res = await api.catalogue(f);
      setItems(res.items);
      // Seed holds from the server's cart reservations; crowd holds are
      // ephemeral (reset on each load).
      const seeded: Record<string, Hold> = {};
      const seededFavs = new Set<string>();
      for (const it of res.items) {
        if (it.reservedUntil) seeded[it.id] = { by: 'you', until: it.reservedUntil };
        if (it.favorited) seededFavs.add(it.id);
      }
      setHolds(seeded);
      setFavs(seededFavs);
    } catch (e) {
      console.error('catalogue load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ ...filters, category: category ?? undefined });
  }, [load, filters, category]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  // Tick every second: update countdowns + release any hold that has lapsed
  // (the piece un-blurs and becomes grabbable again).
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setHolds((prev) => {
        let changed = false;
        const next: Record<string, Hold> = {};
        for (const [k, h] of Object.entries(prev)) {
          if (h.until <= t) changed = true;
          else next[k] = h;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function flashTicker(msg: string) {
    setTicker(msg);
    setTimeout(() => setTicker((m) => (m === msg ? null : m)), 3800);
  }

  // A phantom shopper grabs an available piece (client-side, temporary).
  function handleCrowdHold(id: string) {
    if (holds[id]) return;
    const item = items.find((i) => i.id === id);
    setHolds((prev) => (prev[id] ? prev : { ...prev, [id]: { by: 'crowd', until: Date.now() + CROWD_HOLD_MS } }));
    if (item) {
      const who = NAMES[Math.floor(Math.random() * NAMES.length)];
      flashTicker(`${who} vient de prendre « ${item.title} »`);
    }
  }

  // The user grabs a piece off the rack → it goes to the cart and stays on the
  // floor, blurred/held, with its hold countdown.
  function handleGrab(item: CatalogueItem) {
    if (holds[item.id]) return;
    setHolds((prev) => ({ ...prev, [item.id]: { by: 'you', until: Date.now() + CART_HOLD_MS } }));
    void onAddToCart(item);
  }

  // Favoriting keeps the piece on the floor and highlights it (toggle).
  function handleFav(item: CatalogueItem) {
    if (holds[item.id]) return;
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        void onUnfavorite(item.id);
      } else {
        next.add(item.id);
        void onFavorite(item);
      }
      return next;
    });
  }

  // Released from the cart (removed or hold expired) → un-blur on the floor.
  const lastReturn = useRef(returned?.tick ?? 0);
  useEffect(() => {
    if (!returned || returned.tick === lastReturn.current) return;
    lastReturn.current = returned.tick;
    const piece = returned.item;
    setHolds((prev) => {
      const n = { ...prev };
      delete n[piece.id];
      return n;
    });
    setItems((prev) => (prev.some((i) => i.id === piece.id) ? prev : [piece, ...prev]));
  }, [returned]);

  // Bought at checkout → remove from the floor for good.
  const lastPurchase = useRef(purchased?.tick ?? 0);
  useEffect(() => {
    if (!purchased || purchased.tick === lastPurchase.current) return;
    lastPurchase.current = purchased.tick;
    const gone = new Set(purchased.ids);
    setItems((prev) => prev.filter((i) => !gone.has(i.id)));
    setHolds((prev) => {
      const n = { ...prev };
      gone.forEach((id) => delete n[id]);
      return n;
    });
  }, [purchased]);

  const availableIds = items.filter((i) => !holds[i.id]).map((i) => i.id);
  const crowdCount = Object.values(holds).filter((h) => h.by === 'crowd').length;
  usePhantomCrowd({
    ids: availableIds,
    protectedId: selected ? selected.id : hoveredId,
    minFloor: MIN_FLOOR,
    minInterval: SNATCH_MIN,
    maxInterval: SNATCH_MAX,
    onSnatch: handleCrowdHold,
    paused: loading || filterOpen || crowdCount >= MAX_CROWD_HOLDS,
  });

  const filterCount = activeFilterCount(filters);
  const available = availableIds.length;

  return (
    <main className="catalogue">
      <div className="catalogue__head">
        <div>
          <h1 className="catalogue__title">Le rayon</h1>
          <p className="catalogue__count">
            <span className="live-dot" aria-hidden="true" />
            {loading ? 'Chargement…' : `${available} pièce${available > 1 ? 's' : ''} dispo · en direct`}
          </p>
        </div>
        <button
          type="button"
          className={`toolbar-btn ${filterCount > 0 ? 'toolbar-btn--active' : ''}`}
          onClick={() => setFilterOpen(true)}
        >
          ⚙ Filtrer{filterCount > 0 ? ` (${filterCount})` : ''}
        </button>
      </div>

      <div className="cat-tabs" role="tablist" aria-label="Catégories">
        <button
          type="button"
          className={`cat-tab ${!category ? 'cat-tab--on' : ''}`}
          onClick={() => setCategory(null)}
        >
          Tout
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`cat-tab ${category === c ? 'cat-tab--on' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="floor-ticker" aria-live="polite">
        {ticker ? `⏱ ${ticker}` : '👀 D’autres chinent en direct. Les pièces prises reviennent quand le chineur lâche.'}
      </div>

      {!loading && items.length === 0 ? (
        <div className="empty">
          <div className="empty__emoji">🧺</div>
          <h2>{filterCount > 0 || category ? 'Aucune pièce ne correspond.' : 'Le rayon est vide.'}</h2>
          <p>
            {filterCount > 0 || category
              ? 'Essaie d’élargir tes filtres.'
              : 'Tout est parti. Reviens plus tard.'}
          </p>
          {(filterCount > 0 || category) && (
            <div className="empty__actions">
              <button
                className="btn btn--add btn--wide"
                onClick={() => {
                  setFilters({});
                  setCategory(null);
                }}
              >
                Effacer les filtres
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="catalogue-grid">
          <AnimatePresence>
            {items.map((item) => {
              const hold = holds[item.id];
              const isFav = favs.has(item.id);
              if (hold) {
                return (
                  <motion.div
                    key={item.id}
                    className="cat-card-wrap is-held"
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
                  >
                    <div className="cat-card cat-card--held">
                      <span
                        className="cat-card__img"
                        style={{ backgroundImage: `url(${item.imageUrl})` }}
                      />
                      <span className="cat-card__body">
                        <span className="cat-card__title">{item.title}</span>
                        <span className="cat-card__meta">
                          <span className="cat-card__brand">{item.brand}</span>
                          <span className="cat-card__price">{item.price} TND</span>
                        </span>
                      </span>
                    </div>
                    <div className="hold-overlay">
                      <span className="hold-label">
                        {hold.by === 'you' ? '🛒 Réservé' : '⏱ Pris'}
                      </span>
                      <span className="hold-count">Revient dans {formatHold(hold.until - now)}</span>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.div
                  key={item.id}
                  className={`cat-card-wrap ${isFav ? 'is-fav' : ''}`}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId((h) => (h === item.id ? null : h))}
                >
                  <Link
                    to={`/piece/${item.id}`}
                    className="cat-card"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      setSelected(item);
                    }}
                  >
                    <span
                      className="cat-card__img"
                      style={{ backgroundImage: `url(${item.imageUrl})` }}
                    >
                      {isFav && <span className="cat-card__fav-ribbon">⭐ Favori</span>}
                    </span>
                    <span className="cat-card__body">
                      <span className="cat-card__title">{item.title}</span>
                      <span className="cat-card__meta">
                        <span className="cat-card__brand">{item.brand}</span>
                        <span className="cat-card__price">{item.price} TND</span>
                      </span>
                    </span>
                  </Link>

                  <div className="cat-card__actions">
                    <button
                      type="button"
                      className="grab-btn grab-btn--cart"
                      onClick={() => handleGrab(item)}
                      aria-label={`Prendre ${item.title}`}
                    >
                      🛒 Prendre
                    </button>
                    <button
                      type="button"
                      className={`grab-btn grab-btn--fav ${isFav ? 'grab-btn--fav-on' : ''}`}
                      aria-pressed={isFav}
                      onClick={() => handleFav(item)}
                      aria-label={`Garder pour plus tard ${item.title}`}
                    >
                      ⭐
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} label={selected.title}>
          <ProductDetailContent
            item={selected}
            status="available"
            onAddToCart={(it) => {
              handleGrab(it as CatalogueItem);
              setSelected(null);
            }}
            onFavorite={(it) => {
              handleFav(it as CatalogueItem);
              setSelected(null);
            }}
          />
        </Modal>
      )}

      <FilterDrawer
        open={filterOpen}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setFilterOpen(false);
        }}
        onClear={() => {
          setFilters({});
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </main>
  );
}
