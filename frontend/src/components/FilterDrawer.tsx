import { useEffect, useState } from 'react';
import type { FieldFilters, TShirt } from '../types';

interface Props {
  open: boolean;
  filters: FieldFilters;
  onApply: (filters: FieldFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

const SIZES: TShirt['size'][] = ['S', 'M', 'L', 'XL', 'XXL'];
const CONDITIONS: TShirt['condition'][] = [
  'Comme neuf',
  'Très bon état',
  'Bon état',
  'Vintage',
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterDrawer({ open, filters, onApply, onClear, onClose }: Props) {
  const [q, setQ] = useState(filters.q ?? '');
  const [sizes, setSizes] = useState<TShirt['size'][]>(filters.sizes ?? []);
  const [conditions, setConditions] = useState<TShirt['condition'][]>(filters.conditions ?? []);
  const [maxPrice, setMaxPrice] = useState<string>(
    filters.maxPrice != null ? String(filters.maxPrice) : '',
  );

  // Re-sync the draft whenever the drawer opens with the current filters.
  useEffect(() => {
    if (open) {
      setQ(filters.q ?? '');
      setSizes(filters.sizes ?? []);
      setConditions(filters.conditions ?? []);
      setMaxPrice(filters.maxPrice != null ? String(filters.maxPrice) : '');
    }
  }, [open, filters]);

  if (!open) return null;

  function apply() {
    const next: FieldFilters = {};
    if (q.trim()) next.q = q.trim();
    if (sizes.length) next.sizes = sizes;
    if (conditions.length) next.conditions = conditions;
    const price = parseInt(maxPrice, 10);
    if (maxPrice.trim() && !Number.isNaN(price)) next.maxPrice = price;
    onApply(next);
    onClose();
  }

  return (
    <div className="drawer-backdrop drawer-backdrop--side" onClick={onClose}>
      <aside className="drawer drawer--filters drawer--side" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>Filtrer</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="filter-body">
          <label className="filter-field">
            <span className="filter-label">Recherche</span>
            <input
              className="filter-input"
              type="search"
              placeholder="Rechercher (marque, modèle, couleur…)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="filter-field">
            <span className="filter-label">Taille</span>
            <div className="chip-row">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip chip--toggle ${sizes.includes(s) ? 'chip--on' : ''}`}
                  aria-pressed={sizes.includes(s)}
                  onClick={() => setSizes((prev) => toggle(prev, s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-field">
            <span className="filter-label">État</span>
            <div className="chip-row">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip chip--toggle ${conditions.includes(c) ? 'chip--on' : ''}`}
                  aria-pressed={conditions.includes(c)}
                  onClick={() => setConditions((prev) => toggle(prev, c))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <label className="filter-field">
            <span className="filter-label">Prix max (TND)</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              placeholder="ex. 30"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
        </div>

        <footer className="drawer__foot filter-foot">
          <button className="btn btn--pass btn--ghost" onClick={onClear}>
            Réinitialiser
          </button>
          <button className="btn btn--add" onClick={apply}>
            Appliquer
          </button>
        </footer>
      </aside>
    </div>
  );
}
