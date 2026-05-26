import type { CartResponse, NextItemResponse } from './types';

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
  next: () => http<NextItemResponse>(`/items/next?userId=${userId()}`),
  pass: (itemId: string) =>
    http<{ gone: boolean }>(`/swipes/pass`, {
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
  checkout: () =>
    http<{ ok: boolean; message: string; orderTotal?: number }>(
      `/cart/${userId()}/checkout`,
      { method: 'POST' },
    ),
  reset: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset`, { method: 'POST' }),
};
