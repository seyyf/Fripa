import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';

interface Props {
  cartCount: number;
  favCount: number;
  onCart: () => void;
  onFavorites: () => void;
  onReset: () => void;
}

export function Header({ cartCount, favCount, onCart, onFavorites, onReset }: Props) {
  const reduce = useReducedMotion();
  const { user, openLogin } = useAccount();
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
          <p>Le swipe du fripier · 🇹🇳</p>
        </div>
      </NavLink>

      <nav className="app-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          Accueil
        </NavLink>
        <NavLink
          to="/shop"
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          Boutique
        </NavLink>
        <NavLink
          to="/catalogue"
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        >
          Catalogue
        </NavLink>
      </nav>

      <div className="header-actions">
        <button className="ghost-btn" onClick={onReset} title="Recommencer la session">
          ↻
        </button>
        {user ? (
          <Link to="/compte" className="cart-btn" aria-label="Mon compte" title="Mon compte">
            👤
          </Link>
        ) : (
          <button className="cart-btn" onClick={openLogin} aria-label="Se connecter" title="Se connecter">
            👤
          </button>
        )}
        <button className="cart-btn" onClick={onFavorites} aria-label="Mes favoris">
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
        <button className="cart-btn" onClick={onCart} aria-label="Mon panier">
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
