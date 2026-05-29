import { NavLink } from 'react-router-dom';

interface Props {
  cartCount: number;
  favCount: number;
  onCart: () => void;
  onFavorites: () => void;
  onReset: () => void;
}

export function Header({ cartCount, favCount, onCart, onFavorites, onReset }: Props) {
  return (
    <header className="app-header">
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
      </nav>

      <div className="header-actions">
        <button className="ghost-btn" onClick={onReset} title="Recommencer la session">
          ↻
        </button>
        <button className="cart-btn" onClick={onFavorites} aria-label="Mes favoris">
          ⭐
          {favCount > 0 && <span className="cart-btn__badge cart-btn__badge--fav">{favCount}</span>}
        </button>
        <button className="cart-btn" onClick={onCart} aria-label="Mon panier">
          🛒
          {cartCount > 0 && <span className="cart-btn__badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}
