import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { TrackedOrder as Tracked } from '../types';
import { useT } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/translations';

const STEPS = ['Nouvelle', 'Confirmée', 'Expédiée', 'Livrée'] as const;
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export function TrackOrder() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setBusy(true);
    try {
      setOrder(await api.trackOrder(ref.trim(), phone.trim()));
    } catch {
      setError(t('track.notFound'));
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = order ? (STEPS as readonly string[]).indexOf(order.status) : -1;
  const special = order && (order.status === 'Retournée' || order.status === 'Annulée');

  return (
    <main className="track">
      <Link to="/" className="pd__back">{t('track.back')}</Link>
      <h1 className="track__title">{t('track.title')}</h1>
      <p className="muted">{t('track.intro')}</p>

      <form className="track__form" onSubmit={submit}>
        <input
          className="filter-input"
          placeholder={t('track.refPlaceholder')}
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
        />
        <input
          className="filter-input"
          placeholder={t('track.phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button className="btn btn--add" disabled={busy || !ref.trim() || !phone.trim()}>
          {busy ? '…' : t('track.submit')}
        </button>
      </form>

      {error && <div className="checkout__error">{error}</div>}

      {order && (
        <div className="track__result">
          <div className="track__head">
            <div>
              <strong className="track__ref">{order.ref}</strong>
              <span className="muted"> · {dateFmt.format(new Date(order.createdAt))}</span>
            </div>
            <span className="track__total">
              {order.total} TND{order.paid ? t('track.paid') : ''}
            </span>
          </div>

          {special ? (
            <div className={`track__special track__special--${order.status === 'Annulée' ? 'cancel' : 'return'}`}>
              {t('track.statusLabel')}<strong>{t(`status.${order.status}` as StringKey)}</strong>
            </div>
          ) : (
            <ol className="track__steps">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`track__step ${i <= stepIndex ? 'is-done' : ''} ${i === stepIndex ? 'is-current' : ''}`}
                >
                  <span className="track__dot" />
                  <span>{t(`status.${s}` as StringKey)}</span>
                </li>
              ))}
            </ol>
          )}

          <ul className="track__lines">
            {order.lines.map((l, i) => (
              <li key={i} className="track__line">
                <span className="track__thumb" style={{ backgroundImage: `url(${l.imageUrl})` }} />
                <span className="track__line-info">
                  <strong>{l.title}</strong>
                  <span className="muted">{l.brand} · {l.size}</span>
                </span>
                <span className="track__line-price">{l.price} TND</span>
              </li>
            ))}
          </ul>
          <p className="muted">{t('track.codThanks', { name: order.customerName })}</p>
        </div>
      )}
    </main>
  );
}
