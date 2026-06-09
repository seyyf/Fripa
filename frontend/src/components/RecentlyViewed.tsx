import { Link } from 'react-router-dom';
import { getRecent } from '../util/recentlyViewed';

const onSale = (p: { price: number; salePrice?: number | null }) =>
  p.salePrice != null && p.salePrice < p.price;

// Horizontal rail of pieces the shopper recently opened. Hidden when empty.
// `excludeId` drops the current piece (e.g. on its own detail page).
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const items = getRecent().filter((r) => r.id !== excludeId);
  if (items.length === 0) return null;

  return (
    <section className="recent" aria-label="Vus récemment">
      <h2 className="recent__title">Vus récemment</h2>
      <div className="recent__rail">
        {items.map((r) => (
          <Link key={r.id} to={`/piece/${r.id}`} className="recent__card">
            <span className="recent__img" style={{ backgroundImage: `url(${r.imageUrl})` }} />
            <span className="recent__name">{r.title}</span>
            <span className="recent__price">
              {onSale(r) && <span className="price-old">{r.price}</span>}
              {onSale(r) ? r.salePrice : r.price} TND
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
