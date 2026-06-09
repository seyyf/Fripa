import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Category, FieldFilters, FieldItem } from '../types';

interface Props {
  filters: FieldFilters;
  onApply: (next: FieldFilters) => void;
}

const SIZES: FieldItem['size'][] = ['S', 'M', 'L', 'XL', 'XXL'];

export function QuickFilters({ filters, onApply }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const toggleCategory = (c: Category) =>
    onApply({ ...filters, category: filters.category === c ? undefined : c });
  const toggleSize = (s: FieldItem['size']) => {
    const set = new Set(filters.sizes ?? []);
    set.has(s) ? set.delete(s) : set.add(s);
    onApply({ ...filters, sizes: set.size ? Array.from(set) : undefined });
  };

  return (
    <div className="quickfilters">
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
