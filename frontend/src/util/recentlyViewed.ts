export interface RecentItem {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  salePrice?: number | null;
}

const KEY = 'fripa-recent';
const MAX = 12;

export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

// Record a viewed piece (most recent first, de-duplicated, capped).
export function addRecent(item: RecentItem): void {
  try {
    const entry: RecentItem = {
      id: item.id,
      title: item.title,
      imageUrl: item.imageUrl,
      price: item.price,
      salePrice: item.salePrice ?? null,
    };
    const next = [entry, ...getRecent().filter((r) => r.id !== item.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
