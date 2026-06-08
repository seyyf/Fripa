import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ItemDetail, TShirt } from '../types';
import { ProductDetailContent } from './ProductDetailContent';

interface Props {
  onAddToCart: (item: TShirt) => void | Promise<void>;
  onFavorite: (item: TShirt) => void | Promise<void>;
}

export function ProductDetail({ onAddToCart, onFavorite }: Props) {
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
        <p className="loader">Chargement de la pièce…</p>
      </main>
    );
  }

  if (state === 'notfound' || !detail) {
    return (
      <main className="pd pd--empty">
        <div className="empty__emoji">🤷</div>
        <h1>Pièce introuvable</h1>
        <p>Cette pièce n'existe pas (ou plus).</p>
        <Link to="/catalogue" className="btn btn--add btn--wide">
          ← Retour au catalogue
        </Link>
      </main>
    );
  }

  return (
    <main className="pd">
      <Link to="/catalogue" className="pd__back">
        ← Catalogue
      </Link>
      <ProductDetailContent
        item={detail.item}
        status={detail.status}
        onAddToCart={add}
        onFavorite={fav}
      />
    </main>
  );
}
