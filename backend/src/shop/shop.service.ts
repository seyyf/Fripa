import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ITEMS } from './items.data';
import { SwipeLogService } from './swipe-log.service';
import {
  CartLine,
  CatalogueResponse,
  Category,
  CATEGORIES,
  effectivePrice,
  FavoritesResponse,
  FieldFilters,
  FieldResponse,
  ItemDetail,
  TShirt,
} from './types';

// Does an item satisfy the active deck filters? An absent/empty filter matches all.
function matchesFilters(item: TShirt, f: FieldFilters): boolean {
  if (f.q) {
    const haystack =
      `${item.title} ${item.brand} ${item.description} ${item.color}`.toLowerCase();
    if (!haystack.includes(f.q.toLowerCase())) return false;
  }
  if (f.sizes && f.sizes.length > 0 && !f.sizes.includes(item.size)) return false;
  if (f.conditions && f.conditions.length > 0 && !f.conditions.includes(item.condition))
    return false;
  if (f.maxPrice != null && item.price > f.maxPrice) return false;
  if (f.category && item.category !== f.category) return false;
  return true;
}

// Probability a "passed" item is given one more chance to surface later.
// 90% of passes → gone forever immediately. 10% → eligible to reappear once,
// flagged as "last chance" so the buyer knows it won't return.
const LAST_CHANCE_PROBABILITY = 0.1;

// When fresh items exist, how often we sneak in a last-chance reprise.
// Tuned to feel like a real fripa: rare but jolting when it happens.
const LAST_CHANCE_SURFACE_RATE = 0.2;

// A cart line is a soft reservation: hold a piece this long, then it's released
// back to the floor (someone else can grab it). See "how should I handle the cart".
const CART_TTL_MS = 10 * 60 * 1000; // 10 minutes

// How many pieces a single user may hold (reserve) at once. Caps cart-spam:
// without it a session could reserve unbounded pieces (and empty its own deck).
// Re-adding a piece already held doesn't consume a new slot. Tune as needed.
export const MAX_CART_HOLDS = 10;

// "Reviens !" (undo) is allowed once per hour per user.
// NOTE: tracked in memory only — move to DB-backed per-user storage when
// auth/persistence lands (it currently resets on server restart).
const UNDO_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

type SwipeAction = 'pass' | 'keep' | 'favorite';
interface HistoryEntry {
  action: SwipeAction;
  itemId: string;
}

interface UserState {
  passed: Set<string>;
  lastChancePool: Set<string>;
  shownLastChance: Set<string>;
  // itemId → reservedAt (ms epoch). Each piece is a one-off, so no quantities.
  cart: Map<string, number>;
  // Swipe-up "save for later". Separate from the cart; excluded from the deck.
  favorites: Set<string>;
  // Stack of undoable swipe actions, most recent last. Powers "Reviens !".
  history: HistoryEntry[];
  // When the user last used "Reviens !" — enforces the once-per-hour limit.
  lastUndoAt?: number;
}

@Injectable()
export class ShopService {
  private states = new Map<string, UserState>();

  // Optional so unit tests can build the service bare (`new ShopService()`);
  // analytics rows are then simply skipped.
  constructor(@Optional() private readonly swipeLog?: SwipeLogService) {}

  // Injectable randomness so the 90/10 dice and field shuffle are testable.
  private rng: () => number = Math.random;
  // Injectable clock so the cart-hold TTL is testable.
  private now: () => number = () => Date.now();

  // Release any cart reservations whose hold has lapsed (lazy expiry on read).
  private expireCart(userId: string, s: UserState): void {
    const now = this.now();
    for (const [id, reservedAt] of s.cart) {
      if (now - reservedAt >= CART_TTL_MS) {
        s.cart.delete(id);
        // Carted but never bought — the strongest "almost sold" signal.
        this.swipeLog?.log(userId, id, 'cart_expired');
      }
    }
  }

  private getState(userId: string): UserState {
    let s = this.states.get(userId);
    if (!s) {
      s = {
        passed: new Set(),
        lastChancePool: new Set(),
        shownLastChance: new Set(),
        cart: new Map(),
        favorites: new Set(),
        history: [],
      };
      this.states.set(userId, s);
    }
    // Authoritative lazy expiry: every read/write first releases stale holds.
    this.expireCart(userId, s);
    return s;
  }

  private findItem(id: string): TShirt | undefined {
    return ITEMS.find((i) => i.id === id);
  }

  private getItem(id: string): TShirt {
    const item = this.findItem(id);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  // An item is "fresh" for a user when they haven't decided on it yet (not
  // passed, not pending reprise, not already shown, not in cart or favorites).
  private isFresh(s: UserState, i: TShirt): boolean {
    return (
      !s.passed.has(i.id) &&
      !s.lastChancePool.has(i.id) &&
      !s.shownLastChance.has(i.id) &&
      !s.cart.has(i.id) &&
      !s.favorites.has(i.id)
    );
  }

  // The garment categories actually present in the catalogue, in display order.
  getCategories(): Category[] {
    const present = new Set(ITEMS.map((i) => i.category));
    return CATEGORIES.filter((c) => present.has(c));
  }

  // Browse view: every still-available piece (no reprise injection, no count
  // cap), honouring the same filters as the deck. See product detail / grid.
  getCatalog(userId: string, filters: FieldFilters = {}): CatalogueResponse {
    const s = this.getState(userId); // releases stale cart holds first
    // On the floor: everything not gone (passed/reprise pool/shown). Cart pieces
    // stay flagged as held (blurred + timer); favorited pieces stay flagged as
    // highlighted (still grabbable).
    const visible = ITEMS.filter(
      (i) =>
        !s.passed.has(i.id) &&
        !s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        matchesFilters(i, filters),
    );
    const items = visible.map((i) => {
      if (s.cart.has(i.id)) {
        return { ...i, reservedUntil: (s.cart.get(i.id) as number) + CART_TTL_MS };
      }
      if (s.favorites.has(i.id)) return { ...i, favorited: true };
      return { ...i };
    });
    const total = visible.filter((i) => !s.cart.has(i.id)).length;
    return { items, total };
  }

  // "Pièces similaires" for the detail page — especially useful when a piece is
  // gone, so the shopper isn't dead-ended. Scores other still-available pieces
  // by shared category / size / brand / close price, best first.
  getSimilar(userId: string, id: string, count = 4): TShirt[] {
    const base = this.findItem(id);
    if (!base) return [];
    const s = this.getState(userId);
    const score = (i: TShirt) =>
      (i.category === base.category ? 3 : 0) +
      (i.size === base.size ? 2 : 0) +
      (i.brand === base.brand ? 2 : 0) +
      (Math.abs(i.price - base.price) <= base.price * 0.3 ? 1 : 0);
    return ITEMS.filter(
      (i) =>
        i.id !== id &&
        !s.passed.has(i.id) &&
        !s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        !s.cart.has(i.id),
    )
      .map((i) => ({ i, sc: score(i) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, count)
      .map((x) => x.i);
  }

  // Single piece for the detail page, with its status for this user.
  getOne(userId: string, id: string): ItemDetail {
    const item = this.getItem(id); // throws NotFound if the id is unknown
    const s = this.getState(userId);
    let status: ItemDetail['status'];
    if (s.cart.has(id)) status = 'inCart';
    else if (s.favorites.has(id)) status = 'inFavorites';
    else if (s.passed.has(id) || s.lastChancePool.has(id) || s.shownLastChance.has(id))
      status = 'gone';
    else status = 'available';
    return { item, status };
  }

  getField(userId: string, count: number, filters: FieldFilters = {}): FieldResponse {
    const s = this.getState(userId);

    const fresh = ITEMS.filter((i) => this.isFresh(s, i) && matchesFilters(i, filters));
    const reprise = ITEMS.filter(
      (i) =>
        s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        matchesFilters(i, filters),
    );

    const items: (TShirt & { lastChance: boolean })[] = [];

    // Occasionally sneak one last-chance reprise into the batch.
    if (reprise.length > 0 && this.rng() < LAST_CHANCE_SURFACE_RATE) {
      const chosen = reprise[Math.floor(this.rng() * reprise.length)];
      s.lastChancePool.delete(chosen.id);
      s.shownLastChance.add(chosen.id);
      items.push({ ...chosen, lastChance: true });
    }

    for (const item of this.shuffle([...fresh])) {
      if (items.length >= count) break;
      items.push({ ...item, lastChance: false });
    }

    const remaining = fresh.length + reprise.length - items.length;
    return { items, remaining: Math.max(0, remaining) };
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // The 90/10 dice shared by the user's pass and the phantom crowd's snatch.
  private rollPass(s: UserState, itemId: string) {
    // If it was already a last-chance show, this seals it forever.
    if (s.shownLastChance.has(itemId)) return { gone: true };
    // 10% chance it gets one reprise as last-chance.
    if (this.rng() < LAST_CHANCE_PROBABILITY) {
      s.lastChancePool.add(itemId);
      return { gone: false, eligibleForReprise: true };
    }
    s.passed.add(itemId);
    return { gone: true };
  }

  // The user passes on a piece (swipe-left). Undoable via "Reviens !".
  pass(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId); // validate
    s.history.push({ action: 'pass', itemId });
    this.swipeLog?.log(userId, itemId, 'pass');
    return this.rollPass(s, itemId);
  }

  // A phantom shopper takes a piece off the catalogue floor. Same dice as a
  // pass, but NOT recorded in the undo history — it isn't the user's action.
  snatch(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId); // validate
    return this.rollPass(s, itemId);
  }

  // Mutates the cart without recording an undoable swipe (shared by the
  // swipe-keep and the move-from-favorites paths).
  private cartAdd(userId: string, s: UserState, itemId: string) {
    // A refresh of an existing hold is not a new "keep" signal.
    if (!s.cart.has(itemId)) this.swipeLog?.log(userId, itemId, 'keep');
    // Start (or refresh) the hold reservation for this piece.
    s.cart.set(itemId, this.now());
    // Once it's in the cart, drop any pending reprise.
    s.lastChancePool.delete(itemId);
  }

  // Guard against cart-spam: a user can hold at most MAX_CART_HOLDS pieces.
  // Re-holding a piece already in the cart is fine (it just refreshes the TTL).
  // `s` is post-expiry (getState releases lapsed holds first), so the count is
  // only the live reservations.
  private assertCanHold(s: UserState, itemId: string) {
    if (!s.cart.has(itemId) && s.cart.size >= MAX_CART_HOLDS) {
      throw new ConflictException(
        `Panier plein — tu peux réserver ${MAX_CART_HOLDS} pièces à la fois. Passe commande ou retires-en une.`,
      );
    }
  }

  addToCart(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId);
    this.assertCanHold(s, itemId);
    this.cartAdd(userId, s, itemId);
    // Deliberately NOT recorded in the undo history: "Reviens !" only brings
    // back passed pieces — cart/favorites have their own removal flows.
    return this.getCart(userId);
  }

  // Bring back the most recent PASSED piece (the only regrettable swipe —
  // cart and favorites are deliberate saves with their own removal flows).
  // Returns the restored item so the client can drop it back on the deck.
  undo(userId: string): {
    undone: { action: SwipeAction; item: TShirt } | null;
    rateLimited?: boolean;
    retryAfterMs?: number;
  } {
    const s = this.getState(userId);
    const now = this.now();
    // Once per hour per user.
    if (s.lastUndoAt != null && now - s.lastUndoAt < UNDO_COOLDOWN_MS) {
      return { undone: null, rateLimited: true, retryAfterMs: s.lastUndoAt + UNDO_COOLDOWN_MS - now };
    }
    const last = s.history.pop(); // history only ever records passes
    if (!last) return { undone: null };
    const { action, itemId } = last;
    // Make it eligible for the deck again, whatever the dice did.
    s.passed.delete(itemId);
    s.lastChancePool.delete(itemId);
    s.shownLastChance.delete(itemId);
    s.lastUndoAt = now; // start the hourly cooldown
    return { undone: { action, item: this.getItem(itemId) } };
  }

  removeFromCart(userId: string, itemId: string) {
    const s = this.getState(userId);
    s.cart.delete(itemId);
    // Putting it back on the rack: a removed piece returns to circulation
    // (it becomes available again in the catalogue and the deck).
    return this.getCart(userId);
  }

  // Empty a user's cart after a successful order. The bought pieces are marked
  // sold globally by the checkout flow (CheckoutService), not here.
  clearCart(userId: string): void {
    this.getState(userId).cart.clear();
  }

  getCart(userId: string): { lines: CartLine[]; total: number } {
    const s = this.getState(userId);
    const lines: CartLine[] = [];
    for (const [id, reservedAt] of s.cart) {
      const item = this.findItem(id);
      // A piece sold or removed globally silently drops out of the cart.
      if (!item) {
        s.cart.delete(id);
        continue;
      }
      lines.push({ ...item, quantity: 1, expiresAt: reservedAt + CART_TTL_MS });
    }
    const total = lines.reduce((acc, l) => acc + effectivePrice(l) * l.quantity, 0);
    return { lines, total };
  }

  // --- Favorites (swipe-up / save for later) ---

  addFavorite(userId: string, itemId: string): FavoritesResponse {
    const s = this.getState(userId);
    this.getItem(itemId); // validate
    if (!s.favorites.has(itemId)) this.swipeLog?.log(userId, itemId, 'favorite');
    s.favorites.add(itemId);
    // Like the cart, favoriting cancels any pending reprise. Not undoable —
    // un-starring the drawer is the way back.
    s.lastChancePool.delete(itemId);
    return this.getFavorites(userId);
  }

  removeFavorite(userId: string, itemId: string): FavoritesResponse {
    const s = this.getState(userId);
    s.favorites.delete(itemId);
    // Un-favoriting is not destructive — the piece returns to circulation.
    return this.getFavorites(userId);
  }

  moveFavoriteToCart(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId);
    // Check the hold cap before removing it from favourites, so a rejected move
    // leaves the favourite untouched.
    this.assertCanHold(s, itemId);
    s.favorites.delete(itemId);
    this.cartAdd(userId, s, itemId); // not an undoable swipe
    return { cart: this.getCart(userId), favorites: this.getFavorites(userId) };
  }

  getFavorites(userId: string): FavoritesResponse {
    const s = this.getState(userId);
    const lines: TShirt[] = [];
    for (const id of s.favorites) {
      const item = this.findItem(id);
      // Drop a favourite that was sold/removed globally.
      if (!item) {
        s.favorites.delete(id);
        continue;
      }
      lines.push(item);
    }
    return { lines };
  }

  reset(userId: string) {
    this.states.delete(userId);
    return { ok: true };
  }

  // Stock-refresh: keep the curated cart, wipe everything the swipe loop has
  // touched. See docs/adr/0002-preserve-cart-on-stock-refresh.md.
  resetSwipes(userId: string) {
    const s = this.getState(userId);
    s.passed.clear();
    s.lastChancePool.clear();
    s.shownLastChance.clear();
    s.history = [];
    return { ok: true };
  }
}
