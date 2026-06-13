import { useEffect, useState } from 'react';
import type { ItemStatus, TShirt } from '../types';
import { effectivePrice, isOnSale } from '../types';
import { useT } from '../i18n/LanguageContext';
import { shareItem } from '../util/share';
import { addRecent } from '../util/recentlyViewed';

interface Props {
  item: TShirt;
  status: ItemStatus;
  onAddToCart: (item: TShirt) => void;
  onFavorite: (item: TShirt) => void;
}

// Presentational detail layout, shared by the standalone /piece/:id page and
// the catalogue quick-look modal.
export function ProductDetailContent({ item, status, onAddToCart, onFavorite }: Props) {
  const { t } = useT();
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [zoom, setZoom] = useState(false);
  const gallery = [item.imageUrl, ...(item.images ?? [])];

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
        <p className="pd__seller">📍 {item.seller}</p>

        {status === 'gone' ? (
          <div className="pd__gone">{t('pd.gone')}</div>
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
        <div className="lightbox" onClick={() => setZoom(false)}>
          <button className="lightbox__close" aria-label={t('common.close')}>✕</button>
          {gallery.length > 1 && (
            <button
              className="lightbox__nav lightbox__nav--prev"
              aria-label={t('pd.prev')}
              onClick={(e) => {
                e.stopPropagation();
                setSel((s) => (s - 1 + gallery.length) % gallery.length);
              }}
            >
              ‹
            </button>
          )}
          <img
            className="lightbox__img"
            src={gallery[sel] ?? item.imageUrl}
            alt={item.title}
            onClick={(e) => e.stopPropagation()}
          />
          {gallery.length > 1 && (
            <button
              className="lightbox__nav lightbox__nav--next"
              aria-label={t('pd.next')}
              onClick={(e) => {
                e.stopPropagation();
                setSel((s) => (s + 1) % gallery.length);
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
