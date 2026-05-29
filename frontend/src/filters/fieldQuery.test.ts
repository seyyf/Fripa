import { describe, it, expect } from 'vitest';
import { buildFieldQuery, activeFilterCount } from './fieldQuery';

describe('buildFieldQuery', () => {
  it('returns an empty string for no filters', () => {
    expect(buildFieldQuery({})).toBe('');
  });

  it('includes a text query', () => {
    expect(new URLSearchParams(buildFieldQuery({ q: 'nike' })).get('q')).toBe('nike');
  });

  it('joins sizes and conditions with commas', () => {
    const p = new URLSearchParams(buildFieldQuery({ sizes: ['S', 'M'], conditions: ['Vintage'] }));
    expect(p.get('sizes')).toBe('S,M');
    expect(p.get('conditions')).toBe('Vintage');
  });

  it('includes maxPrice', () => {
    expect(new URLSearchParams(buildFieldQuery({ maxPrice: 20 })).get('maxPrice')).toBe('20');
  });

  it('omits blank query and empty arrays', () => {
    expect(buildFieldQuery({ q: '', sizes: [], conditions: [] })).toBe('');
  });
});

describe('activeFilterCount', () => {
  it('counts each active filter dimension once', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: 'nike' })).toBe(1);
    expect(activeFilterCount({ q: 'nike', sizes: ['M'], maxPrice: 30 })).toBe(3);
    expect(activeFilterCount({ q: '', sizes: [] })).toBe(0);
  });
});
