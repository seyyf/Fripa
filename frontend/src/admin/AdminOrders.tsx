import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, ORDER_STATUSES, type AdminOrder } from './adminApi';
import { OrderDetail } from './OrderDetail';
import { downloadCsv } from './csv';

// Normalises accented status to a CSS-class-safe suffix (e.g. "Expédiée" → "expediee").
const statusKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  onAuthError: () => void;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function AdminOrders({ onAuthError }: Props) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminApi
      .listOrders()
      .then((data) => alive && setOrders(data))
      .catch((err) => {
        if (err instanceof AdminAuthError) onAuthError();
        else if (alive) setError(err instanceof Error ? err.message : 'Erreur de chargement.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  const shown = orders.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${o.ref} ${o.customerName} ${o.customerPhone} ${o.customerEmail}`
      .toLowerCase()
      .includes(q);
  });

  function applyUpdate(updated: AdminOrder) {
    setOrders((list) => list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  }

  async function changeStatus(order: AdminOrder, status: string) {
    const prev = order.status;
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o))); // optimistic
    try {
      await adminApi.updateOrder(order.id, { status });
    } catch (err) {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: prev } : o)));
      if (err instanceof AdminAuthError) onAuthError();
      else setError(err instanceof Error ? err.message : 'Échec de la mise à jour.');
    }
  }

  const detail = orders.find((o) => o.id === detailId) ?? null;

  return (
    <section className="admin-orders">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Commandes</h1>
          <p className="admin-items__count">
            {orders.length} commande{orders.length > 1 ? 's' : ''} · {revenue} TND de ventes
          </p>
        </div>
        {orders.length > 0 && (
          <div className="admin-items__head-actions">
          <button
            className="admin-btn"
            title="Commandes confirmées, prêtes à expédier — format livreur (COD)"
            onClick={() => {
              const toShip = orders.filter((o) => o.status === 'Confirmée');
              if (toShip.length === 0) {
                window.alert('Aucune commande « Confirmée » à expédier.');
                return;
              }
              downloadCsv(
                'fripa-livreur.csv',
                ['nom', 'telephone', 'gouvernorat', 'adresse', 'designation', 'nb_pieces', 'cod_tnd', 'reference', 'commentaire'],
                toShip.map((o) => [
                  o.customerName,
                  o.customerPhone,
                  o.governorate,
                  o.customerAddress,
                  o.lines.map((l) => `${l.title} (${l.size})`).join(' | '),
                  o.lines.length,
                  o.paid ? 0 : o.total,
                  o.ref,
                  o.paid ? 'déjà encaissée' : 'paiement à la livraison',
                ]),
              );
            }}
          >
            ⤓ Export livreur
          </button>
          <button
            className="admin-btn"
            onClick={() =>
              downloadCsv(
                'fripa-commandes.csv',
                ['ref', 'date', 'statut', 'encaissee', 'client', 'telephone', 'email', 'gouvernorat', 'adresse', 'livraison', 'total', 'pieces'],
                shown.map((o) => [
                  o.ref,
                  new Date(o.createdAt).toISOString(),
                  o.status,
                  o.paid ? 'oui' : 'non',
                  o.customerName,
                  o.customerPhone,
                  o.customerEmail,
                  o.governorate,
                  o.customerAddress,
                  o.deliveryFee,
                  o.total,
                  o.lines.map((l) => l.title).join(' | '),
                ]),
              )
            }
          >
            ⤓ CSV
          </button>
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="admin-items__filters">
          <input
            className="filter-input admin-items__search"
            placeholder="Rechercher (réf, client, téléphone…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      {loading ? (
        <p className="muted admin-items__empty">Chargement…</p>
      ) : orders.length === 0 ? (
        <p className="muted admin-items__empty">Aucune commande pour l’instant.</p>
      ) : shown.length === 0 ? (
        <p className="muted admin-items__empty">Aucune commande ne correspond.</p>
      ) : (
        <div className="admin-orders__list">
          {shown.map((o) => (
            <article key={o.id} className="admin-order">
              <header className="admin-order__head">
                <div>
                  <strong className="admin-order__ref">{o.ref}</strong>
                  <span className="admin-order__date">{dateFmt.format(new Date(o.createdAt))}</span>
                </div>
                <div className="admin-order__head-right">
                  {o.paid && <span className="admin-paid-badge">Encaissée</span>}
                  <select
                    className={`admin-status admin-order-status--${statusKey(o.status)}`}
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value)}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="admin-order__total">{o.total} TND</span>
                  <button className="admin-btn" onClick={() => setDetailId(o.id)}>
                    Détails
                  </button>
                </div>
              </header>

              <div className="admin-order__customer">
                <span>
                  <strong>{o.customerName}</strong> · {o.customerPhone}
                </span>
                <span className="admin-cell-sub">
                  {o.customerEmail} — {o.customerAddress}
                  {o.governorate ? `, ${o.governorate}` : ''}
                </span>
              </div>

              <ul className="admin-order__lines">
                {o.lines.map((l) => (
                  <li key={l.id} className="admin-order__line">
                    <span
                      className="admin-thumb admin-order__thumb"
                      style={{ backgroundImage: `url(${l.imageUrl})` }}
                    />
                    <span className="admin-order__line-info">
                      <strong>{l.title}</strong>
                      <span className="admin-cell-sub">
                        {l.brand} · {l.size}
                      </span>
                    </span>
                    <span className="admin-price">{l.price} TND</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetailId(null)}
          onChanged={applyUpdate}
          onAuthError={onAuthError}
        />
      )}
    </section>
  );
}
