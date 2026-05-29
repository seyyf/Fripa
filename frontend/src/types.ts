export interface TShirt {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  brand: string;
  condition: string;
  color: string;
  seller: string;
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
}

export interface CartResponse {
  lines: CartLine[];
  total: number;
}

export interface FavoritesResponse {
  lines: TShirt[];
}
