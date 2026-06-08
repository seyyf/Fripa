import type { FieldFilters } from '../types';

// Serialize active deck filters into a query-string fragment (no leading "?"),
// omitting blanks and empty lists. Pure, so it's unit-testable.
export function buildFieldQuery(f: FieldFilters): string {
  const p = new URLSearchParams();
  if (f.q && f.q.trim()) p.set('q', f.q.trim());
  if (f.sizes && f.sizes.length) p.set('sizes', f.sizes.join(','));
  if (f.conditions && f.conditions.length) p.set('conditions', f.conditions.join(','));
  if (f.maxPrice != null) p.set('maxPrice', String(f.maxPrice));
  if (f.category) p.set('category', f.category);
  return p.toString();
}

// How many filter dimensions are currently active (for the badge on "Filtrer").
export function activeFilterCount(f: FieldFilters): number {
  let n = 0;
  if (f.q && f.q.trim()) n++;
  if (f.sizes && f.sizes.length) n++;
  if (f.conditions && f.conditions.length) n++;
  if (f.maxPrice != null) n++;
  return n;
}
