import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

interface Props {
  cartCount: number;
  favCount: number;
  onCart: () => void;
  onFavorites: () => void;
  onReset: () => void;
}

export function Header({ cartCount, favCount, onCart, onFavorites, onReset }: Props) {
  const reduce = useReducedMotion();
  const { t } = useT();
  // Re-keying on the count value makes the badge pop each time it changes.
  const badgeMotion = (key: number) => ({
    key,
    initial: reduce ? { opacity: 0 } : { scale: 0, opacity: 0 },
    animate: reduce ? { opacity: 1 } : { scale: 1, opacity: 1 },
    exit: reduce ? { opacity: 0 } : { scale: 0, opacity: 0 },
    transition: reduce
      ? { duration: 0.12 }
      : { type: 'spring' as const, stiffness: 600, damping: 18 },
  });

  return (
    <header className="app-header">
      <div className="app-header__inner">
      <NavLink to="/" className="logo">
        <span className="logo__mark">FR</span>
        <div>
          <h1>Fripa</h1>
          <p>{t('header.tagline')} · 🇹🇳</p>
        </div>
      </NavLink>

      <nav className="app-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          {t('nav.home')}
        </NavLink>
        <NavLink
          to="/shop"
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          {t('nav.shop')}
        </NavLink>
        <NavLink
          to="/catalogue"
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          {t('nav.catalogue')}
        </NavLink>
      </nav>

      <div className="header-actions">
        <LanguageSwitcher />
        <button className="ghost-btn" onClick={onReset} title={t('a11y.reset')}>
          ↻
        </button>
        <button className="cart-btn" onClick={onFavorites} aria-label={t('a11y.favorites')}>
          ⭐
          <AnimatePresence>
            {favCount > 0 && (
              <motion.span
                className="cart-btn__badge cart-btn__badge--fav"
                {...badgeMotion(favCount)}
              >
                {favCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button className="cart-btn" onClick={onCart} aria-label={t('a11y.cart')}>
          🛒
          <AnimatePresence>
            {cartCount > 0 && (
              <motion.span className="cart-btn__badge" {...badgeMotion(cartCount)}>
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      </div>
    </header>
  );
}
