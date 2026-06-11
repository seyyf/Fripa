import type {
  CartResponse,
  CatalogueResponse,
  Category,
  CheckoutResult,
  CustomerInfo,
  FavoritesResponse,
  FieldFilters,
  FieldResponse,
  ItemDetail,
  ShopConfig,
  TrackedOrder,
  TShirt,
} from './types';
import { buildFieldQuery } from './filters/fieldQuery';

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
  if (!res.ok) {
    // Surface the server's message (e.g. the cart-hold cap) when there is one.
    let message = '';
    try {
      message = (await res.json())?.message ?? '';
    } catch {
      /* no JSON body */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  userId,
  // Public shop configuration (delivery fees, free-delivery rule, WhatsApp).
  shopConfig: () => http<ShopConfig>(`/shop-config`),
  // Next scheduled drop (countdown teaser). `at` is null when nothing is scheduled.
  nextDrop: () => http<{ at: string | null; count: number }>(`/drops/next`),
  field: (count: number, filters: FieldFilters = {}) => {
    const qs = buildFieldQuery(filters);
    return http<FieldResponse>(
      `/items/field?userId=${userId()}&count=${count}${qs ? `&${qs}` : ''}`,
    );
  },
  // Garment categories present in the catalogue (for the browse tabs).
  categories: () => http<Category[]>(`/categories`),
  // Browse grid: all still-available pieces (filters honoured).
  catalogue: (filters: FieldFilters = {}) => {
    const qs = buildFieldQuery(filters);
    return http<CatalogueResponse>(`/catalogue?userId=${userId()}${qs ? `&${qs}` : ''}`);
  },
  // Single piece for the detail page (with its status for this user).
  item: (id: string) => http<ItemDetail>(`/piece/${id}?userId=${userId()}`),
  // "Pièces similaires" recommendations for the detail page.
  similar: (id: string, count = 4) =>
    http<TShirt[]>(`/piece/${id}/similar?userId=${userId()}&count=${count}`),
  // A phantom shopper grabs a piece off the catalogue floor (not undoable).
  crowdSnatch: (itemId: string) =>
    http<{ gone: boolean; eligibleForReprise?: boolean }>(`/crowd/snatch`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
  // Swipe-left: the user passes. Rolls the 90/10 dice on /api/swipes/pass —
  // 90% gone forever, 10% resurfaces once as a "Dernière chance" card.
  pass: (itemId: string) =>
    http<{ gone: boolean; eligibleForReprise?: boolean }>(`/swipes/pass`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
  // "Reviens !" — reverse the most recent swipe; returns the restored item.
  // Allowed once per hour per user (rateLimited when on cooldown).
  undo: () =>
    http<{
      undone: { action: 'pass' | 'keep' | 'favorite'; item: TShirt } | null;
      rateLimited?: boolean;
      retryAfterMs?: number;
    }>(`/swipes/undo`, { method: 'POST', body: JSON.stringify({ userId: userId() }) }),
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
  // Validate a promo against the current cart; returns the discount preview.
  applyPromo: (code: string) =>
    http<{ ok: boolean; code: string; type: string; value: number; discount: number; total: number }>(
      `/cart/${userId()}/promo`,
      { method: 'POST', body: JSON.stringify({ code }) },
    ),
  checkout: (customer: CustomerInfo, promoCode?: string, referralCode?: string) =>
    http<CheckoutResult>(`/cart/${userId()}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ ...customer, promoCode, referralCode }),
    }),
  // Public order tracking by reference + phone.
  trackOrder: (ref: string, phone: string) =>
    http<TrackedOrder>(
      `/orders/track?ref=${encodeURIComponent(ref)}&phone=${encodeURIComponent(phone)}`,
    ),
  reset: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset`, { method: 'POST' }),
  resetSwipes: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset-swipes`, { method: 'POST' }),
};
