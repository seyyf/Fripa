import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type AdminInsights, type ItemSwipeStats } from './adminApi';

interface Props {
  onAuthError: () => void;
}

// Swipe analytics (what shoppers keep vs. flick away — what to restock) and
// abandoned interest (carted-then-expired / favorited but unsold pieces —
// what to mark down).
export function AdminInsightsPage({ onAuthError }: Props) {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleError(err: unknown) {
    if (err instanceof AdminAuthError) onAuthError();
    else setError(err instanceof Error ? err.message : 'Erreur de chargement.');
  }

  async function refresh() {
    try {
      setData(await adminApi.insights());
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same suggested markdown as the items page: −20%, rounded.
  async function discount(item: ItemSwipeStats) {
    setBusyId(item.id);
    try {
      await adminApi.updateItem(item.id, { salePrice: Math.max(1, Math.round(item.price * 0.8)) });
      await refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) return <div className="checkout__error admin-items__error">{error}</div>;
  if (!data) return <p className="muted admin-items__empty">Chargement…</p>;

  const { totals, categories, topPassed, topWanted, abandoned, sellThrough, medianDaysToSell } = data;
  const maxSell = Math.max(1, ...sellThrough.map((c) => c.rate));
  const swipes = totals.pass + totals.keep + totals.favorite;
  const keepRate = swipes === 0 ? 0 : Math.round(((totals.keep + totals.favorite) / swipes) * 100);
  const conversion = totals.keep === 0 ? 0 : Math.round((totals.purchases / totals.keep) * 100);
  const maxRate = Math.max(1, ...categories.map((c) => c.keepRate));

  const cards = [
    { label: 'Swipes enregistrés', value: swipes, sub: `${totals.pass} passés` },
    { label: 'Taux de garde', value: `${keepRate}%`, sub: `${totals.keep} paniers · ${totals.favorite} favoris` },
    { label: 'Panier → achat', value: `${conversion}%`, sub: `${totals.purchases} pièce${totals.purchases > 1 ? 's' : ''} vendue${totals.purchases > 1 ? 's' : ''}`, accent: true },
    { label: 'Réservations expirées', value: totals.cartExpired, sub: 'paniers jamais confirmés' },
  ];

  const itemRow = (s: ItemSwipeStats, metric: string) => (
    <li key={s.id} className="admin-order__line">
      <span className="admin-thumb admin-order__thumb" style={{ backgroundImage: `url(${s.imageUrl})` }} />
      <span className="admin-order__line-info">
        <strong>{s.title}</strong>
        <span className="admin-cell-sub">{s.brand} · {s.category}</span>
      </span>
      <span className="admin-insight-metric">{metric}</span>
    </li>
  );

  return (
    <section className="admin-insights">
      <h1 className="admin-items__title">Analyses</h1>
      <p className="admin-items__count">Ce que les swipes racontent sur ton stock</p>

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      <div className="admin-kpis">
        {cards.map((c) => (
          <div key={c.label} className={`admin-kpi ${'accent' in c && c.accent ? 'admin-kpi--accent' : ''}`}>
            <span className="admin-kpi__value">{c.value}</span>
            <span className="admin-kpi__label">{c.label}</span>
            <span className="admin-kpi__sub">{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">
          Sell-through par catégorie — ce qui part vraiment
          {medianDaysToSell != null && (
            <span className="admin-cell-sub"> · médiane {medianDaysToSell} j pour vendre</span>
          )}
        </h2>
        {sellThrough.length === 0 ? (
          <p className="muted">Pas encore de stock.</p>
        ) : (
          <ul className="admin-bars">
            {sellThrough.map((c) => (
              <li key={c.category} className="admin-bar">
                <span className="admin-bar__label">{c.category}</span>
                <span className="admin-bar__track">
                  <span className="admin-bar__fill" style={{ width: `${(c.rate / maxSell) * 100}%` }} />
                </span>
                <span className="admin-bar__count">
                  {c.rate}%{' '}
                  <span className="admin-cell-sub">
                    ({c.sold} vendue{c.sold > 1 ? 's' : ''}/{c.sold + c.listed}
                    {c.medianDaysToSell != null ? ` · ${c.medianDaysToSell}j` : ''})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">Taux de garde par catégorie — quoi racheter au souk</h2>
        {categories.length === 0 ? (
          <p className="muted">Pas encore de swipes enregistrés — reviens après quelques visites.</p>
        ) : (
          <ul className="admin-bars">
            {categories.map((c) => (
              <li key={c.category} className="admin-bar">
                <span className="admin-bar__label">{c.category}</span>
                <span className="admin-bar__track">
                  <span className="admin-bar__fill" style={{ width: `${(c.keepRate / maxRate) * 100}%` }} />
                </span>
                <span className="admin-bar__count">
                  {c.keepRate}% <span className="admin-cell-sub">({c.keeps + c.favorites}/{c.passes + c.keeps + c.favorites})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-overview__cols">
        <div className="admin-panel">
          <h2 className="admin-panel__title">😍 Les plus voulues (panier + favoris)</h2>
          {topWanted.length === 0 ? (
            <p className="muted">Rien pour l'instant.</p>
          ) : (
            <ul className="admin-order__lines">
              {topWanted.map((s) => itemRow(s, `${s.keeps + s.favorites} ❤`))}
            </ul>
          )}
        </div>
        <div className="admin-panel">
          <h2 className="admin-panel__title">🙅 Les plus passées — photo ou prix à revoir ?</h2>
          {topPassed.length === 0 ? (
            <p className="muted">Rien pour l'instant.</p>
          ) : (
            <ul className="admin-order__lines">
              {topPassed.map((s) => itemRow(s, `${s.passes} ✕`))}
            </ul>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">
          ⏳ Intérêt abandonné — réservées ou mises en favori, jamais achetées
        </h2>
        {abandoned.length === 0 ? (
          <p className="muted">Aucune pièce abandonnée — tout part ou rien n'accroche.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Pièce</th>
                  <th>Prix</th>
                  <th>⏳ Expirées</th>
                  <th>⭐ Favoris</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {abandoned.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="admin-thumb" style={{ backgroundImage: `url(${s.imageUrl})` }} />
                    </td>
                    <td>
                      <strong className="admin-cell-title">{s.title}</strong>
                      <span className="admin-cell-sub">{s.brand} · {s.category}</span>
                    </td>
                    <td className="admin-price">
                      {s.salePrice != null && s.salePrice < s.price ? (
                        <>
                          <span className="admin-price__old">{s.price}</span>{' '}
                          <span className="admin-price__sale">{s.salePrice} TND</span>
                        </>
                      ) : (
                        `${s.price} TND`
                      )}
                    </td>
                    <td>{s.cartExpired}</td>
                    <td>{s.favorites}</td>
                    <td className="admin-actions">
                      {s.salePrice == null && (
                        <button
                          className="admin-btn admin-btn--sale"
                          disabled={busyId === s.id}
                          onClick={() => discount(s)}
                          title="Solder −20% — les favoris verront la baisse de prix"
                        >
                          −20%
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
