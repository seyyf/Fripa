import { describe, it, expect } from 'vitest';
import { pickSnatchTarget } from './pickSnatchTarget';

describe('pickSnatchTarget', () => {
  it('returns null when the floor is at or below the minimum size', () => {
    expect(pickSnatchTarget(['a', 'b'], null, 2, () => 0)).toBeNull();
  });

  it('never picks the protected (hovered) piece', () => {
    const target = pickSnatchTarget(['a', 'b', 'c'], 'a', 1, () => 0);
    expect(target).not.toBe('a');
    expect(['b', 'c']).toContain(target);
  });

  it('picks deterministically from candidates using rng', () => {
    // candidates after removing protected 'b' = [a, c]; rng 0.99 → last
    expect(pickSnatchTarget(['a', 'b', 'c'], 'b', 1, () => 0.99)).toBe('c');
  });

  it('returns null when only the protected piece is left above the floor', () => {
    expect(pickSnatchTarget(['a'], 'a', 0, () => 0)).toBeNull();
  });
});
