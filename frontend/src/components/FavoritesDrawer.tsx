import type { FavoritesResponse } from '../types';
import { useT } from '../i18n/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  favorites: FavoritesResponse;
  onMoveToCart: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}

export function FavoritesDrawer({ open, onClose, favorites, onMoveToCart, onRemove }: Props) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div className="drawer-backdrop drawer-backdrop--side" onClick={onClose}>
      <aside className="drawer drawer--side" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>{t('fav.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </header>

        {favorites.lines.length === 0 ? (
          <div className="drawer__empty">
            <p>{t('fav.empty')}</p>
            <p className="muted">{t('fav.emptyHint')}</p>
          </div>
        ) : (
          <ul className="cart-list">
            {favorites.lines.map((line) => {
              // Held by another shopper right now → lock the move-to-cart action.
              const reserved =
                typeof line.reservedUntil === 'number' && line.reservedUntil > Date.now();
              return (
                <li key={line.id} className="cart-line">
                  <img src={line.imageUrl} alt={line.title} />
                  <div className="cart-line__info">
                    <strong>{line.title}</strong>
                    <span className="muted">{line.size} · {line.condition}</span>
                    <span className="cart-line__price">{line.price} TND</span>
                  </div>
                  <div className="cart-line__fav-actions">
                    {reserved ? (
                      <span className="fav-reserved">🔒 {t('fav.reserved')}</span>
                    ) : (
                      <button
                        className="btn btn--add btn--sm"
                        onClick={() => onMoveToCart(line.id)}
                      >
                        {t('fav.toCart')}
                      </button>
                    )}
                    <button
                      className="icon-btn"
                      onClick={() => onRemove(line.id)}
                      aria-label={t('fav.removeAria')}
                    >
                      🗑
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
