import type { CartResponse, FavoritesResponse, FieldResponse } from './types';

const BASE = '/api';

function userId() {
  let id = localStorage.getItem('fripa-user');
  if (!id) {
    id = 'u-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('fripa-user', id);
  }
  return id;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  userId,
  field: (count: number) =>
    http<FieldResponse>(`/items/field?userId=${userId()}&count=${count}`),
  // Swipe-left: the user passes. Rolls the 90/10 dice on /api/swipes/pass —
  // 90% gone forever, 10% resurfaces once as a "Dernière chance" card.
  pass: (itemId: string) =>
    http<{ gone: boolean; eligibleForReprise?: boolean }>(`/swipes/pass`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
  add: (itemId: string) =>
    http<CartResponse>(`/cart`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
  cart: () => http<CartResponse>(`/cart/${userId()}`),
  remove: (itemId: string) =>
    http<CartResponse>(`/cart/${userId()}/${itemId}`, { method: 'DELETE' }),
  // Swipe-up: save for later. Separate from the cart.
  favorite: (itemId: string) =>
    http<FavoritesResponse>(`/favorites`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
  favorites: () => http<FavoritesResponse>(`/favorites/${userId()}`),
  unfavorite: (itemId: string) =>
    http<FavoritesResponse>(`/favorites/${userId()}/${itemId}`, { method: 'DELETE' }),
  favoriteToCart: (itemId: string) =>
    http<{ cart: CartResponse; favorites: FavoritesResponse }>(
      `/favorites/${userId()}/${itemId}/to-cart`,
      { method: 'POST' },
    ),
  checkout: () =>
    http<{ ok: boolean; message: string; orderTotal?: number }>(
      `/cart/${userId()}/checkout`,
      { method: 'POST' },
    ),
  reset: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset`, { method: 'POST' }),
  resetSwipes: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset-swipes`, { method: 'POST' }),
};
