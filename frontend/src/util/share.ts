// Share a piece via the Web Share API, falling back to copying the link.
// Returns the outcome so the caller can show feedback.
export async function shareItem(item: {
  id: string;
  title: string;
  price: number;
  salePrice?: number | null;
}): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${location.origin}/piece/${item.id}`;
  const price = item.salePrice != null && item.salePrice < item.price ? item.salePrice : item.price;
  const text = `${item.title} — ${price} TND sur Fripa 🇹🇳`;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: item.title, text, url });
      return 'shared';
    } catch {
      // user cancelled or share failed — fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
