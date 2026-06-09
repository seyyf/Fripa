export type Category =
  | 'T-shirts'
  | 'Sweats'
  | 'Polos'
  | 'Vestes'
  | 'Maillots'
  | 'Shorts'
  | 'Jeans';

export interface TShirt {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  salePrice?: number | null;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  brand: string;
  condition: string;
  color: string;
  seller: string;
  category: Category;
}

// True when the piece has a real discount (sale price set and below the price).
export function isOnSale(item: { price: number; salePrice?: number | null }): boolean {
  return item.salePrice != null && item.salePrice < item.price;
}
// The price actually charged.
export function effectivePrice(item: { price: number; salePrice?: number | null }): number {
  return isOnSale(item) ? (item.salePrice as number) : item.price;
}

export interface FieldItem extends TShirt {
  lastChance: boolean;
}

export interface FieldResponse {
  items: FieldItem[];
  remaining: number;
}

export interface CartLine extends TShirt {
  quantity: number;
  expiresAt: number;
}

export interface CartResponse {
  lines: CartLine[];
  total: number;
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

export interface CheckoutResult {
  ok: boolean;
  message: string;
  ref?: string;
  orderTotal?: number;
  lines?: CartLine[];
  customer?: CustomerInfo;
}

export interface FieldFilters {
  q?: string;
  sizes?: TShirt['size'][];
  conditions?: TShirt['condition'][];
  maxPrice?: number;
  category?: Category;
}

export type ItemStatus = 'available' | 'gone' | 'inCart' | 'inFavorites';

export interface CatalogueItem extends TShirt {
  // Set when the piece is held by the user's cart (blurred + countdown on the floor).
  reservedUntil?: number;
  // True when the piece is in favourites — shown highlighted, still on the floor.
  favorited?: boolean;
}

export interface CatalogueResponse {
  items: CatalogueItem[];
  total: number;
}

export interface ItemDetail {
  item: TShirt;
  status: ItemStatus;
}

export interface TrackedOrder {
  ref: string;
  status: string;
  paid: boolean;
  createdAt: string;
  total: number;
  customerName: string;
  lines: { title: string; brand: string; size: string; price: number; imageUrl: string }[];
}
