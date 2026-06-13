import { useEffect, useState } from 'react';
import type { FieldFilters, TShirt } from '../types';
import { useT } from '../i18n/LanguageContext';

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
  const { t } = useT();
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
          <h2>{t('filter.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </header>

        <div className="filter-body">
          <label className="filter-field">
            <span className="filter-label">{t('filter.search')}</span>
            <input
              className="filter-input"
              type="search"
              placeholder={t('filter.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="filter-field">
            <span className="filter-label">{t('filter.size')}</span>
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
            <span className="filter-label">{t('filter.condition')}</span>
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
            <span className="filter-label">{t('filter.maxPrice')}</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              placeholder={t('filter.maxPricePlaceholder')}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
        </div>

        <footer className="drawer__foot filter-foot">
          <button className="btn btn--pass btn--ghost" onClick={onClear}>
            {t('filter.reset')}
          </button>
          <button className="btn btn--add" onClick={apply}>
            {t('common.apply')}
          </button>
        </footer>
      </aside>
    </div>
  );
}
