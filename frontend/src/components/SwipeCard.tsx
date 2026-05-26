import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useState } from 'react';
import type { TShirt } from '../types';

interface Props {
  item: TShirt & { lastChance: boolean };
  onPass: () => void;
  onAdd: () => void;
}

// One-direction swipe: drag left to dismiss. Add-to-cart is a button.
const DISMISS_THRESHOLD = 110;

export function SwipeCard({ item, onPass, onAdd }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 8]);
  const passOverlay = useTransform(x, [-200, -40, 0], [1, 0, 0]);
  const [locked, setLocked] = useState(false);

  function dismiss() {
    if (locked) return;
    setLocked(true);
    onPass();
  }
  function keep() {
    if (locked) return;
    setLocked(true);
    onAdd();
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -DISMISS_THRESHOLD || info.velocity.x < -500) {
      dismiss();
    }
  }

  return (
    <motion.article
      className={`card ${item.lastChance ? 'card--last-chance' : ''}`}
      style={{ x, rotate }}
      drag={locked ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.7, right: 0.1 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.94, opacity: 0, y: 14 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ x: -600, opacity: 0, rotate: -20, transition: { duration: 0.26 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {item.lastChance && (
        <div className="last-chance-banner">
          <span className="last-chance-banner__dot" />
          DERNIÈRE CHANCE — il ne reviendra plus
        </div>
      )}

      <div
        className="card__image"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      >
        <motion.div
          className="card__overlay card__overlay--pass"
          style={{ opacity: passOverlay }}
        >
          PASS
        </motion.div>
        <div className="card__price">{item.price} TND</div>
      </div>

      <div className="card__body">
        <div className="card__title-row">
          <h2 className="card__title">{item.title}</h2>
          <span className="card__brand">{item.brand}</span>
        </div>
        <p className="card__desc">{item.description}</p>
        <div className="card__meta">
          <span className="chip">Taille {item.size}</span>
          <span className="chip">{item.condition}</span>
          <span className="chip">{item.color}</span>
        </div>
        <div className="card__seller">📍 {item.seller}</div>
      </div>

      <div className="card__actions">
        <button className="btn btn--pass" onClick={dismiss} aria-label="Passer">
          ✕
        </button>
        <button className="btn btn--add" onClick={keep} aria-label="Ajouter au panier">
          🛒 Ajouter — {item.price} TND
        </button>
      </div>
    </motion.article>
  );
}
