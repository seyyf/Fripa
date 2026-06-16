import type { Category } from '../types';

const BASE = '/api';
const TOKEN_KEY = 'fripa-admin-token';

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const CONDITIONS = ['Comme neuf', 'Très bon état', 'Bon état', 'Vintage'] as const;
export const CATEGORIES: Category[] = [
  'T-shirts',
  'Sweats',
  'Polos',
  'Vestes',
  'Maillots',
  'Shorts',
  'Jeans',
];
export const STATUSES = ['active', 'draft', 'sold', 'archived'] as const;
export type ItemStatus = (typeof STATUSES)[number];

export interface AdminItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  images?: string | null; // raw JSON array string from the DB
  price: number;
  cost: number; // what the shop paid (souk price); powers margin
  salePrice?: number | null;
  size: string;
  brand: string;
  condition: string;
  color: string;
  seller: string;
  category: string;
  status: string;
  publishAt?: string | null; // scheduled draft → active promotion (drop)
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Omit<
  AdminItem,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'images' | 'cost'
> & {
  status?: string;
  cost?: number; // optional; defaults to 0 server-side
  images?: string[] | null; // sent as an array; stored as JSON server-side
};

export interface AdminOrderLine {
  id: string;
  itemId: string;
  title: string;
  brand: string;
  price: number;
  size: string;
  imageUrl: string;
}

export const ORDER_STATUSES = [
  'Nouvelle',
  'Confirmée',
  'Expédiée',
  'Livrée',
  'Retournée',
  'Annulée',
] as const;

export interface OrderPatch {
  status?: string;
  paid?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
}

export const PROMO_TYPES = ['percent', 'fixed'] as const;

export interface AdminPromo {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export type PromoInput = {
  code: string;
  type: string;
  value: number;
  minOrder?: number | null;
  maxUses?: number | null;
  active?: boolean;
  expiresAt?: string | null;
};

export interface AdminCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
  orders: number;
  total: number;
  lastOrderAt: string;
}

export interface AdminStats {
  items: { total: number } & Record<string, number>;
  orders: { total: number; revenue: number; today: number; revenueToday: number };
  delivered: { count: number; revenue: number };
  collected: { count: number; revenue: number };
  margin: { gross: number; realized: number; activeStockCost: number };
  ordersByStatus: Record<string, number>;
  topCategories: { category: string; count: number }[];
  revenueSeries: { date: string; revenue: number }[];
}

export interface AdminOrder {
  id: string;
  ref: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerPhone: string;
  governorate: string;
  total: number;
  deliveryFee: number;
  status: string;
  paid: boolean;
  createdAt: string;
  lines: AdminOrderLine[];
}

// Shop configuration (admin → Réglages). Mirrors the backend ShopConfig.
export interface ShopConfig {
  deliveryFee: number;
  deliveryFees: Record<string, number>;
  freeDeliveryMinItems: number | null;
  freeDeliveryMinTotal: number | null;
  whatsappShop: string;
  whatsappAlertPhone: string;
  whatsappAlertApiKey: string;
  loyaltyEnabled: boolean;
  loyaltyThreshold: number;
  referralEnabled: boolean;
  referralRefereeDiscount: number;
  promoEnabled: boolean;
}

export interface SettingsResponse {
  governorates: string[];
  config: ShopConfig;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
}

// Swipe analytics + abandoned interest (admin → Analyses).
export interface ItemSwipeStats {
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  salePrice: number | null;
  category: string;
  status: string;
  passes: number;
  keeps: number;
  favorites: number;
  cartExpired: number;
}

export interface AdminInsights {
  totals: { pass: number; keep: number; favorite: number; cartExpired: number; purchases: number };
  categories: { category: string; passes: number; keeps: number; favorites: number; keepRate: number }[];
  topPassed: ItemSwipeStats[];
  topWanted: ItemSwipeStats[];
  abandoned: ItemSwipeStats[];
  sellThrough: {
    category: string;
    sold: number;
    listed: number;
    rate: number;
    medianDaysToSell: number | null;
  }[];
  medianDaysToSell: number | null;
}

export interface LivePresence {
  online: number;
  byGovernorate: { name: string; count: number }[];
  topPieces: { pieceId: string; title: string; count: number }[];
  activeCarts: number;
  swipeRatePerMin: number;
}

export interface VisitorHistoryPoint {
  hour: string;
  peakOnline: number;
  avgOnline: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Thrown on a 401 so the UI can drop back to the login screen.
export class AdminAuthError extends Error {
  constructor() {
    super('Session expirée — reconnecte-toi.');
    this.name = 'AdminAuthError';
  }
}

async function http<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new AdminAuthError();
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

export const adminApi = {
  login: (password: string) =>
    http<{ token: string }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }, false),
  me: () => http<{ ok: boolean; role: string }>('/admin/me'),
  listItems: () => http<AdminItem[]>('/admin/items'),
  createItem: (input: ItemInput) =>
    http<AdminItem>('/admin/items', { method: 'POST', body: JSON.stringify(input) }),
  updateItem: (id: string, patch: Partial<ItemInput>) =>
    http<AdminItem>(`/admin/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteItem: (id: string) =>
    http<{ ok: true }>(`/admin/items/${id}`, { method: 'DELETE' }),
  bulkItems: (ids: string[], action: string) =>
    http<{ ok: true; count: number }>('/admin/items/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),
  importItems: (csv: string) =>
    http<{ created: number; errors: string[] }>('/admin/items/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  markdownDormant: (days?: number, percent?: number) =>
    http<{ ok: true; count: number }>('/admin/items/markdown-dormant', {
      method: 'POST',
      body: JSON.stringify({ days, percent }),
    }),
  listOrders: () => http<AdminOrder[]>('/admin/orders'),
  updateOrder: (id: string, patch: OrderPatch) =>
    http<AdminOrder>(`/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  returnOrder: (id: string) =>
    http<AdminOrder>(`/admin/orders/${id}/return`, { method: 'POST' }),
  stats: () => http<AdminStats>('/admin/stats'),
  listCustomers: () => http<AdminCustomer[]>('/admin/customers'),
  listPromos: () => http<AdminPromo[]>('/admin/promos'),
  createPromo: (input: PromoInput) =>
    http<AdminPromo>('/admin/promos', { method: 'POST', body: JSON.stringify(input) }),
  updatePromo: (id: string, patch: Partial<PromoInput>) =>
    http<AdminPromo>(`/admin/promos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deletePromo: (id: string) =>
    http<{ ok: true }>(`/admin/promos/${id}`, { method: 'DELETE' }),
  getSettings: () => http<SettingsResponse>('/admin/settings'),
  updateSettings: (patch: Partial<ShopConfig>) =>
    http<SettingsResponse>('/admin/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  testWhatsApp: () =>
    http<{ ok: true }>('/admin/settings/test-whatsapp', { method: 'POST' }),
  insights: () => http<AdminInsights>('/admin/insights'),
  audit: (limit = 200) => http<AuditEntry[]>(`/admin/audit?limit=${limit}`),
  presence: () => http<LivePresence>('/admin/presence'),
  presenceHistory: (hours = 48) =>
    http<VisitorHistoryPoint[]>(`/admin/presence/history?hours=${hours}`),

  // Multipart upload — can't go through `http` (which forces a JSON content-type;
  // the browser must set the multipart boundary itself).
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/admin/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (res.status === 401) {
      clearToken();
      throw new AdminAuthError();
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
  },
};
