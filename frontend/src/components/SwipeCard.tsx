import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { FieldItem } from '../types';
import { decideSwipe, type SwipeThresholds } from '../swipe/decideSwipe';

interface Props {
  item: FieldItem;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
  reducedMotion?: boolean;
}

const THRESHOLDS: SwipeThresholds = { right: 120, left: 120, up: 120 };

export function SwipeCard({ item, onKeep, onPass, onFavorite, reducedMotion = false }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-16, 16]);

  // Overlay stamp opacities driven by drag distance in each direction.
  const keepOpacity = useTransform(x, [40, 130], [0, 1]);
  const passOpacity = useTransform(x, [-130, -40], [1, 0]);
  const favoriteOpacity = useTransform(y, [-130, -40], [1, 0]);

  function commit(action: ReturnType<typeof decideSwipe>) {
    if (action === 'keep') onKeep(item);
    else if (action === 'pass') onPass(item);
    else if (action === 'favorite') onFavorite(item);
  }

  return (
    <motion.div
      className={`swipe-card ${item.lastChance ? 'swipe-card--last-chance' : ''}`}
      style={{ x, y, rotate }}
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={() => commit(decideSwipe({ x: x.get(), y: y.get() }, THRESHOLDS))}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: reducedMotion ? 0 : 0.25 } }}
      whileTap={{ cursor: 'grabbing' }}
    >
      {item.lastChance && (
        <div className="last-chance-banner">
          <span className="last-chance-banner__dot" /> Dernière chance
        </div>
      )}

      <div
        className="swipe-card__image"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      >
        <motion.span className="stamp stamp--keep" style={{ opacity: keepOpacity }}>
          GARDER
        </motion.span>
        <motion.span className="stamp stamp--pass" style={{ opacity: passOpacity }}>
          PASSER
        </motion.span>
        <motion.span className="stamp stamp--favorite" style={{ opacity: favoriteOpacity }}>
          FAVORI
        </motion.span>
        <span className="swipe-card__price">{item.price} TND</span>
      </div>

      <div className="swipe-card__body">
        <div className="swipe-card__title-row">
          <h2 className="swipe-card__title">{item.title}</h2>
          <span className="swipe-card__brand">{item.brand}</span>
        </div>
        <p className="swipe-card__desc">{item.description}</p>
        <div className="swipe-card__meta">
          <span className="chip">Taille {item.size}</span>
          <span className="chip">{item.condition}</span>
          <span className="chip">{item.color}</span>
        </div>
        <div className="swipe-card__seller">📍 {item.seller}</div>
      </div>

      <div className="swipe-card__actions">
        <button
          type="button"
          className="round-btn round-btn--pass"
          onClick={() => onPass(item)}
          aria-label="Passer"
        >
          ✕
        </button>
        <button
          type="button"
          className="round-btn round-btn--favorite"
          onClick={() => onFavorite(item)}
          aria-label="Favori"
        >
          ⭐
        </button>
        <button
          type="button"
          className="round-btn round-btn--keep"
          onClick={() => onKeep(item)}
          aria-label="Garder"
        >
          🛒
        </button>
      </div>
    </motion.div>
  );
}
