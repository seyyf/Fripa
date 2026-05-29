import { Link } from 'react-router-dom';

const STEPS = [
  { icon: '→', label: 'Garder', desc: 'Swipe à droite : la pièce file dans ton panier.' },
  { icon: '←', label: 'Passer', desc: 'Swipe à gauche : tu la laisses… et le sort décide.' },
  { icon: '↑', label: 'Favori', desc: 'Swipe vers le haut : gardée pour plus tard.' },
];

export function HomePage() {
  return (
    <div className="home">
      <section className="home__hero">
        <span className="home__badge">🇹🇳 Friperie en ligne</span>
        <h1 className="home__title">Fripa</h1>
        <p className="home__tagline">
          Le vide-dressing tunisien qui file vite. Tu swipes, tu gardes, tu chines —
          mais attention : <strong>90% du temps, une pièce passée disparaît pour de bon.</strong>
        </p>
        <Link to="/shop" className="btn btn--add btn--cta">
          Commencer à chiner →
        </Link>
      </section>

      <section className="home__how" aria-label="Comment ça marche">
        <h2 className="home__how-title">Comment ça marche</h2>
        <ul className="home__steps">
          {STEPS.map((s) => (
            <li key={s.label} className="home__step">
              <span className="home__step-icon">{s.icon}</span>
              <div>
                <strong className="home__step-label">{s.label}</strong>
                <p className="home__step-desc">{s.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="home__note">
          Les 10% restants reviennent <strong>une seule fois</strong> avec un bandeau
          « Dernière chance ». Comme dans une vraie fripa.
        </p>
      </section>
    </div>
  );
}
