import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, ORDER_STATUSES, type AdminStats } from './adminApi';

interface Props {
  onAuthError: () => void;
}

const statusKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function AdminOverview({ onAuthError }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminApi
      .stats()
      .then((s) => alive && setStats(s))
      .catch((err) => {
        if (err instanceof AdminAuthError) onAuthError();
        else if (alive) setError(err instanceof Error ? err.message : 'Erreur de chargement.');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="checkout__error admin-items__error">{error}</div>;
  if (!stats) return <p className="muted admin-items__empty">Chargement…</p>;

  const maxCat = Math.max(1, ...stats.topCategories.map((c) => c.count));

  const cards = [
    { label: 'Pièces actives', value: stats.items.active ?? 0, sub: `${stats.items.total} au total` },
    { label: 'Commandes', value: stats.orders.total, sub: `${stats.orders.today} aujourd’hui` },
    {
      label: 'Ventes (total)',
      value: `${stats.orders.revenue} TND`,
      sub: `${stats.orders.revenueToday} TND aujourd’hui`,
    },
    {
      label: 'Livrées',
      value: `${stats.delivered.revenue} TND`,
      sub: `${stats.delivered.count} commande${stats.delivered.count > 1 ? 's' : ''} livrée${stats.delivered.count > 1 ? 's' : ''}`,
      accent: true,
    },
    {
      label: 'Encaissé',
      value: `${stats.collected.revenue} TND`,
      sub: `${stats.collected.count} commande${stats.collected.count > 1 ? 's' : ''} payée${stats.collected.count > 1 ? 's' : ''}`,
      accent: true,
    },
    { label: 'Vendues', value: stats.items.sold ?? 0, sub: `${stats.items.draft ?? 0} brouillons` },
  ];

  return (
    <section className="admin-overview">
      <h1 className="admin-items__title">Tableau de bord</h1>

      <div className="admin-kpis">
        {cards.map((c) => (
          <div key={c.label} className={`admin-kpi ${c.accent ? 'admin-kpi--accent' : ''}`}>
            <span className="admin-kpi__value">{c.value}</span>
            <span className="admin-kpi__label">{c.label}</span>
            <span className="admin-kpi__sub">{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="admin-overview__cols">
        <div className="admin-panel">
          <h2 className="admin-panel__title">Commandes par statut</h2>
          <ul className="admin-status-list">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                <span className={`admin-status admin-order-status--${statusKey(s)}`}>{s}</span>
                <strong>{stats.ordersByStatus[s] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel__title">Stock actif par catégorie</h2>
          {stats.topCategories.length === 0 ? (
            <p className="muted">Aucune pièce active.</p>
          ) : (
            <ul className="admin-bars">
              {stats.topCategories.map((c) => (
                <li key={c.category} className="admin-bar">
                  <span className="admin-bar__label">{c.category}</span>
                  <span className="admin-bar__track">
                    <span
                      className="admin-bar__fill"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </span>
                  <span className="admin-bar__count">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
