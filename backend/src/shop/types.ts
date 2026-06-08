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
  price: number;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  brand: string;
  condition: 'Comme neuf' | 'Très bon état' | 'Bon état' | 'Vintage';
  color: string;
  seller: string;
  category: Category;
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
