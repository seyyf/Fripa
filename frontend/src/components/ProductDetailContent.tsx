import type { ItemStatus, TShirt } from '../types';

interface Props {
  item: TShirt;
  status: ItemStatus;
  onAddToCart: (item: TShirt) => void;
  onFavorite: (item: TShirt) => void;
}

// Presentational detail layout, shared by the standalone /piece/:id page and
// the catalogue quick-look modal.
export function ProductDetailContent({ item, status, onAddToCart, onFavorite }: Props) {
  return (
    <div className="pd__layout">
      <div className="pd__media">
        <img className="pd__img" src={item.imageUrl} alt={item.title} />
      </div>

      <div className="pd__info">
        <div className="pd__title-row">
          <h1 className="pd__title">{item.title}</h1>
          <span className="pd__brand">{item.brand}</span>
        </div>
        <div className="pd__price">{item.price} TND</div>

        <div className="pd__chips">
          <span className="chip">Taille {item.size}</span>
          <span className="chip">{item.condition}</span>
          <span className="chip">{item.color}</span>
        </div>

        <p className="pd__desc">{item.description}</p>
        <p className="pd__seller">📍 {item.seller}</p>

        {status === 'gone' ? (
          <div className="pd__gone">
            Cette pièce est partie. 👋 Quelqu'un d'autre l'a chinée avant toi.
          </div>
        ) : (
          <>
            {status === 'inCart' && <p className="pd__note">✓ Déjà dans ton panier.</p>}
            {status === 'inFavorites' && <p className="pd__note">⭐ Déjà dans tes favoris.</p>}
            <div className="pd__actions">
              <button
                type="button"
                className="btn btn--add btn--full"
                onClick={() => onAddToCart(item)}
              >
                🛒 Ajouter au panier
              </button>
              <button
                type="button"
                className="btn btn--pass"
                onClick={() => onFavorite(item)}
                aria-label="Mettre en favori"
              >
                ⭐
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
