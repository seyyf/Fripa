import { useEffect, useState } from 'react';
import type { ItemStatus, TShirt } from '../types';
import { effectivePrice, isOnSale } from '../types';
import { useT } from '../i18n/LanguageContext';
import { formatHold } from '../cart/holdTimer';
import { shareItem } from '../util/share';
import { addRecent } from '../util/recentlyViewed';
import { Lightbox } from './Lightbox';

interface Props {
  item: TShirt;
  status: ItemStatus;
  // Set when status === 'reserved': ms epoch when the other shopper's hold lapses.
  reservedUntil?: number;
  onAddToCart: (item: TShirt) => void;
  onFavorite: (item: TShirt) => void;
}

// Presentational detail layout, shared by the standalone /piece/:id page and
// the catalogue quick-look modal.
export function ProductDetailContent({ item, status, reservedUntil, onAddToCart, onFavorite }: Props) {
  const { t } = useT();
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const gallery = [item.imageUrl, ...(item.images ?? [])];

  // Held by another shopper → show a live countdown until it returns.
  const reserved = status === 'reserved' && typeof reservedUntil === 'number' && reservedUntil > now;
  useEffect(() => {
    if (!reserved) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [reserved]);

  useEffect(() => {
    addRecent(item);
    setSel(0);
  }, [item]);

  async function onShare() {
    const res = await shareItem(item);
    if (res === 'copied') setShareMsg(t('pd.linkCopied'));
    else if (res === 'failed') setShareMsg(t('pd.shareFailed'));
    if (res !== 'shared') setTimeout(() => setShareMsg(null), 2000);
  }

  return (
    <div className="pd__layout">
      <div className="pd__media">
        <button type="button" className="pd__img-btn" onClick={() => setZoom(true)} aria-label={t('pd.enlarge')}>
          <img
            className="pd__img"
            src={gallery[sel] ?? item.imageUrl}
            alt={item.title}
            decoding="async"
          />
          <span className="pd__zoom-hint" aria-hidden="true">⤢</span>
        </button>
        {gallery.length > 1 && (
          <div className="pd__thumbs">
            {gallery.map((src, i) => (
              <button
                key={i}
                type="button"
                className={`pd__thumb ${i === sel ? 'is-active' : ''}`}
                style={{ backgroundImage: `url(${src})` }}
                onClick={() => setSel(i)}
                aria-label={t('pd.photoN', { n: i + 1 })}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pd__info">
        <div className="pd__title-row">
          <h1 className="pd__title">{item.title}</h1>
          <span className="pd__brand">{item.brand}</span>
          <button type="button" className="pd__share" onClick={onShare} aria-label={t('pd.shareAria')}>
            ↗ {shareMsg ?? t('pd.share')}
          </button>
        </div>
        <div className="pd__price">
          {isOnSale(item) && <span className="price-old">{item.price} TND</span>}
          {effectivePrice(item)} TND
          {isOnSale(item) && <span className="sale-badge">Soldes</span>}
        </div>

        <div className="pd__chips">
          <span className="chip">{t('pd.size', { size: item.size })}</span>
          <span className="chip">{item.condition}</span>
          <span className="chip">{item.color}</span>
        </div>

        <p className="pd__desc">{item.description}</p>

        {status === 'gone' ? (
          <div className="pd__gone">{t('pd.gone')}</div>
        ) : reserved ? (
          <div className="pd-reserved-block">
            <div className="pd-reserved">
              🔒 {t('pd.reserved')} · {t('pd.reservedReturnsIn', { time: formatHold(reservedUntil! - now) })}
            </div>
            <button
              type="button"
              className="btn btn--add btn--full"
              onClick={() => onFavorite(item)}
            >
              ⭐ {t('pd.saveForLater')}
            </button>
          </div>
        ) : (
          <>
            {status === 'inCart' && <p className="pd__note">{t('pd.inCart')}</p>}
            {status === 'inFavorites' && <p className="pd__note">{t('pd.inFav')}</p>}
            <div className="pd__actions">
              <button
                type="button"
                className="btn btn--add btn--full"
                onClick={() => onAddToCart(item)}
              >
                {t('pd.addToCart')}
              </button>
              <button
                type="button"
                className="btn btn--pass"
                onClick={() => onFavorite(item)}
                aria-label={t('pd.favAria')}
              >
                ⭐
              </button>
            </div>
          </>
        )}
      </div>

      {zoom && (
        <Lightbox
          images={gallery}
          alt={item.title}
          initialIndex={sel}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}
