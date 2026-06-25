import type {
  CartLine,
  CartResponse,
  CatalogueItem,
  Category,
  CheckoutResult,
  FavoritesResponse,
  FieldItem,
  FieldFilters,
  ItemDetail,
  ShopConfig,
  TShirt,
} from '../types';
import { effectivePrice } from '../types';
import { SAMPLE_ITEMS } from './sampleItems';

// In-memory shop running entirely in the browser — mirrors the backend
// ShopService closely enough to exercise the whole UI (swipe deck, catalogue,
// cart holds, favorites, a fake checkout) with NO server. Resets on reload.

const CART_TTL_MS = 15 * 60 * 1000;
const MAX_CART_HOLDS = 10;
const LAST_CHANCE_PROB = 0.1;
const LAST_CHANCE_SURFACE = 0.2;

const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte',
  'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia',
  'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès', 'Médenine',
  'Tataouine', 'Gafsa', 'Tozeur', 'Kébili',
];

const passed = new Set<string>();
const lastChancePool = new Set<string>();
const shownLastChance = new Set<string>();
const sold = new Set<string>();
const favorites = new Set<string>();
const cart = new Map<string, number>(); // id → reservedAt
const history: string[] = []; // passed item ids, for undo
let orderSeq = 1;

const find = (id: string) => SAMPLE_ITEMS.find((i) => i.id === id);

function expireCart() {
  const now = Date.now();
  for (const [id, at] of cart) if (now - at >= CART_TTL_MS) cart.delete(id);
}

function matches(item: TShirt, f: FieldFilters): boolean {
  if (f.q) {
    const hay = `${item.title} ${item.brand} ${item.description} ${item.color}`.toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  if (f.sizes?.length && !f.sizes.includes(item.size)) return false;
  if (f.conditions?.length && !f.conditions.includes(item.condition)) return false;
  if (f.maxPrice != null && item.price > f.maxPrice) return false;
  if (f.category && item.category !== f.category) return false;
  return true;
}

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

function cartResponse(): CartResponse {
  expireCart();
  const lines: CartLine[] = [];
  for (const [id, at] of cart) {
    const item = find(id);
    if (!item || sold.has(id)) {
      cart.delete(id);
      continue;
    }
    lines.push({ ...item, quantity: 1, expiresAt: at + CART_TTL_MS });
  }
  const total = lines.reduce((s, l) => s + effectivePrice(l) * l.quantity, 0);
  return { lines, total };
}

function favResponse(): FavoritesResponse {
  return { lines: [...favorites].map(find).filter((x): x is TShirt => !!x && !sold.has(x.id)) };
}

function parseFilters(p: URLSearchParams): FieldFilters {
  const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : undefined);
  const max = p.get('maxPrice');
  return {
    q: p.get('q') || undefined,
    sizes: csv(p.get('sizes')) as FieldFilters['sizes'],
    conditions: csv(p.get('conditions')) as FieldFilters['conditions'],
    maxPrice: max ? parseInt(max, 10) : undefined,
    category: (p.get('category') || undefined) as Category | undefined,
  };
}

const config: ShopConfig = {
  governorates: GOVERNORATES,
  deliveryFee: 7,
  deliveryFees: {},
  freeDeliveryMinItems: 3,
  freeDeliveryMinTotal: null,
  whatsappShop: '',
  loyaltyEnabled: false,
  loyaltyThreshold: 5,
  referralEnabled: false,
  referralRefereeDiscount: 5,
  promoEnabled: true,
};

// Routes a /api request to in-memory logic. Returns the same JSON shape the
// real endpoints do; throws Error(message) where the real API would 4xx.
export async function mockFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(init.body as string) : {};
  const [raw, query = ''] = path.split('?');
  const p = new URLSearchParams(query);
  const out = (v: unknown) => v as T;

  // available = not gone, not sold
  const live = (i: TShirt) =>
    !sold.has(i.id) && !passed.has(i.id) && !lastChancePool.has(i.id) && !shownLastChance.has(i.id);

  if (raw === '/shop-config') return out(config);
  if (raw === '/drops/next') return out({ at: null, count: 0 });
  if (raw === '/categories') {
    const present = new Set(SAMPLE_ITEMS.map((i) => i.category));
    return out(
      (['T-shirts', 'Sweats', 'Polos', 'Vestes', 'Maillots', 'Shorts', 'Jeans'] as Category[]).filter(
        (c) => present.has(c),
      ),
    );
  }

  if (raw === '/items/field') {
    expireCart();
    const count = Math.min(parseInt(p.get('count') ?? '12', 10) || 12, 60);
    const f = parseFilters(p);
    const fresh = SAMPLE_ITEMS.filter((i) => live(i) && !cart.has(i.id) && !favorites.has(i.id) && matches(i, f));
    const reprise = SAMPLE_ITEMS.filter((i) => lastChancePool.has(i.id) && !shownLastChance.has(i.id) && matches(i, f));
    const items: FieldItem[] = [];
    if (reprise.length && Math.random() < LAST_CHANCE_SURFACE) {
      const chosen = reprise[Math.floor(Math.random() * reprise.length)];
      lastChancePool.delete(chosen.id);
      shownLastChance.add(chosen.id);
      items.push({ ...chosen, lastChance: true });
    }
    for (const it of shuffle(fresh)) {
      if (items.length >= count) break;
      items.push({ ...it, lastChance: false });
    }
    return out({ items, remaining: Math.max(0, fresh.length + reprise.length - items.length) });
  }

  if (raw === '/catalogue') {
    expireCart();
    const f = parseFilters(p);
    const visible = SAMPLE_ITEMS.filter((i) => live(i) && matches(i, f));
    const items: CatalogueItem[] = visible.map((i) => {
      if (cart.has(i.id)) return { ...i, reservedUntil: (cart.get(i.id) as number) + CART_TTL_MS };
      if (favorites.has(i.id)) return { ...i, favorited: true };
      return { ...i };
    });
    return out({ items, total: visible.filter((i) => !cart.has(i.id)).length });
  }

  const pieceMatch = raw.match(/^\/piece\/([^/]+)$/);
  if (pieceMatch && method === 'GET') {
    const item = find(pieceMatch[1]);
    if (!item) throw new Error('Pièce introuvable');
    let status: ItemDetail['status'] = 'available';
    if (cart.has(item.id)) status = 'inCart';
    else if (favorites.has(item.id)) status = 'inFavorites';
    else if (sold.has(item.id) || passed.has(item.id) || shownLastChance.has(item.id)) status = 'gone';
    return out({ item, status });
  }

  const similarMatch = raw.match(/^\/piece\/([^/]+)\/similar$/);
  if (similarMatch) {
    const base = find(similarMatch[1]);
    if (!base) return out([]);
    const n = Math.min(parseInt(p.get('count') ?? '4', 10) || 4, 12);
    const score = (i: TShirt) =>
      (i.category === base.category ? 3 : 0) +
      (i.size === base.size ? 2 : 0) +
      (i.brand === base.brand ? 2 : 0) +
      (Math.abs(i.price - base.price) <= base.price * 0.3 ? 1 : 0);
    return out(
      SAMPLE_ITEMS.filter((i) => i.id !== base.id && live(i) && !cart.has(i.id))
        .map((i) => ({ i, s: score(i) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, n)
        .map((x) => x.i),
    );
  }

  if (raw === '/swipes/pass') {
    const id = body.itemId as string;
    history.push(id);
    if (shownLastChance.has(id)) return out({ gone: true });
    if (Math.random() < LAST_CHANCE_PROB) {
      lastChancePool.add(id);
      return out({ gone: false, eligibleForReprise: true });
    }
    passed.add(id);
    return out({ gone: true });
  }
  if (raw === '/crowd/snatch') {
    const id = body.itemId as string;
    if (Math.random() < LAST_CHANCE_PROB) {
      lastChancePool.add(id);
      return out({ gone: false, eligibleForReprise: true });
    }
    passed.add(id);
    return out({ gone: true });
  }
  if (raw === '/swipes/undo') {
    const id = history.pop();
    if (!id) return out({ undone: null });
    passed.delete(id);
    lastChancePool.delete(id);
    shownLastChance.delete(id);
    const item = find(id);
    return out({ undone: item ? { action: 'pass', item } : null });
  }

  if (raw === '/cart' && method === 'POST') {
    const id = body.itemId as string;
    expireCart();
    if (!cart.has(id) && cart.size >= MAX_CART_HOLDS) {
      throw new Error(
        `Panier plein — tu peux réserver ${MAX_CART_HOLDS} pièces à la fois. Passe commande ou retires-en une.`,
      );
    }
    if (find(id)) {
      cart.set(id, Date.now());
      lastChancePool.delete(id);
    }
    return out(cartResponse());
  }
  if (raw.startsWith('/cart/') && raw.endsWith('/promo')) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const total = cartResponse().total;
    if (code === 'FRIPA10') {
      const discount = Math.round(total * 0.1);
      return out({ ok: true, code, type: 'percent', value: 10, discount, total: total - discount });
    }
    if (code === 'DEMO5') {
      const discount = Math.min(5, total);
      return out({ ok: true, code, type: 'fixed', value: 5, discount, total: total - discount });
    }
    throw new Error('Code promo invalide.');
  }
  if (raw.endsWith('/checkout') && method === 'POST') {
    const c = cartResponse();
    if (c.lines.length === 0) throw new Error('Panier vide.');
    if (!body.name?.trim() || !body.email?.trim() || !body.address?.trim() || !body.phone?.trim()) {
      throw new Error('Informations de livraison manquantes.');
    }
    if (!GOVERNORATES.includes((body.governorate ?? '').trim())) {
      throw new Error('Choisis ton gouvernorat pour la livraison.');
    }
    let discount = 0;
    const code = String(body.promoCode ?? '').trim().toUpperCase();
    if (code === 'FRIPA10') discount = Math.round(c.total * 0.1);
    else if (code === 'DEMO5') discount = Math.min(5, c.total);
    const itemsTotal = c.total - discount;
    const freeDelivery = c.lines.length >= (config.freeDeliveryMinItems ?? Infinity);
    const deliveryFee = freeDelivery ? 0 : config.deliveryFees[body.governorate] ?? config.deliveryFee;
    const finalTotal = itemsTotal + deliveryFee;
    c.lines.forEach((l) => sold.add(l.id));
    cart.clear();
    const ref = `FR-DEMO${1000 + orderSeq++}`;
    const note = freeDelivery ? ', livraison offerte 🚚' : `, dont ${deliveryFee} TND de livraison`;
    return out({
      ok: true,
      ref,
      message: `Commande ${ref} confirmée — ${finalTotal} TND${note}. (démo — aucune commande réelle)`,
      orderTotal: finalTotal,
      deliveryFee,
      referralDiscount: 0,
      loyaltyApplied: false,
      referrerRewardApplied: false,
      lines: c.lines,
      customer: body,
    } satisfies CheckoutResult);
  }

  const cartDel = raw.match(/^\/cart\/[^/]+\/([^/]+)$/);
  if (cartDel && method === 'DELETE') {
    cart.delete(cartDel[1]);
    return out(cartResponse());
  }
  if (raw.startsWith('/cart/') && method === 'GET') return out(cartResponse());

  if (raw === '/favorites' && method === 'POST') {
    if (find(body.itemId)) {
      favorites.add(body.itemId);
      lastChancePool.delete(body.itemId);
    }
    return out(favResponse());
  }
  const favToCart = raw.match(/^\/favorites\/[^/]+\/([^/]+)\/to-cart$/);
  if (favToCart && method === 'POST') {
    const id = favToCart[1];
    expireCart();
    if (!cart.has(id) && cart.size >= MAX_CART_HOLDS) {
      throw new Error(`Panier plein — tu peux réserver ${MAX_CART_HOLDS} pièces à la fois.`);
    }
    favorites.delete(id);
    if (find(id)) cart.set(id, Date.now());
    return out({ cart: cartResponse(), favorites: favResponse() });
  }
  const favDel = raw.match(/^\/favorites\/[^/]+\/([^/]+)$/);
  if (favDel && method === 'DELETE') {
    favorites.delete(favDel[1]);
    return out(favResponse());
  }
  if (raw.startsWith('/favorites/') && method === 'GET') return out(favResponse());

  if (raw.startsWith('/session/') && raw.endsWith('/reset')) {
    passed.clear(); lastChancePool.clear(); shownLastChance.clear(); sold.clear();
    cart.clear(); favorites.clear(); history.length = 0;
    return out({ ok: true });
  }
  if (raw.startsWith('/session/') && raw.endsWith('/reset-swipes')) {
    passed.clear(); lastChancePool.clear(); shownLastChance.clear(); history.length = 0;
    return out({ ok: true });
  }

  if (raw === '/orders/track') throw new Error('Suivi indisponible en mode démo.');

  throw new Error(`Mock: route non gérée (${method} ${raw})`);
}
