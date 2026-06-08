import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion';
import { api } from '../api';
import type { TShirt } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';

const MotionLink = motion(Link);

const COUNT_EASE = [0.22, 1, 0.36, 1] as const;

// A stat figure that counts up from zero the first time it scrolls into view.
// The displayed text starts at the final value, so it reads correctly before
// (and without) any animation — only the count-up replaces it once in view.
function StatValue({ value }: { value: string }) {
  const reduce = useReducedMotion();
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? parseInt(match[1], 10) : 0;
  const suffix = match ? match[2] : value;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce || !match || !inView) return;
    setDisplay(`0${suffix}`);
    const controls = animate(0, target, {
      duration: 1.1,
      ease: COUNT_EASE,
      onUpdate: (v) => setDisplay(`${Math.round(v)}${suffix}`),
    });
    return () => controls.stop();
    // `match` is a fresh array each render; gate on its boolean presence instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, target, suffix]);

  return (
    <span ref={ref} className="home__stat-value">
      {display}
    </span>
  );
}

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

const EASE = [0.22, 1, 0.36, 1] as const;
const viewport = { once: true, amount: 0.2 } as const;

export function HomePage() {
  const reduce = useReducedMotion();
  // Smart default: phones land on the swipe deck, larger screens on the grid —
  // both stay reachable from the nav.
  const isMobile = useMediaQuery('(max-width: 600px)');
  const browseTo = isMobile ? '/shop' : '/catalogue';
  const [preview, setPreview] = useState<TShirt[]>([]);

  // Reduced-motion users get presence without movement.
  const fadeUp: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 26 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      };
  const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
  };
  const hover = reduce ? {} : { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 } };
  const cardHover = reduce ? {} : { whileHover: { y: -5 } };

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
      <section className="home-band home-band--hero">
        <motion.div
          className="home-wrap home__hero"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="home__badge" variants={fadeUp}>
            🇹🇳 Friperie en ligne
          </motion.span>
          <motion.h1 className="home__title" variants={fadeUp}>
            Fripa
          </motion.h1>
          <motion.p className="home__tagline" variants={fadeUp}>
            Le vide-dressing tunisien qui file vite. Tu swipes, tu gardes, tu chines —
            mais attention : <strong>90% du temps, une pièce passée disparaît pour de bon.</strong>
          </motion.p>
          <motion.div className="home__hero-actions" variants={fadeUp}>
            <MotionLink to={browseTo} className="btn btn--add btn--cta" {...hover}>
              Commencer à chiner →
            </MotionLink>
            <motion.a href="#how" className="btn btn--ghost btn--cta-ghost" {...hover}>
              Comment ça marche
            </motion.a>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="home-band home-band--stats" aria-label="Chiffres clés">
        <motion.div
          className="home-wrap home__stats"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          {STATS.map((s) => (
            <motion.div key={s.label} className="home__stat" variants={fadeUp}>
              <StatValue value={s.value} />
              <span className="home__stat-label">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Centered content sections */}
      <div className="home-wrap home__content">
        {/* How it works */}
        <motion.section
          className="home__how"
          id="how"
          aria-label="Comment ça marche"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <h2 className="home__section-title">Comment ça marche</h2>
          <motion.ul className="home__steps" variants={stagger}>
            {STEPS.map((s) => (
              <motion.li key={s.label} className="home__step" variants={fadeUp}>
                <span className="home__step-icon">{s.icon}</span>
                <div>
                  <strong className="home__step-label">{s.label}</strong>
                  <p className="home__step-desc">{s.desc}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
          <p className="home__note">
            Les 10% restants reviennent <strong>une seule fois</strong> avec un bandeau
            « Dernière chance ». Comme dans une vraie fripa.
          </p>
        </motion.section>

        {/* Live preview */}
        {preview.length > 0 && (
          <section className="home__preview" aria-label="Pièces du moment">
            <motion.div
              className="home__preview-head"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              <h2 className="home__section-title">Pièces du moment</h2>
              <Link to="/shop" className="home__preview-all">
                Voir toutes les pièces →
              </Link>
            </motion.div>
            <motion.div
              className="preview-grid"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
            >
              {preview.map((item) => (
                <motion.div key={item.id} variants={fadeUp} {...cardHover}>
                  <Link to="/shop" className="preview-card">
                    <span
                      className="preview-card__img"
                      style={{ backgroundImage: `url(${item.imageUrl})` }}
                    />
                    <span className="preview-card__title">{item.title}</span>
                    <span className="preview-card__price">{item.price} TND</span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}

        {/* Testimonials */}
        <section className="home__testimonials" aria-label="Témoignages">
          <motion.h2
            className="home__section-title"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            Ils chinent déjà
          </motion.h2>
          <motion.div
            className="testimonial-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            {TESTIMONIALS.map((t) => (
              <motion.figure key={t.author} className="testimonial" variants={fadeUp}>
                <blockquote className="testimonial__quote">« {t.quote} »</blockquote>
                <figcaption className="testimonial__author">— {t.author}</figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </section>

        {/* FAQ */}
        <motion.section
          className="home__faq"
          aria-label="Questions fréquentes"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <h2 className="home__section-title">Questions fréquentes</h2>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q} className="faq-item">
                <summary className="faq-q">{f.q}</summary>
                <p className="faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Final CTA band */}
      <section className="home-band home-band--cta">
        <motion.div
          className="home-wrap home__cta-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <h2 className="home__cta-title">Prête à chiner ?</h2>
          <p className="home__cta-text">
            Des centaines de pièces uniques t'attendent. Mais elles ne t'attendent pas longtemps.
          </p>
          <MotionLink to="/shop" className="btn btn--cta home__cta-btn" {...hover}>
            Swiper maintenant →
          </MotionLink>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="home-band home-band--footer">
        <div className="home-wrap home__footer">
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
        </div>
      </footer>
    </div>
  );
}
