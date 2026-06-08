import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import type { FieldItem } from '../types';
import { decideSwipe, type SwipeAction, type SwipeThresholds } from '../swipe/decideSwipe';

interface Props {
  item: FieldItem;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
  reducedMotion?: boolean;
}

const THRESHOLDS: SwipeThresholds = { right: 110, left: 110, up: 110 };
// How far (in seconds) a release velocity is projected forward, so a quick
// flick commits even when the finger didn't travel past the distance threshold.
const VELOCITY_PROJECTION = 0.18;
// Ease used for the fly-off — a gentle "out" curve so the card accelerates away.
const FLY_EASE = [0.22, 1, 0.36, 1] as const;

export function SwipeCard({ item, onKeep, onPass, onFavorite, reducedMotion = false }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);

  // A colored halo grows around the card in whichever direction you drag,
  // previewing the decision before you commit. Driven by opacity (GPU-cheap)
  // rather than an animated box-shadow, which would repaint every frame.
  const keepGlow = useTransform(x, [40, 120], [0, 1]);
  const passGlow = useTransform(x, [-120, -40], [1, 0]);
  const favoriteGlow = useTransform(y, [-120, -40], [1, 0]);

  // Overlay stamp opacities driven by drag distance in each direction.
  const keepOpacity = useTransform(x, [40, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -40], [1, 0]);
  const favoriteOpacity = useTransform(y, [-120, -40], [1, 0]);
  // Stamps "press in" as they appear, for a rubber-stamp feel.
  const keepStamp = useTransform(x, [40, 120], [0.7, 1]);
  const passStamp = useTransform(x, [-120, -40], [1, 0.7]);
  const favoriteStamp = useTransform(y, [-120, -40], [1, 0.7]);

  function fire(action: SwipeAction) {
    if (action === 'keep') onKeep(item);
    else if (action === 'pass') onPass(item);
    else onFavorite(item);
  }

  // Smoothly throw the card off-screen in the committed direction, then report
  // the decision (which removes it from the deck).
  function flyOut(action: SwipeAction) {
    const opts = { duration: reducedMotion ? 0 : 0.28, ease: FLY_EASE };
    if (action === 'keep') animate(x, 1000, { ...opts, onComplete: () => fire(action) });
    else if (action === 'pass') animate(x, -1000, { ...opts, onComplete: () => fire(action) });
    else animate(y, -1100, { ...opts, onComplete: () => fire(action) });
  }

  function springBack() {
    const t = { type: 'spring' as const, stiffness: 520, damping: 34 };
    animate(x, 0, t);
    animate(y, 0, t);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    // Project the release velocity forward so a flick counts as a swipe.
    const projected = {
      x: info.offset.x + info.velocity.x * VELOCITY_PROJECTION,
      y: info.offset.y + info.velocity.y * VELOCITY_PROJECTION,
    };
    const action = decideSwipe(projected, THRESHOLDS);
    if (action) flyOut(action);
    else springBack();
  }

  // Springy button feedback (skipped for reduced-motion users).
  const press = reducedMotion ? {} : { whileHover: { scale: 1.1 }, whileTap: { scale: 0.88 } };
  const btnTransition = { type: 'spring' as const, stiffness: 480, damping: 18 };

  return (
    <motion.div
      className={`swipe-card ${item.lastChance ? 'swipe-card--last-chance' : ''}`}
      style={{ x, y, rotate }}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {/* Directional edge glow — opacity-driven, so it stays smooth while dragging. */}
      <motion.span className="swipe-card__glow swipe-card__glow--keep" style={{ opacity: keepGlow }} aria-hidden="true" />
      <motion.span className="swipe-card__glow swipe-card__glow--pass" style={{ opacity: passGlow }} aria-hidden="true" />
      <motion.span className="swipe-card__glow swipe-card__glow--favorite" style={{ opacity: favoriteGlow }} aria-hidden="true" />

      {item.lastChance && (
        <div className="last-chance-banner">
          <span className="last-chance-banner__dot" /> Dernière chance
        </div>
      )}

      <div
        className="swipe-card__image"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      >
        {/* rotate / x are set here (not just in CSS) because framer-motion's
            `scale` writes the whole `transform`, which would otherwise drop the
            stamps' CSS rotation and centering. */}
        <motion.span
          className="stamp stamp--keep"
          style={{ opacity: keepOpacity, scale: keepStamp, rotate: 14 }}
        >
          GARDER
        </motion.span>
        <motion.span
          className="stamp stamp--pass"
          style={{ opacity: passOpacity, scale: passStamp, rotate: -14 }}
        >
          PASSER
        </motion.span>
        <motion.span
          className="stamp stamp--favorite"
          style={{ opacity: favoriteOpacity, scale: favoriteStamp, x: '-50%' }}
        >
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
        <motion.button
          type="button"
          className="round-btn round-btn--pass"
          onClick={() => onPass(item)}
          aria-label="Passer"
          transition={btnTransition}
          {...press}
        >
          ✕
        </motion.button>
        <motion.button
          type="button"
          className="round-btn round-btn--favorite"
          onClick={() => onFavorite(item)}
          aria-label="Favori"
          transition={btnTransition}
          {...press}
        >
          ⭐
        </motion.button>
        <motion.button
          type="button"
          className="round-btn round-btn--keep"
          onClick={() => onKeep(item)}
          aria-label="Garder"
          transition={btnTransition}
          {...press}
        >
          🛒
        </motion.button>
      </div>
    </motion.div>
  );
}
