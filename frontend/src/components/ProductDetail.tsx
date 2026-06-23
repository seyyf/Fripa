import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ItemDetail, TShirt } from '../types';
import { useT } from '../i18n/LanguageContext';
import { ProductDetailContent } from './ProductDetailContent';
import { SimilarPieces } from './SimilarPieces';

interface Props {
  onAddToCart: (item: TShirt) => void | Promise<void>;
  onFavorite: (item: TShirt) => void | Promise<void>;
}

export function ProductDetail({ onAddToCart, onFavorite }: Props) {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  const load = useCallback(async () => {
    if (!id) return;
    setState('loading');
    try {
      const d = await api.item(id);
      setDetail(d);
      setState('ready');
    } catch {
      setState('notfound');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(item: TShirt) {
    await onAddToCart(item);
    void load();
  }

  async function fav(item: TShirt) {
    await onFavorite(item);
    void load();
  }

  if (state === 'loading') {
    return (
      <main className="pd">
        <p className="loader">{t('pd.loading')}</p>
      </main>
    );
  }

  if (state === 'notfound' || !detail) {
    return (
      <main className="pd pd--empty">
        <div className="empty__emoji">🤷</div>
        <h1>{t('pd.notFoundTitle')}</h1>
        <p>{t('pd.notFoundText')}</p>
        <Link to="/catalogue" className="btn btn--add btn--wide">
          {t('pd.backCatalogueFull')}
        </Link>
      </main>
    );
  }

  return (
    <main className="pd">
      <Link to="/catalogue" className="pd__back">
        {t('pd.backCatalogue')}
      </Link>
      <ProductDetailContent
        item={detail.item}
        status={detail.status}
        reservedUntil={detail.reservedUntil}
        onAddToCart={add}
        onFavorite={fav}
      />
      <SimilarPieces itemId={detail.item.id} refreshKey={detail.status} />
    </main>
  );
}
