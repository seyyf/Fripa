import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { FieldBox } from '../field/fieldLayout';
import { usePhantomCrowd } from '../field/usePhantomCrowd';
import { FloatingBox } from './FloatingBox';
import { AmbientLayer } from './AmbientLayer';

interface Props {
  boxes: FieldBox[];
  reducedMotion: boolean;
  minFieldSize: number;
  onGrab: (box: FieldBox) => void;
  onSnatch: (boxKey: string) => void;
}

const SNATCH_MIN_INTERVAL = 4000;
const SNATCH_MAX_INTERVAL = 8000;

export function FloatingField({ boxes, reducedMotion, minFieldSize, onGrab, onSnatch }: Props) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [calm, setCalm] = useState(false);
  const ambientEnabled = !calm && !reducedMotion;

  usePhantomCrowd({
    boxKeys: boxes.map((b) => b.boxKey),
    focusedKey,
    minFieldSize,
    minInterval: SNATCH_MIN_INTERVAL,
    maxInterval: SNATCH_MAX_INTERVAL,
    onSnatch,
  });

  function grab(box: FieldBox) {
    setFocusedKey(null);
    onGrab(box);
  }

  return (
    <div className="field" onClick={() => setFocusedKey(null)}>
      <AmbientLayer enabled={ambientEnabled} />

      <AnimatePresence>
        {boxes.map((box) => (
          <FloatingBox
            key={box.boxKey}
            box={box}
            focused={focusedKey === box.boxKey}
            reducedMotion={reducedMotion}
            onReveal={(k) => setFocusedKey(k)}
            onDismiss={() => setFocusedKey(null)}
            onGrab={grab}
          />
        ))}
      </AnimatePresence>

      {!reducedMotion && (
        <button
          type="button"
          className="calm-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setCalm((c) => !c);
          }}
        >
          {calm ? '✨ Animations' : '🌙 Mode calme'}
        </button>
      )}
    </div>
  );
}
