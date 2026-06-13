import { useState } from 'react';
import {
  ALL_SIZES,
  getSizeProfile,
  markSizePromptSeen,
  setSizeProfile,
  sizePromptSeen,
  type Size,
} from '../filters/sizeProfile';
import { useT } from '../i18n/LanguageContext';

// First-run, no-login size prompt shown once above the deck. Picking sizes
// saves the anonymous profile; "Toutes les tailles"/dismiss just marks it seen.
export function SizePrompt() {
  const { t } = useT();
  const [show, setShow] = useState(() => !sizePromptSeen());
  const [picked, setPicked] = useState<Set<Size>>(() => new Set(getSizeProfile()));
  if (!show) return null;

  function toggle(s: Size) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }
  function dismiss(save: boolean) {
    if (save) setSizeProfile([...picked]);
    markSizePromptSeen();
    setShow(false);
  }

  return (
    <div className="size-prompt" role="group" aria-label={t('size.title')}>
      <button
        className="size-prompt__close"
        onClick={() => dismiss(false)}
        aria-label={t('size.all')}
      >
        ✕
      </button>
      <strong className="size-prompt__title">{t('size.title')}</strong>
      <p className="size-prompt__text">{t('size.text')}</p>
      <div className="size-prompt__chips">
        {ALL_SIZES.map((s) => (
          <button
            key={s}
            className={`chip chip--toggle ${picked.has(s) ? 'chip--on' : ''}`}
            onClick={() => toggle(s)}
            aria-pressed={picked.has(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="size-prompt__actions">
        <button className="btn btn--pass size-prompt__all" onClick={() => dismiss(false)}>
          {t('size.all')}
        </button>
        <button
          className="btn btn--add"
          onClick={() => dismiss(true)}
          disabled={picked.size === 0}
        >
          {t('size.save')}
        </button>
      </div>
    </div>
  );
}
