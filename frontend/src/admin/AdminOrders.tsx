import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type AdminOrder } from './adminApi';

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

  return (
    <section className="admin-orders">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Commandes</h1>
          <p className="admin-items__count">
            {orders.length} commande{orders.length > 1 ? 's' : ''} · {revenue} TND de ventes
          </p>
        </div>
      </div>

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      {loading ? (
        <p className="muted admin-items__empty">Chargement…</p>
      ) : orders.length === 0 ? (
        <p className="muted admin-items__empty">Aucune commande pour l’instant.</p>
      ) : (
        <div className="admin-orders__list">
          {orders.map((o) => (
            <article key={o.id} className="admin-order">
              <header className="admin-order__head">
                <div>
                  <strong className="admin-order__ref">{o.ref}</strong>
                  <span className="admin-order__date">{dateFmt.format(new Date(o.createdAt))}</span>
                </div>
                <span className="admin-order__total">{o.total} TND</span>
              </header>

              <div className="admin-order__customer">
                <span>
                  <strong>{o.customerName}</strong> · {o.customerPhone}
                </span>
                <span className="admin-cell-sub">
                  {o.customerEmail} — {o.customerAddress}
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
    </section>
  );
}
