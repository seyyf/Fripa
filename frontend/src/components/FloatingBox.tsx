import { motion } from 'framer-motion';
import type { FieldBox } from '../field/fieldLayout';

interface Props {
  box: FieldBox;
  focused: boolean;
  reducedMotion: boolean;
  onReveal: (boxKey: string) => void;
  onDismiss: () => void;
  onGrab: (box: FieldBox) => void;
}

const DRIFT_AMP = 16; // px

export function FloatingBox({ box, focused, reducedMotion, onReveal, onDismiss, onGrab }: Props) {
  const { item } = box;
  const dx = Math.sin(box.driftSeed) * DRIFT_AMP;
  const dy = Math.cos(box.driftSeed * 1.3) * DRIFT_AMP;

  const drift =
    reducedMotion || focused
      ? { x: 0, y: 0 }
      : { x: [0, dx, 0], y: [0, dy, 0] };

  return (
    <motion.button
      type="button"
      className={`fbox ${focused ? 'fbox--focused' : ''} ${item.lastChance ? 'fbox--last-chance' : ''}`}
      style={{ left: `${box.xPct}%`, top: `${box.yPct}%`, zIndex: focused ? 40 : 1 }}
      aria-label={focused ? `${item.title} — détails` : item.title}
      onClick={(e) => {
        // Without stopPropagation, the box click bubbles to .field's
        // onClick={() => setFocusedKey(null)}, and React 18 batching makes
        // the dismiss win — focus swap silently breaks. The intended
        // behaviour: tap on any box (focused or not) is handled here only.
        e.stopPropagation();
        if (!focused) onReveal(box.boxKey);
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: 1,
        scale: focused ? 1.4 : box.scale,
        ...drift,
      }}
      exit={{ opacity: 0, scale: 0.5, y: -36, transition: { duration: 0.32 } }}
      transition={
        focused
          ? { type: 'spring', stiffness: 300, damping: 26 }
          : { duration: reducedMotion ? 0 : 9, repeat: reducedMotion ? 0 : Infinity, ease: 'easeInOut' }
      }
    >
      <span className="fbox__imgwrap">
        <img className="fbox__img" src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" />
        {item.lastChance && <span className="fbox__ribbon">Dernière chance</span>}
      </span>

      {focused && (
        <span className="fbox__panel" onClick={(e) => e.stopPropagation()}>
          <span className="fbox__title-row">
            <strong className="fbox__title">{item.title}</strong>
            <span className="fbox__brand">{item.brand}</span>
          </span>
          <span className="fbox__chips">
            <span className="chip">Taille {item.size}</span>
            <span className="chip">{item.condition}</span>
            <span className="chip">{item.color}</span>
          </span>
          <span className="fbox__seller">📍 {item.seller}</span>
          <span className="fbox__actions">
            <button
              type="button"
              className="btn btn--add btn--full"
              onClick={() => onGrab(box)}
            >
              🛒 Ajouter — {item.price} TND
            </button>
            <button type="button" className="btn btn--pass" onClick={onDismiss} aria-label="Reposer">
              ↩
            </button>
          </span>
        </span>
      )}
    </motion.button>
  );
}
