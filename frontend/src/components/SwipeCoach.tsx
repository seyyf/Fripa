import { useState } from 'react';

const KEY = 'fripa-coached';

const MOVES = [
  { icon: '←', label: 'Passer', desc: 'Swipe à gauche', cls: 'pass' },
  { icon: '→', label: 'Garder', desc: 'Swipe à droite', cls: 'keep' },
  { icon: '↑', label: 'Favori', desc: 'Swipe vers le haut', cls: 'fav' },
];

// One-time overlay teaching the three swipe gestures (first deck visit).
export function SwipeCoach() {
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
        <h3 className="coach__title">Comment ça marche</h3>
        <ul className="coach__moves">
          {MOVES.map((m) => (
            <li key={m.label} className={`coach__move coach__move--${m.cls}`}>
              <span className="coach__icon">{m.icon}</span>
              <strong>{m.label}</strong>
              <span className="coach__desc">{m.desc}</span>
            </li>
          ))}
        </ul>
        <p className="coach__note">Ou utilise les boutons sous la carte.</p>
        <button className="btn btn--add btn--wide" onClick={dismiss}>
          C’est parti →
        </button>
      </div>
    </div>
  );
}
