import type { FavoritesResponse } from '../types';

const BASE = '/api';
const TOKEN_KEY = 'fripa-account-token';

export interface Account {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  email: string | null;
}

export interface AccountOrder {
  ref: string;
  status: string;
  paid: boolean;
  total: number;
  discount: number;
  createdAt: string;
  lines: { title: string; brand: string; size: string; price: number; imageUrl: string }[];
}

export function getAccountToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAccountToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearAccountToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function http<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const t = getAccountToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 401 && auth) {
    clearAccountToken();
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    let message: string | undefined;
    try {
      message = (await res.json())?.message;
    } catch {
      /* ignore */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const accountApi = {
  requestOtp: (phone: string) =>
    http<{ ok: boolean; devCode?: string }>('/account/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }, false),
  verifyOtp: (phone: string, code: string) =>
    http<{ token: string; user: Account }>('/account/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }, false),
  me: () => http<Account>('/account/me'),
  updateProfile: (patch: Partial<Pick<Account, 'name' | 'address' | 'email'>>) =>
    http<Account>('/account/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  orders: () => http<AccountOrder[]>('/account/orders'),
  favorites: () => http<FavoritesResponse>('/account/favorites'),
  addFavorite: (itemId: string) =>
    http<FavoritesResponse>('/account/favorites', { method: 'POST', body: JSON.stringify({ itemId }) }),
  removeFavorite: (itemId: string) =>
    http<FavoritesResponse>(`/account/favorites/${itemId}`, { method: 'DELETE' }),
  syncFavorites: (itemIds: string[]) =>
    http<FavoritesResponse>('/account/favorites/sync', { method: 'POST', body: JSON.stringify({ itemIds }) }),
};
