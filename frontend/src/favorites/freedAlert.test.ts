import { describe, it, expect } from 'vitest';
import { detectFreedFavorites } from './freedAlert';

const NOW = 1_000_000;
const reserved = (id: string) => ({ id, reservedUntil: NOW + 60_000 });
const free = (id: string) => ({ id });

describe('detectFreedFavorites', () => {
  it('fires for a piece that went reserved -> available', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [free('a')], NOW)).toEqual(['a']);
  });

  it('does not fire for a still-reserved piece', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [reserved('a')], NOW)).toEqual([]);
  });

  it('does not fire for a piece that disappeared (sold/removed)', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [free('b')], NOW)).toEqual([]);
  });

  it('treats an expired reservedUntil as freed', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [{ id: 'a', reservedUntil: NOW - 1 }], NOW)).toEqual(['a']);
  });

  it('returns every freed id', () => {
    const prev = new Set(['a', 'b']);
    expect(detectFreedFavorites(prev, [free('a'), free('b')], NOW).sort()).toEqual(['a', 'b']);
  });
});
