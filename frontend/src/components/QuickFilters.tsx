import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Category, FieldFilters, FieldItem } from '../types';

interface Props {
  filters: FieldFilters;
  deck: FieldItem[]; // source for brand autocomplete
  onApply: (next: FieldFilters) => void;
}

const SIZES: FieldItem['size'][] = ['S', 'M', 'L', 'XL', 'XXL'];

export function QuickFilters({ filters, deck, onApply }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState(filters.q ?? '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    setQ(filters.q ?? '');
  }, [filters.q]);

  // Brand suggestions derived from the pieces currently on the floor.
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const brands = Array.from(new Set(deck.map((i) => i.brand)));
    return brands.filter((b) => b.toLowerCase().includes(term) && b.toLowerCase() !== term).slice(0, 5);
  }, [q, deck]);

  const submitSearch = (value: string) => {
    setFocused(false);
    onApply({ ...filters, q: value.trim() || undefined });
  };
  const toggleCategory = (c: Category) =>
    onApply({ ...filters, category: filters.category === c ? undefined : c });
  const toggleSize = (s: FieldItem['size']) => {
    const set = new Set(filters.sizes ?? []);
    set.has(s) ? set.delete(s) : set.add(s);
    onApply({ ...filters, sizes: set.size ? Array.from(set) : undefined });
  };

  return (
    <div className="quickfilters">
      <div className="quickfilters__search">
        <input
          className="filter-input"
          placeholder="Rechercher une pièce, une marque…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => e.key === 'Enter' && submitSearch(q)}
        />
        {q && (
          <button className="quickfilters__clear" aria-label="Effacer" onClick={() => submitSearch('')}>
            ✕
          </button>
        )}
        {focused && suggestions.length > 0 && (
          <ul className="quickfilters__suggest">
            {suggestions.map((s) => (
              <li key={s}>
                <button onMouseDown={() => submitSearch(s)}>{s}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="quickfilters__chips" role="group" aria-label="Filtres rapides">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip chip--toggle ${filters.category === c ? 'chip--on' : ''}`}
            onClick={() => toggleCategory(c)}
          >
            {c}
          </button>
        ))}
        <span className="quickfilters__sep" aria-hidden="true" />
        {SIZES.map((s) => (
          <button
            key={s}
            className={`chip chip--toggle ${filters.sizes?.includes(s) ? 'chip--on' : ''}`}
            onClick={() => toggleSize(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
