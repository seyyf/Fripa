import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { TShirt } from '../types';
import { effectivePrice, isOnSale } from '../types';

interface Props {
  itemId: string;
  // Re-fetch when the piece changes (e.g. navigating between detail pages).
  refreshKey?: unknown;
}

// "Pièces similaires" rail — keeps the shopper moving when a piece is gone, and
// surfaces alternatives otherwise. Renders nothing when there are no matches.
export function SimilarPieces({ itemId, refreshKey }: Props) {
  const [items, setItems] = useState<TShirt[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .similar(itemId, 4)
      .then((res) => alive && setItems(res))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [itemId, refreshKey]);

  if (items.length === 0) return null;

  return (
    <section className="similar">
      <h2 className="similar__title">Pièces similaires</h2>
      <div className="preview-grid">
        {items.map((it) => (
          <Link key={it.id} to={`/piece/${it.id}`} className="preview-card">
            <span
              className="preview-card__img"
              style={{ backgroundImage: `url(${it.imageUrl})` }}
              role="img"
              aria-label={it.title}
            />
            <span className="preview-card__title">{it.title}</span>
            <span className="preview-card__price">
              {isOnSale(it) && <span className="price-old">{it.price}</span>}
              {effectivePrice(it)} TND
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
