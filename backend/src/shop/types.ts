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
}

export interface FieldResponse {
  items: (TShirt & { lastChance: boolean })[];
  remaining: number;
}

export interface CartLine extends TShirt {
  quantity: number;
}

export interface FavoritesResponse {
  lines: TShirt[];
}
