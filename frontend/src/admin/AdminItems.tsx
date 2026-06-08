import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AdminAuthError,
  STATUSES,
  type AdminItem,
  type ItemInput,
} from './adminApi';
import { ItemForm } from './ItemForm';

interface Props {
  onAuthError: () => void;
}

type Editing = { mode: 'create' } | { mode: 'edit'; item: AdminItem } | null;

const PER_PAGE = 10;

export function AdminItems({ onAuthError }: Props) {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  function handleError(err: unknown) {
    if (err instanceof AdminAuthError) {
      onAuthError();
      return;
    }
    setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
  }

  async function refresh() {
    setLoading(true);
    try {
      setItems(await adminApi.listItems());
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (!q) return true;
      return `${i.title} ${i.brand} ${i.category} ${i.color}`.toLowerCase().includes(q);
    });
  }, [items, query, statusFilter]);

  // Back to the first page whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount); // clamp (e.g. after deletions)
  const start = (currentPage - 1) * PER_PAGE;
  const paged = shown.slice(start, start + PER_PAGE);

  async function save(input: ItemInput) {
    if (editing?.mode === 'edit') {
      await adminApi.updateItem(editing.item.id, input);
    } else {
      await adminApi.createItem(input);
    }
    setEditing(null);
    await refresh();
  }

  async function changeStatus(item: AdminItem, status: string) {
    try {
      await adminApi.updateItem(item.id, { status });
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  async function remove(item: AdminItem) {
    if (!window.confirm(`Supprimer « ${item.title} » ? Cette action est définitive.`)) return;
    try {
      await adminApi.deleteItem(item.id);
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STATUSES) c[s] = items.filter((i) => i.status === s).length;
    return c;
  }, [items]);

  return (
    <section className="admin-items">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Pièces</h1>
          <p className="admin-items__count">
            {counts.active} actives · {items.length} au total
          </p>
        </div>
        <button className="btn btn--add" onClick={() => setEditing({ mode: 'create' })}>
          + Nouvelle pièce
        </button>
      </div>

      <div className="admin-items__filters">
        <input
          className="filter-input admin-items__search"
          placeholder="Rechercher (titre, marque, couleur…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="admin-items__tabs">
          {(['all', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              className={`admin-tab ${statusFilter === s ? 'admin-tab--on' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Toutes' : s} <span className="admin-tab__n">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      {loading ? (
        <p className="muted admin-items__empty">Chargement…</p>
      ) : shown.length === 0 ? (
        <p className="muted admin-items__empty">Aucune pièce ne correspond.</p>
      ) : (
        <>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>Pièce</th>
                <th>Taille</th>
                <th>Prix</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => (
                <tr key={item.id} className={item.status !== 'active' ? 'admin-row--dim' : ''}>
                  <td>
                    <span
                      className="admin-thumb"
                      style={{ backgroundImage: `url(${item.imageUrl})` }}
                    />
                  </td>
                  <td>
                    <strong className="admin-cell-title">{item.title}</strong>
                    <span className="admin-cell-sub">
                      {item.brand} · {item.color}
                    </span>
                  </td>
                  <td>{item.size}</td>
                  <td className="admin-price">{item.price} TND</td>
                  <td>{item.category}</td>
                  <td>
                    <select
                      className={`admin-status admin-status--${item.status}`}
                      value={item.status}
                      onChange={(e) => changeStatus(item, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="admin-actions">
                    <button className="admin-btn" onClick={() => setEditing({ mode: 'edit', item })}>
                      Modifier
                    </button>
                    <button className="admin-btn admin-btn--danger" onClick={() => remove(item)}>
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <nav className="admin-pagination" aria-label="Pagination">
          <span className="admin-pagination__info">
            {start + 1}–{Math.min(start + PER_PAGE, shown.length)} sur {shown.length}
          </span>
          <div className="admin-pagination__controls">
            <button
              className="admin-btn"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ← Précédent
            </button>
            <span className="admin-pagination__page">
              Page {currentPage} / {pageCount}
            </span>
            <button
              className="admin-btn"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
            >
              Suivant →
            </button>
          </div>
        </nav>
        </>
      )}

      {editing && (
        <ItemForm
          initial={editing.mode === 'edit' ? editing.item : null}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  );
}
