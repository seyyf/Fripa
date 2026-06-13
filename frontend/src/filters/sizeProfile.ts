import { useSyncExternalStore } from 'react';
import type { TShirt } from '../types';

// Anonymous "size profile" — the shopper's sizes, remembered in localStorage
// with NO login required, so the deck and catalogue lead with what fits them.
// It's just a persisted, app-wide default for the `sizes` filter dimension; the
// shopper can still change or clear it through the normal filter UI.

export type Size = TShirt['size'];
export const ALL_SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL'];

const KEY = 'fripa-size-profile';
const SEEN_KEY = 'fripa-size-prompted';

function load(): Size[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(arr) ? (ALL_SIZES.filter((s) => arr.includes(s)) as Size[]) : [];
  } catch {
    return [];
  }
}

let sizes: Size[] = load();
const subs = new Set<() => void>();

export function getSizeProfile(): Size[] {
  return sizes;
}

// Stable order, valid sizes only; no-ops (and skips notifying) when unchanged.
export function setSizeProfile(next: Size[]): void {
  const clean = ALL_SIZES.filter((s) => next.includes(s));
  if (sizesEqual(clean, sizes)) return;
  sizes = clean;
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable — keep it in memory for the session */
  }
  subs.forEach((fn) => fn());
}

export function sizesEqual(a?: Size[], b?: Size[]): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && ALL_SIZES.every((s) => x.includes(s) === y.includes(s));
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

// Re-renders any consumer when the profile changes (deck, catalogue, prompt).
export function useSizeProfile(): Size[] {
  return useSyncExternalStore(subscribe, getSizeProfile, getSizeProfile);
}

// First-run prompt is shown once; "all sizes"/skip still counts as seen.
export function sizePromptSeen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}
export function markSizePromptSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}
