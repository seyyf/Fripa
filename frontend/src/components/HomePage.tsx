import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { TShirt } from '../types';

const STEPS = [
  { icon: '→', label: 'Garder', desc: 'Swipe à droite : la pièce file dans ton panier.' },
  { icon: '←', label: 'Passer', desc: 'Swipe à gauche : tu la laisses… et le sort décide.' },
  { icon: '↑', label: 'Favori', desc: 'Swipe vers le haut : gardée pour plus tard.' },
];

const STATS = [
  { value: '60+', label: 'pièces à chiner' },
  { value: '12', label: 'souks & villes' },
  { value: '90%', label: 'partent pour de bon' },
  { value: '3', label: 'façons de swiper' },
];

const TESTIMONIALS = [
  { quote: "J'ai chopé une veste Levi's vintage avant qu'elle parte. Le frisson d'une vraie fripa, depuis mon canapé.", author: 'Amine, Tunis' },
  { quote: 'Le swipe est addictif wallah. Je passe une pièce, elle disparaît, je culpabilise — exactement comme au souk.', author: 'Sarra, Sfax' },
  { quote: 'Les favoris pour garder mes coups de cœur et payer plus tard, parfait. Et les prix sont fripa, pas boutique.', author: 'Yassine, Sousse' },
];

const FAQ = [
  {
    q: 'Comment ça marche ?',
    a: "Tu swipes des pièces une par une : à droite pour garder (panier), à gauche pour passer, vers le haut pour mettre en favori. Comme une appli de rencontre, mais pour la fripe.",
  },
  {
    q: 'Pourquoi une pièce disparaît-elle quand je passe ?',
    a: "Parce que la fripe est unique. Quand tu passes une pièce, 90% du temps elle part pour de bon — comme dans une vraie fripa où quelqu'un d'autre l'attrape.",
  },
  {
    q: "C'est quoi « Dernière chance » ?",
    a: "Les 10% de pièces passées qui ne disparaissent pas reviennent une seule fois, avec un bandeau doré « Dernière chance ». À toi de jouer vite : elle peut repartir aussitôt.",
  },
  {
    q: 'Je me suis trompé, je peux revenir en arrière ?',
    a: "Oui : le bouton « Reviens ! » annule ton dernier swipe et remet la pièce sur le dessus du paquet.",
  },
  {
    q: 'Comment je paie et je suis livré ?',
    a: "Pour ce MVP, le checkout est une démo. Le paiement tunisien (Konnect, Flouci, D17) et la livraison arrivent bientôt.",
  },
];

export function HomePage() {
  const [preview, setPreview] = useState<TShirt[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .field(8)
      .then((r) => {
        if (alive) setPreview(r.items.slice(0, 8));
      })
      .catch(() => {
        /* preview is optional — ignore fetch errors */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="home">
      {/* Hero */}
      <section className="home__hero">
        <span className="home__badge">🇹🇳 Friperie en ligne</span>
        <h1 className="home__title">Fripa</h1>
        <p className="home__tagline">
          Le vide-dressing tunisien qui file vite. Tu swipes, tu gardes, tu chines —
          mais attention : <strong>90% du temps, une pièce passée disparaît pour de bon.</strong>
        </p>
        <div className="home__hero-actions">
          <Link to="/shop" className="btn btn--add btn--cta">
            Commencer à chiner →
          </Link>
          <a href="#how" className="btn btn--ghost btn--cta-ghost">
            Comment ça marche
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="home__stats" aria-label="Chiffres clés">
        {STATS.map((s) => (
          <div key={s.label} className="home__stat">
            <span className="home__stat-value">{s.value}</span>
            <span className="home__stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="home__how" id="how" aria-label="Comment ça marche">
        <h2 className="home__section-title">Comment ça marche</h2>
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

      {/* Live preview */}
      {preview.length > 0 && (
        <section className="home__preview" aria-label="Pièces du moment">
          <div className="home__preview-head">
            <h2 className="home__section-title">Pièces du moment</h2>
            <Link to="/shop" className="home__preview-all">
              Voir toutes les pièces →
            </Link>
          </div>
          <div className="preview-grid">
            {preview.map((item) => (
              <Link key={item.id} to="/shop" className="preview-card">
                <span
                  className="preview-card__img"
                  style={{ backgroundImage: `url(${item.imageUrl})` }}
                />
                <span className="preview-card__title">{item.title}</span>
                <span className="preview-card__price">{item.price} TND</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="home__testimonials" aria-label="Témoignages">
        <h2 className="home__section-title">Ils chinent déjà</h2>
        <div className="testimonial-grid">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="testimonial">
              <blockquote className="testimonial__quote">« {t.quote} »</blockquote>
              <figcaption className="testimonial__author">— {t.author}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="home__faq" aria-label="Questions fréquentes">
        <h2 className="home__section-title">Questions fréquentes</h2>
        <div className="faq-list">
          {FAQ.map((f) => (
            <details key={f.q} className="faq-item">
              <summary className="faq-q">{f.q}</summary>
              <p className="faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA band */}
      <section className="home__cta-band">
        <h2 className="home__cta-title">Prête à chiner ?</h2>
        <p className="home__cta-text">
          Des centaines de pièces uniques t'attendent. Mais elles ne t'attendent pas longtemps.
        </p>
        <Link to="/shop" className="btn btn--cta home__cta-btn">
          Swiper maintenant →
        </Link>
      </section>

      {/* Footer */}
      <footer className="home__footer">
        <div className="home__footer-brand">
          <span className="logo__mark">FR</span>
          <span>Fripa — le swipe du fripier 🇹🇳</span>
        </div>
        <nav className="home__footer-links">
          <Link to="/">Accueil</Link>
          <Link to="/shop">Boutique</Link>
          <a href="#how">Comment ça marche</a>
        </nav>
        <p className="home__footer-legal">© 2026 Fripa · MVP · Fait avec ❤️ en Tunisie</p>
      </footer>
    </div>
  );
}
