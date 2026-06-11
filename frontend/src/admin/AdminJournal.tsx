import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type AuditEntry } from './adminApi';

interface Props {
  onAuthError: () => void;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Short, human label per action key.
const LABELS: Record<string, string> = {
  'item.create': 'Pièce créée',
  'item.update': 'Pièce modifiée',
  'item.delete': 'Pièce supprimée',
  'item.bulk': 'Action groupée',
  'items.markdown': 'Solde dormant',
  'items.import': 'Import CSV',
  'order.update': 'Commande modifiée',
  'order.return': 'Retour / restock',
  'promo.create': 'Promo créée',
  'promo.update': 'Promo modifiée',
  'promo.delete': 'Promo supprimée',
  'settings.update': 'Réglages modifiés',
};
// Colour family per action prefix (reuses the order-status pill palette).
const tone = (action: string) =>
  action.startsWith('item')
    ? 'nouvelle'
    : action.startsWith('order')
      ? 'expediee'
      : action.startsWith('promo')
        ? 'confirmee'
        : 'livree';

export function AdminJournal({ onAuthError }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminApi
      .audit(200)
      .then((e) => alive && setEntries(e))
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
  if (!entries) return <p className="muted admin-items__empty">Chargement…</p>;

  return (
    <section className="admin-journal">
      <h1 className="admin-items__title">Journal</h1>
      <p className="admin-items__count">Les {entries.length} dernières actions de gestion</p>

      {entries.length === 0 ? (
        <p className="muted admin-items__empty">Aucune action enregistrée pour l'instant.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Action</th>
                <th>Sujet</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="admin-cell-sub">{dateFmt.format(new Date(e.createdAt))}</td>
                  <td>
                    <span className={`admin-status admin-order-status--${tone(e.action)}`}>
                      {LABELS[e.action] ?? e.action}
                    </span>
                  </td>
                  <td>{e.target ?? '—'}</td>
                  <td className="admin-cell-sub">{e.detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
