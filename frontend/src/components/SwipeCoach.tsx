import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';

const KEY = 'fripa-coached';

// One-time overlay teaching the three swipe gestures (first deck visit).
export function SwipeCoach() {
  const { t } = useT();
  const MOVES = [
    { icon: '←', label: t('coach.pass'), desc: t('coach.passDesc'), cls: 'pass' },
    { icon: '→', label: t('coach.keep'), desc: t('coach.keepDesc'), cls: 'keep' },
    { icon: '↑', label: t('coach.favorite'), desc: t('coach.favDesc'), cls: 'fav' },
  ];
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });
  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="coach-backdrop" onClick={dismiss}>
      <div className="coach" onClick={(e) => e.stopPropagation()}>
        <h3 className="coach__title">{t('coach.title')}</h3>
        <ul className="coach__moves">
          {MOVES.map((m) => (
            <li key={m.label} className={`coach__move coach__move--${m.cls}`}>
              <span className="coach__icon">{m.icon}</span>
              <strong>{m.label}</strong>
              <span className="coach__desc">{m.desc}</span>
            </li>
          ))}
        </ul>
        <p className="coach__note">{t('coach.note')}</p>
        <button className="btn btn--add btn--wide" onClick={dismiss}>
          {t('coach.cta')}
        </button>
      </div>
    </div>
  );
}
