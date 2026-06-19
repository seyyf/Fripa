import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { effectivePrice, isOnSale, type FieldItem } from '../types';
import { decideSwipe, type SwipeAction, type SwipeThresholds } from '../swipe/decideSwipe';
import { haptic } from '../util/haptic';
import { useT } from '../i18n/LanguageContext';

interface Props {
  item: FieldItem;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
  reducedMotion?: boolean;
  // First-visit teaching: play a one-time scripted nudge (right→left→up) so the
  // shopper sees each gesture and its feedback before touching anything.
  demo?: boolean;
  onDemoEnd?: () => void;
  // Fired on a non-committing interaction (drag attempt, photo tap) so the deck
  // can reset its idle re-nudge timer.
  onInteract?: () => void;
}

const THRESHOLDS: SwipeThresholds = { right: 110, left: 110, up: 110 };
// How far (in seconds) a release velocity is projected forward, so a quick
// flick commits even when the finger didn't travel past the distance threshold.
const VELOCITY_PROJECTION = 0.18;
// Ease used for the fly-off — a gentle "out" curve so the card accelerates away.
const FLY_EASE = [0.22, 1, 0.36, 1] as const;
// How far the exiting card is thrown (comfortably past any viewport edge).
const THROW_X = typeof window !== 'undefined' ? Math.max(640, window.innerWidth * 0.9) : 760;
const THROW_Y = typeof window !== 'undefined' ? Math.max(760, window.innerHeight * 0.9) : 900;

// forwardRef: AnimatePresence mode="popLayout" measures the exiting card via
// this ref to pin it absolutely while it flies out of the deck's flex flow.
export const SwipeCard = forwardRef<HTMLDivElement, Props>(function SwipeCard(
  { item, onKeep, onPass, onFavorite, reducedMotion = false, demo = false, onDemoEnd, onInteract }: Props,
  ref,
) {
  const { t } = useT();

  // --- Photo angles (Tinder pattern: tap to change angle, drag to decide) ---
  // Cover first, then the extra angles; empty/duplicate URLs dropped.
  const photos = useMemo(() => {
    const all = [item.imageUrl, ...(item.images ?? [])].filter(Boolean);
    return [...new Set(all)];
  }, [item.imageUrl, item.images]);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Preload the other angles as soon as this card is on top, so taps swap
  // with zero flash.
  useEffect(() => {
    for (const url of photos.slice(1)) {
      const img = new Image();
      img.src = url;
    }
  }, [photos]);
  // A tap is only a tap if the card didn't move: while a drag is in flight we
  // swallow the click the browser fires on release.
  const draggingRef = useRef(false);
  function cyclePhoto(dir: 1 | -1) {
    if (draggingRef.current || photos.length < 2) return;
    onInteract?.();
    setPhotoIndex((i) => (i + dir + photos.length) % photos.length);
  }

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Z-rotation is derived from x with NO clamp: the exit throw pushes x far
  // past the drag range, so the card keeps rotating as it sails away.
  const rotate = useTransform(x, [-240, 240], [-14, 14], { clamp: false });
  // True 3D: the card yaws/pitches toward the drag (the `.deck` supplies the
  // perspective). Clamped — tilt stays subtle even during the throw.
  const rotateY = useTransform(x, [-240, 240], [-11, 11]);
  const rotateX = useTransform(y, [-240, 240], [10, -10]);

  // A sheen that slides across the photo opposite the drag, like light raking
  // a glossy card. Transform + opacity only — no repaints while dragging.
  const glareX = useTransform(x, [-240, 240], [110, -110]);
  const glareY = useTransform(y, [-240, 240], [60, -60]);
  const glareOpacity = useTransform([x, y], ([vx, vy]: number[]) =>
    Math.min(0.5, (Math.abs(vx) + Math.abs(vy)) / 320),
  );

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

  // --- First-visit demo --------------------------------------------------
  // Scripted nudge that drives the same x/y the shopper would — so the glow
  // and the GARDER/PASSER/FAVORI stamps light up exactly as during a real
  // swipe. A floating hand cue rides along. Cancels the instant the shopper
  // touches the card, and runs at most once (gated by the parent).
  const [demoing, setDemoing] = useState(false);
  const demoCancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!demo || reducedMotion) return;
    let cancelled = false;
    const controls: { stop: () => void }[] = [];
    const step = (mv: typeof x, to: number, dur: number) =>
      new Promise<void>((resolve) => {
        controls.push(animate(mv, to, { duration: dur, ease: FLY_EASE, onComplete: resolve }));
      });
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const A = 96; // amplitude — past the 40px stamp threshold, so feedback shows

    demoCancel.current = () => {
      if (cancelled) return;
      cancelled = true;
      controls.forEach((c) => c.stop());
      setDemoing(false);
      animate(x, 0, { duration: 0.18 });
      animate(y, 0, { duration: 0.18 });
      onDemoEnd?.();
    };

    (async () => {
      await wait(550); // let the card settle before demonstrating
      if (cancelled) return;
      setDemoing(true);
      const seq: [typeof x, number, number, number][] = [
        [x, A, 0.5, 430], // → Garder
        [x, 0, 0.4, 200],
        [x, -A, 0.5, 430], // ← Passer
        [x, 0, 0.4, 200],
        [y, -A, 0.5, 430], // ↑ Favori
        [y, 0, 0.45, 0],
      ];
      for (const [mv, to, dur, pause] of seq) {
        await step(mv, to, dur);
        if (cancelled) return;
        if (pause) await wait(pause);
        if (cancelled) return;
      }
      setDemoing(false);
      onDemoEnd?.();
    })();

    return () => {
      cancelled = true;
      controls.forEach((c) => c.stop());
      demoCancel.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, reducedMotion]);

  // Report the decision immediately — the parent removes the card and the
  // `exit` variant below throws it off-screen from wherever the drag left it.
  function fire(action: SwipeAction) {
    haptic();
    if (action === 'keep') onKeep(item);
    else if (action === 'pass') onPass(item);
    else onFavorite(item);
  }

  function springBack() {
    const t = { type: 'spring' as const, stiffness: 520, damping: 34 };
    animate(x, 0, t);
    animate(y, 0, t);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    // Clear AFTER the click the browser fires on release, so a drag never
    // doubles as a photo tap.
    setTimeout(() => {
      draggingRef.current = false;
    }, 0);
    // Project the release velocity forward so a flick counts as a swipe.
    const projected = {
      x: info.offset.x + info.velocity.x * VELOCITY_PROJECTION,
      y: info.offset.y + info.velocity.y * VELOCITY_PROJECTION,
    };
    const action = decideSwipe(projected, THRESHOLDS);
    if (action) fire(action);
    else springBack();
  }

  // Springy button feedback (skipped for reduced-motion users).
  const press = reducedMotion ? {} : { whileHover: { scale: 1.1 }, whileTap: { scale: 0.88 } };
  const btnTransition = { type: 'spring' as const, stiffness: 480, damping: 18 };

  return (
    <motion.div
      ref={ref}
      className={`swipe-card ${item.lastChance ? 'swipe-card--last-chance' : ''}`}
      style={{ x, y, rotate, rotateX, rotateY }}
      drag
      dragMomentum={false}
      onDragStart={() => {
        draggingRef.current = true;
        demoCancel.current?.(); // the shopper took over — stop demonstrating
        onInteract?.(); // a drag attempt counts as engagement
      }}
      onDragEnd={handleDragEnd}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.92, y: 26, rotateY: -10 }
      }
      // x/y: 0 matter when an exit is INTERRUPTED — e.g. a keep that the server
      // refuses (cart full) restores the card mid-throw, and AnimatePresence
      // animates it back to this target. Without x here the card froze at the
      // edge of the screen. (Drag is unaffected: the target never changes, so
      // framer doesn't re-fire it while dragging.)
      animate={
        reducedMotion
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 1, scale: 1, x: 0, y: 0, rotateY: 0 }
      }
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      variants={{
        // The throw. `custom` (the decided action) arrives from the deck's
        // AnimatePresence, and the animation starts from the dragged position
        // because x/y are live motion values.
        exit: (action: SwipeAction | null) => {
          if (reducedMotion || !action) {
            return { opacity: 0, transition: { duration: 0.12 } };
          }
          const fly = {
            duration: 0.5,
            ease: FLY_EASE,
            opacity: { delay: 0.32, duration: 0.18 },
          };
          if (action === 'favorite') {
            // Launched skyward with a slight twist (the small x kick spins it).
            return { y: -THROW_Y, x: 60, scale: 0.9, opacity: 0, transition: fly };
          }
          const dir = action === 'keep' ? 1 : -1;
          // Flung sideways on a rising arc; rotate follows x past the clamp.
          return { x: dir * THROW_X, y: -90, scale: 0.95, opacity: 0, transition: fly };
        },
      }}
      exit="exit"
    >
      {/* Directional edge glow — opacity-driven, so it stays smooth while dragging. */}
      <motion.span className="swipe-card__glow swipe-card__glow--keep" style={{ opacity: keepGlow }} aria-hidden="true" />
      <motion.span className="swipe-card__glow swipe-card__glow--pass" style={{ opacity: passGlow }} aria-hidden="true" />
      <motion.span className="swipe-card__glow swipe-card__glow--favorite" style={{ opacity: favoriteGlow }} aria-hidden="true" />

      {/* Hand cue during the first-visit demo — rides along with the card. */}
      {demoing && (
        <span className="swipe-card__demo-hand" aria-hidden="true">
          👆
        </span>
      )}

      {item.lastChance && (
        <div className="last-chance-banner">
          <span className="last-chance-banner__dot" /> Dernière chance
        </div>
      )}

      <div
        className="swipe-card__image"
        style={{ backgroundImage: `url(${photos[photoIndex]})` }}
      >
        {photos.length > 1 && (
          <>
            {/* Segment bars: which angle you're on (stories pattern). */}
            <div className="swipe-card__segments" aria-hidden="true">
              {photos.map((url, i) => (
                <span
                  key={url}
                  className={`swipe-card__segment ${i === photoIndex ? 'swipe-card__segment--on' : ''}`}
                />
              ))}
            </div>
            {/* Invisible halves: tap left/right to change angle. Drags pass
                through to the card; a drag-release click is swallowed. */}
            <button
              type="button"
              className="swipe-card__tap swipe-card__tap--prev"
              aria-label={t('deck.prevPhoto')}
              onClick={() => cyclePhoto(-1)}
            />
            <button
              type="button"
              className="swipe-card__tap swipe-card__tap--next"
              aria-label={t('deck.nextPhoto')}
              onClick={() => cyclePhoto(1)}
            />
          </>
        )}
        {/* Raking light that follows the tilt. */}
        <motion.span
          className="swipe-card__glare"
          style={{ x: glareX, y: glareY, opacity: glareOpacity }}
          aria-hidden="true"
        />
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
        {isOnSale(item) && <span className="swipe-card__sale-badge">Soldes</span>}
        <span className="swipe-card__price">
          {isOnSale(item) && <span className="swipe-card__price-old">{item.price}</span>}
          {effectivePrice(item)} TND
        </span>
      </div>

      <div className="swipe-card__body">
        <div className="swipe-card__title-row">
          <h2 className="swipe-card__title">{item.title}</h2>
          <span className="swipe-card__brand">{item.brand}</span>
        </div>
        <p className="swipe-card__desc">{item.description}</p>
        <div className="swipe-card__meta">
          <span className="chip">{t('pd.size', { size: item.size })}</span>
          <span className="chip">{item.condition}</span>
          <span className="chip">{item.color}</span>
        </div>
        <div className="swipe-card__seller">📍 {item.seller}</div>
      </div>

      <div className="swipe-card__actions">
        <motion.button
          type="button"
          className="round-btn round-btn--pass"
          onClick={() => fire('pass')}
          aria-label={t('deck.pass')}
          transition={btnTransition}
          {...press}
        >
          ✕
        </motion.button>
        <motion.button
          type="button"
          className="round-btn round-btn--favorite"
          onClick={() => fire('favorite')}
          aria-label={t('deck.favorite')}
          transition={btnTransition}
          {...press}
        >
          ⭐
        </motion.button>
        <motion.button
          type="button"
          className="round-btn round-btn--keep"
          onClick={() => fire('keep')}
          aria-label={t('deck.keep')}
          transition={btnTransition}
          {...press}
        >
          🛒
        </motion.button>
      </div>
    </motion.div>
  );
});
