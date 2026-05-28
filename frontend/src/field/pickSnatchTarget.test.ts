import { describe, it, expect } from 'vitest';
import { pickSnatchTarget } from './pickSnatchTarget';

describe('pickSnatchTarget', () => {
  it('returns null when the field is at or below the minimum size', () => {
    expect(pickSnatchTarget(['a', 'b'], null, 2, () => 0)).toBeNull();
  });

  it('never picks the focused box', () => {
    const target = pickSnatchTarget(['a', 'b', 'c'], 'a', 1, () => 0);
    expect(target).not.toBe('a');
    expect(['b', 'c']).toContain(target);
  });

  it('picks deterministically from candidates using rng', () => {
    // rng=0.99 → last candidate; candidates after removing focused 'b' = [a, c]
    expect(pickSnatchTarget(['a', 'b', 'c'], 'b', 1, () => 0.99)).toBe('c');
  });
});
