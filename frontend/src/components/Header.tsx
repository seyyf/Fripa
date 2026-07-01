import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { LuStar, LuShoppingBag, LuRotateCcw } from 'react-icons/lu';
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

      {/* Single-page app: no nav needed — all space goes to the deck. */}
      <div className="header-actions">
        <LanguageSwitcher />
        <button className="ghost-btn" onClick={onReset} title={t('a11y.reset')} aria-label={t('a11y.reset')}>
          <LuRotateCcw aria-hidden="true" />
        </button>
        <button className="cart-btn" onClick={onFavorites} aria-label={t('a11y.favorites')}>
          <LuStar aria-hidden="true" />
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
          <LuShoppingBag aria-hidden="true" />
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
