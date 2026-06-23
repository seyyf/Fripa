import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';

const SEEN_KEY = 'fripa-intro-seen';

function seen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

// One-time "how it works" overlay shown on a shopper's first visit. Gated by its
// own localStorage flag, separate from the swipe-gesture demo.
export function IntroCard() {
  const { t } = useT();
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div className="intro-card__backdrop" onClick={dismiss}>
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="intro-card__title">{t('intro.title')}</h2>
        <ul className="intro-card__list">
          <li>✋ {t('intro.swipe')}</li>
          <li>🛒 {t('intro.cap')}</li>
          <li>🚚 {t('intro.cod')}</li>
        </ul>
        <button className="btn btn--add intro-card__cta" onClick={dismiss}>
          {t('intro.cta')}
        </button>
      </div>
    </div>
  );
}
