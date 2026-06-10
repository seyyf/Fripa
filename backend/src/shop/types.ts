export type Category =
  | 'T-shirts'
  | 'Sweats'
  | 'Polos'
  | 'Vestes'
  | 'Maillots'
  | 'Shorts'
  | 'Jeans';

// Display order for the catalogue tabs.
export const CATEGORIES: Category[] = [
  'T-shirts',
  'Sweats',
  'Polos',
  'Vestes',
  'Maillots',
  'Shorts',
  'Jeans',
];

// Allowed values for the constrained item fields, used for admin validation.
export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const CONDITIONS = ['Comme neuf', 'Très bon état', 'Bon état', 'Vintage'] as const;

// Item lifecycle / stock status. Only `active` items are shown to shoppers.
export const ITEM_STATUSES = ['active', 'draft', 'sold', 'archived'] as const;
export type ItemLifecycleStatus = (typeof ITEM_STATUSES)[number];

export interface TShirt {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  // Extra photo URLs (the cover is `imageUrl`); empty/absent for single-photo items.
  images?: string[];
  price: number;
  // Optional discounted price. Treated as a sale only when set and below `price`.
  salePrice?: number | null;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  brand: string;
  condition: 'Comme neuf' | 'Très bon état' | 'Bon état' | 'Vintage';
  color: string;
  seller: string;
  category: Category;
}

// The price actually charged: the sale price when it's a real discount, else the
// regular price. Single source of truth for cart totals and order snapshots.
export function effectivePrice(item: { price: number; salePrice?: number | null }): number {
  return item.salePrice != null && item.salePrice < item.price ? item.salePrice : item.price;
}

export interface FieldResponse {
  items: (TShirt & { lastChance: boolean })[];
  remaining: number;
}

export interface CartLine extends TShirt {
  quantity: number;
  // When this reservation lapses (ms epoch). After it, the piece is released.
  expiresAt: number;
}

export interface FavoritesResponse {
  lines: TShirt[];
}

export interface CustomerInfo {
  name: string;
  email: string;
  address: string;
  phone: string;
  // Delivery zone (Tunisian governorate) — drives the delivery fee.
  governorate: string;
}

export interface FieldFilters {
  q?: string;
  sizes?: TShirt['size'][];
  conditions?: TShirt['condition'][];
  maxPrice?: number;
  category?: Category;
}

export type ItemStatus = 'available' | 'gone' | 'inCart' | 'inFavorites';

// A catalogue floor item. `reservedUntil` (ms epoch) is set when the piece is
// currently held by the user's cart — shown blurred with a countdown, not
// grabbable, until the hold lapses or it's released. Absent = available.
export interface CatalogueItem extends TShirt {
  reservedUntil?: number;
  // True when this piece is in the user's favourites — shown highlighted, still grabbable.
  favorited?: boolean;
}

export interface CatalogueResponse {
  items: CatalogueItem[];
  total: number; // available (grabbable) count
}

export interface ItemDetail {
  item: TShirt;
  status: ItemStatus;
}
