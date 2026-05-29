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
      <div className="logo">
        <span className="logo__mark">FR</span>
        <div>
          <h1>Fripa</h1>
          <p>Le swipe du fripier · 🇹🇳</p>
        </div>
      </div>
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
