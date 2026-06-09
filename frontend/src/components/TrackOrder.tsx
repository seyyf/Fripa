import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { TrackedOrder as Tracked } from '../types';

const STEPS = ['Nouvelle', 'Confirmée', 'Expédiée', 'Livrée'];
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export function TrackOrder() {
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
      setError('Commande introuvable. Vérifie la référence et le numéro de téléphone.');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = order ? STEPS.indexOf(order.status) : -1;
  const special = order && (order.status === 'Retournée' || order.status === 'Annulée');

  return (
    <main className="track">
      <Link to="/" className="pd__back">← Accueil</Link>
      <h1 className="track__title">Suivre ma commande</h1>
      <p className="muted">Entre ta référence (ex. FR-1001) et le téléphone de la commande.</p>

      <form className="track__form" onSubmit={submit}>
        <input
          className="filter-input"
          placeholder="Référence (FR-…)"
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
        />
        <input
          className="filter-input"
          placeholder="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button className="btn btn--add" disabled={busy || !ref.trim() || !phone.trim()}>
          {busy ? '…' : 'Suivre'}
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
              {order.total} TND{order.paid ? ' · payée' : ''}
            </span>
          </div>

          {special ? (
            <div className={`track__special track__special--${order.status === 'Annulée' ? 'cancel' : 'return'}`}>
              Statut : <strong>{order.status}</strong>
            </div>
          ) : (
            <ol className="track__steps">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`track__step ${i <= stepIndex ? 'is-done' : ''} ${i === stepIndex ? 'is-current' : ''}`}
                >
                  <span className="track__dot" />
                  <span>{s}</span>
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
          <p className="muted">Paiement à la livraison — on te contacte au besoin. Merci {order.customerName} !</p>
        </div>
      )}
    </main>
  );
}
