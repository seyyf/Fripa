import type { FavoritesResponse } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  favorites: FavoritesResponse;
  onMoveToCart: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}

export function FavoritesDrawer({ open, onClose, favorites, onMoveToCart, onRemove }: Props) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop drawer-backdrop--side" onClick={onClose}>
      <aside className="drawer drawer--side" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>Mes favoris</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        {favorites.lines.length === 0 ? (
          <div className="drawer__empty">
            <p>Aucun favori pour l'instant.</p>
            <p className="muted">Swipe une pièce vers le haut ⭐ pour la garder pour plus tard.</p>
          </div>
        ) : (
          <ul className="cart-list">
            {favorites.lines.map((line) => (
              <li key={line.id} className="cart-line">
                <img src={line.imageUrl} alt={line.title} />
                <div className="cart-line__info">
                  <strong>{line.title}</strong>
                  <span className="muted">{line.size} · {line.condition}</span>
                  <span className="cart-line__price">{line.price} TND</span>
                </div>
                <div className="cart-line__fav-actions">
                  <button
                    className="btn btn--add btn--sm"
                    onClick={() => onMoveToCart(line.id)}
                  >
                    🛒 Au panier
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => onRemove(line.id)}
                    aria-label="Retirer des favoris"
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
