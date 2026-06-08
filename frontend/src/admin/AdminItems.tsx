import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AdminAuthError,
  STATUSES,
  type AdminItem,
  type ItemInput,
} from './adminApi';
import { ItemForm } from './ItemForm';
import { downloadCsv } from './csv';

interface Props {
  onAuthError: () => void;
}

type Editing = { mode: 'create' } | { mode: 'edit'; item: AdminItem } | null;
type SortKey = 'title' | 'price' | 'category' | 'status';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const PER_PAGE = 10;

export function AdminItems({ onAuthError }: Props) {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort | null>(null);

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

  const sorted = useMemo(() => {
    if (!sort) return shown;
    const arr = [...shown];
    arr.sort((a, b) => {
      const cmp =
        sort.key === 'price'
          ? a.price - b.price
          : String(a[sort.key]).localeCompare(String(b[sort.key]), 'fr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [shown, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }
  const sortCaret = (key: SortKey) => (sort?.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  // Back to the first page whenever the filtered/sorted set changes.
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sort]);

  // Drop selected ids that no longer exist (after deletions/refresh).
  useEffect(() => {
    setSelected((s) => {
      const present = new Set(items.map((i) => i.id));
      const next = new Set([...s].filter((id) => present.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [items]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount); // clamp (e.g. after deletions)
  const start = (currentPage - 1) * PER_PAGE;
  const paged = sorted.slice(start, start + PER_PAGE);

  const pageIds = paged.map((i) => i.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }
  async function bulk(action: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === 'delete' && !window.confirm(`Supprimer ${ids.length} pièce(s) ? Définitif.`))
      return;
    try {
      await adminApi.bulkItems(ids, action);
      setSelected(new Set());
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

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
        <div className="admin-items__head-actions">
          <label className="admin-btn admin-upload-btn">
            ⤒ Importer
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const res = await adminApi.importItems(await file.text());
                  await refresh();
                  setError(
                    res.errors.length
                      ? `${res.created} importée(s) · ${res.errors.length} erreur(s) : ${res.errors.slice(0, 3).join(' ; ')}`
                      : null,
                  );
                  if (!res.errors.length) window.alert(`${res.created} pièce(s) importée(s).`);
                } catch (err) {
                  handleError(err);
                }
              }}
            />
          </label>
          <button
            className="admin-btn"
            onClick={() =>
              downloadCsv(
                'fripa-pieces.csv',
                ['id', 'title', 'description', 'imageUrl', 'price', 'salePrice', 'size', 'brand', 'condition', 'color', 'seller', 'category', 'status'],
                items.map((i) => [i.id, i.title, i.description, i.imageUrl, i.price, i.salePrice ?? '', i.size, i.brand, i.condition, i.color, i.seller, i.category, i.status]),
              )
            }
          >
            ⤓ CSV
          </button>
          <button className="btn btn--add" onClick={() => setEditing({ mode: 'create' })}>
            + Nouvelle pièce
          </button>
        </div>
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
        {selected.size > 0 && (
          <div className="admin-bulkbar">
            <span className="admin-bulkbar__count">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</span>
            <div className="admin-bulkbar__actions">
              <button className="admin-btn" onClick={() => bulk('active')}>Activer</button>
              <button className="admin-btn" onClick={() => bulk('draft')}>Brouillon</button>
              <button className="admin-btn" onClick={() => bulk('archived')}>Archiver</button>
              <button className="admin-btn admin-btn--danger" onClick={() => bulk('delete')}>Supprimer</button>
              <button className="admin-btn" onClick={() => setSelected(new Set())}>Désélectionner</button>
            </div>
          </div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-check-col">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    aria-label="Tout sélectionner"
                  />
                </th>
                <th></th>
                <th className="admin-th-sort" onClick={() => toggleSort('title')}>
                  Pièce{sortCaret('title')}
                </th>
                <th>Taille</th>
                <th className="admin-th-sort" onClick={() => toggleSort('price')}>
                  Prix{sortCaret('price')}
                </th>
                <th className="admin-th-sort" onClick={() => toggleSort('category')}>
                  Catégorie{sortCaret('category')}
                </th>
                <th className="admin-th-sort" onClick={() => toggleSort('status')}>
                  Statut{sortCaret('status')}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => (
                <tr
                  key={item.id}
                  className={`${item.status !== 'active' ? 'admin-row--dim' : ''} ${selected.has(item.id) ? 'admin-row--sel' : ''}`}
                >
                  <td className="admin-check-col">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`Sélectionner ${item.title}`}
                    />
                  </td>
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
                  <td className="admin-price">
                    {item.salePrice != null && item.salePrice < item.price ? (
                      <>
                        <span className="admin-price__old">{item.price}</span>{' '}
                        <span className="admin-price__sale">{item.salePrice} TND</span>
                      </>
                    ) : (
                      `${item.price} TND`
                    )}
                  </td>
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
