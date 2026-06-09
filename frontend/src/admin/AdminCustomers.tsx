import { useEffect, useMemo, useState } from 'react';
import { adminApi, AdminAuthError, type AdminCustomer } from './adminApi';
import { downloadCsv } from './csv';

interface Props {
  onAuthError: () => void;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export function AdminCustomers({ onAuthError }: Props) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi
      .listCustomers()
      .then((d) => alive && setCustomers(d))
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <section className="admin-items">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Clients</h1>
          <p className="admin-items__count">{customers.length} client{customers.length > 1 ? 's' : ''}</p>
        </div>
        {customers.length > 0 && (
          <button
            className="admin-btn"
            onClick={() =>
              downloadCsv(
                'fripa-clients.csv',
                ['nom', 'telephone', 'email', 'adresse', 'commandes', 'total', 'derniere'],
                customers.map((c) => [c.name, c.phone, c.email, c.address, c.orders, c.total, new Date(c.lastOrderAt).toISOString()]),
              )
            }
          >
            ⤓ CSV
          </button>
        )}
      </div>

      {customers.length > 0 && (
        <div className="admin-items__filters">
          <input
            className="filter-input admin-items__search"
            placeholder="Rechercher (nom, téléphone, email…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      {loading ? (
        <p className="muted admin-items__empty">Chargement…</p>
      ) : customers.length === 0 ? (
        <p className="muted admin-items__empty">Aucun client pour l’instant.</p>
      ) : shown.length === 0 ? (
        <p className="muted admin-items__empty">Aucun client ne correspond.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Commandes</th>
                <th>Total dépensé</th>
                <th>Dernière</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.phone + c.email}>
                  <td>
                    <strong className="admin-cell-title">{c.name}</strong>
                    <span className="admin-cell-sub">{c.address}</span>
                  </td>
                  <td>
                    <span className="admin-cell-title">{c.phone}</span>
                    <span className="admin-cell-sub">{c.email}</span>
                  </td>
                  <td>
                    {c.orders}
                    {c.orders > 1 && <span className="admin-repeat-badge">fidèle</span>}
                  </td>
                  <td className="admin-price">{c.total} TND</td>
                  <td>{dateFmt.format(new Date(c.lastOrderAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
