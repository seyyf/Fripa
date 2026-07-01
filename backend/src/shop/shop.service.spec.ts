import { describe, it, expect } from 'vitest';
import { ShopService, MAX_CART_HOLDS } from './shop.service';
import { effectivePrice } from './types';

const id = (n: number) => `t-${String(n).padStart(3, '0')}`;

describe('effectivePrice', () => {
  it('charges the sale price only when it is below the regular price', () => {
    expect(effectivePrice({ price: 50 })).toBe(50);
    expect(effectivePrice({ price: 50, salePrice: null })).toBe(50);
    expect(effectivePrice({ price: 50, salePrice: 30 })).toBe(30);
    expect(effectivePrice({ price: 50, salePrice: 60 })).toBe(50); // not a real discount
  });
});

function withRng(value: number): ShopService {
  const s = new ShopService();
  (s as unknown as { rng: () => number }).rng = () => value;
  return s;
}

describe('ShopService.pass dice', () => {
  it('keeps the item for a reprise when the roll is below 0.1', () => {
    const s = withRng(0.05);
    const res = s.pass('u1', 't-001');
    expect(res).toEqual({ gone: false, eligibleForReprise: true });
  });

  it('drops the item forever when the roll is at/above 0.1', () => {
    const s = withRng(0.5);
    const res = s.pass('u1', 't-001');
    expect(res).toEqual({ gone: true });
  });
});

describe('ShopService.getField', () => {
  it('returns at most `count` items, none of them in the cart', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const res = s.getField('u1', 5);
    expect(res.items.length).toBeLessThanOrEqual(5);
    expect(res.items.some((i) => i.id === 't-001')).toBe(false);
    expect(res.items.every((i) => i.lastChance === false)).toBe(true);
  });

  it('excludes passed items', () => {
    const s = new ShopService();
    (s as unknown as { rng: () => number }).rng = () => 0.9; // force "gone"
    s.pass('u1', 't-002');
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-002')).toBe(false);
  });

  it('surfaces a last-chance reprise when the roll is below the surface rate', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    store.rng = () => 0.05; // < 0.1 → t-003 enters the last-chance pool
    s.pass('u1', 't-003');
    store.rng = () => 0.1; // < 0.2 surface rate → reprise surfaces
    const res = s.getField('u1', 60);
    const reprise = res.items.find((i) => i.id === 't-003');
    expect(reprise).toBeDefined();
    expect(reprise!.lastChance).toBe(true);
  });
});

describe('ShopService.getField filters', () => {
  it('filters by size', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { sizes: ['S'] });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((i) => i.size === 'S')).toBe(true);
  });

  it('filters by max price', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { maxPrice: 20 });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((i) => i.price <= 20)).toBe(true);
  });

  it('filters by condition', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { conditions: ['Vintage'] });
    expect(res.items.every((i) => i.condition === 'Vintage')).toBe(true);
  });

  it('filters by category', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { category: 'Shorts' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((i) => i.category === 'Shorts')).toBe(true);
  });

  it('filters by free-text query against title/brand', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { q: 'nike' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(
      res.items.every((i) =>
        `${i.title} ${i.brand} ${i.description} ${i.color}`.toLowerCase().includes('nike'),
      ),
    ).toBe(true);
  });

  it('returns nothing when filters match no item', () => {
    const s = new ShopService();
    const res = s.getField('u1', 60, { q: 'zzz-no-such-thing' });
    expect(res.items.length).toBe(0);
    expect(res.remaining).toBe(0);
  });
});

function withClock(start: number) {
  const s = new ShopService();
  const store = s as unknown as { now: () => number };
  let t = start;
  store.now = () => t;
  return { s, advance: (ms: number) => (t += ms) };
}

const TTL = 15 * 60 * 1000;

describe('ShopService cart hold (TTL)', () => {
  it('puts an expiry timestamp on each cart line', () => {
    const { s } = withClock(1000);
    s.addToCart('u1', 't-001');
    const line = s.getCart('u1').lines.find((l) => l.id === 't-001')!;
    expect(line.expiresAt).toBe(1000 + TTL);
  });

  it('keeps the piece held (on the floor, blurred) while the hold is active', () => {
    const { s, advance } = withClock(0);
    s.addToCart('u1', 't-001');
    advance(9 * 60 * 1000); // 9 min < 10
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(true);
    const item = s.getCatalog('u1').items.find((i) => i.id === 't-001');
    expect(item?.reservedUntil).toBeGreaterThan(0); // present but held
  });

  it('releases the piece back to circulation when the hold expires', () => {
    const { s, advance } = withClock(0);
    s.addToCart('u1', 't-001');
    advance(TTL + 1);
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(false);
    expect(s.getCatalog('u1').items.some((i) => i.id === 't-001')).toBe(true);
    expect(s.getField('u1', 60).items.some((i) => i.id === 't-001')).toBe(true);
  });
});

describe('ShopService.clearCart', () => {
  it('empties the user cart (used after a successful order)', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    s.addToCart('u1', 't-002');
    expect(s.getCart('u1').lines.length).toBe(2);
    s.clearCart('u1');
    expect(s.getCart('u1').lines.length).toBe(0);
  });
});

describe('ShopService cart hold cap', () => {
  function fillCart(s: ShopService) {
    for (let i = 1; i <= MAX_CART_HOLDS; i++) s.addToCart('u1', id(i));
  }

  it('allows holding up to the cap', () => {
    const s = new ShopService();
    fillCart(s);
    expect(s.getCart('u1').lines.length).toBe(MAX_CART_HOLDS);
  });

  it('rejects a new hold beyond the cap', () => {
    const s = new ShopService();
    fillCart(s);
    expect(() => s.addToCart('u1', id(MAX_CART_HOLDS + 1))).toThrow();
    expect(s.getCart('u1').lines.length).toBe(MAX_CART_HOLDS); // unchanged
  });

  it('still lets you re-hold a piece already in the cart when full (refresh, no new slot)', () => {
    const s = new ShopService();
    fillCart(s);
    expect(() => s.addToCart('u1', id(1))).not.toThrow();
    expect(s.getCart('u1').lines.length).toBe(MAX_CART_HOLDS);
  });

  it('frees a slot when a held piece is removed', () => {
    const s = new ShopService();
    fillCart(s);
    s.removeFromCart('u1', id(1));
    expect(() => s.addToCart('u1', id(MAX_CART_HOLDS + 1))).not.toThrow();
    expect(s.getCart('u1').lines.length).toBe(MAX_CART_HOLDS);
  });

  it('does not let moveFavoriteToCart exceed the cap (favourite kept on rejection)', () => {
    const s = new ShopService();
    fillCart(s);
    s.addFavorite('u1', id(MAX_CART_HOLDS + 1));
    expect(() => s.moveFavoriteToCart('u1', id(MAX_CART_HOLDS + 1))).toThrow();
    // The favourite is untouched since the move was rejected before deletion.
    expect(s.getFavorites('u1').lines.some((l) => l.id === id(MAX_CART_HOLDS + 1))).toBe(true);
  });
});

describe('ShopService.removeFromCart', () => {
  it('returns the piece to circulation (available again) when removed', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    // While in the cart it's held on the floor (blurred), not available.
    expect(s.getCatalog('u1').items.find((i) => i.id === 't-001')?.reservedUntil).toBeGreaterThan(0);

    s.removeFromCart('u1', 't-001');

    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(false);
    const item = s.getCatalog('u1').items.find((i) => i.id === 't-001');
    expect(item?.reservedUntil).toBeUndefined(); // available again
    expect(s.getField('u1', 60).items.some((i) => i.id === 't-001')).toBe(true);
  });
});

describe('ShopService.snatch (phantom crowd)', () => {
  it('removes the piece like a pass, but is NOT undoable', () => {
    const s = withRng(0.9); // force "gone"
    s.snatch('u1', 't-001');
    expect(s.getCatalog('u1').items.some((i) => i.id === 't-001')).toBe(false);
    // The crowd taking a piece is not the user's action — nothing to undo.
    expect(s.undo('u1').undone).toBeNull();
  });

  it('still rolls the 10% Dernière chance reprise', () => {
    const s = withRng(0.05); // < 0.1 → reprise
    expect(s.snatch('u1', 't-002')).toEqual({ gone: false, eligibleForReprise: true });
  });
});

describe('ShopService.getCatalog', () => {
  it('returns available pieces with a total, applying filters', () => {
    const s = new ShopService();
    const res = s.getCatalog('u1', { sizes: ['S'] });
    expect(res.total).toBe(res.items.length);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((i) => i.size === 'S')).toBe(true);
  });

  it('excludes passed pieces; keeps cart (held) and favorited (highlighted) pieces flagged', () => {
    const s = new ShopService();
    (s as unknown as { rng: () => number }).rng = () => 0.9; // force "gone"
    s.pass('u1', 't-001');
    s.addToCart('u1', 't-002');
    s.addFavorite('u1', 't-003');
    const items = s.getCatalog('u1').items;
    expect(items.some((i) => i.id === 't-001')).toBe(false); // passed → gone
    expect(items.find((i) => i.id === 't-002')?.reservedUntil).toBeGreaterThan(0); // held
    expect(items.find((i) => i.id === 't-003')?.favorited).toBe(true); // highlighted, on the floor
  });

  it('counts only available (non-held) pieces in total', () => {
    const s = new ShopService();
    const before = s.getCatalog('u1').total;
    s.addToCart('u1', 't-001');
    const after = s.getCatalog('u1');
    expect(after.total).toBe(before - 1); // one piece is now held, not available
    expect(after.items.find((i) => i.id === 't-001')?.reservedUntil).toBeGreaterThan(0);
  });
});

describe('ShopService.getCategories', () => {
  it('returns the distinct categories present, in display order', () => {
    const s = new ShopService();
    const cats = s.getCategories();
    expect(cats).toContain('T-shirts');
    expect(cats).toContain('Shorts');
    expect(cats).toContain('Maillots');
    expect(new Set(cats).size).toBe(cats.length); // no duplicates
  });
});

describe('ShopService.getOne', () => {
  it('returns the item with status "available" for a fresh piece', () => {
    const s = new ShopService();
    const res = s.getOne('u1', 't-001');
    expect(res.item.id).toBe('t-001');
    expect(res.status).toBe('available');
  });

  it('reports "inCart", "inFavorites" and "gone" states', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    s.addToCart('u1', 't-001');
    s.addFavorite('u1', 't-002');
    store.rng = () => 0.9; // force "gone"
    s.pass('u1', 't-003');
    expect(s.getOne('u1', 't-001').status).toBe('inCart');
    expect(s.getOne('u1', 't-002').status).toBe('inFavorites');
    expect(s.getOne('u1', 't-003').status).toBe('gone');
  });

  it('throws for an unknown id', () => {
    const s = new ShopService();
    expect(() => s.getOne('u1', 'does-not-exist')).toThrow();
  });
});

describe('ShopService favorites', () => {
  it('addFavorite stores the item and getFavorites lists it', () => {
    const s = new ShopService();
    const res = s.addFavorite('u1', 't-001');
    expect(res.lines.some((l) => l.id === 't-001')).toBe(true);
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-001')).toBe(true);
  });

  it('addFavorite cancels a pending last-chance reprise', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    store.rng = () => 0.05; // < 0.1 → t-002 enters the last-chance pool
    s.pass('u1', 't-002');
    s.addFavorite('u1', 't-002');
    // It is now a favorite, not a pending reprise.
    store.rng = () => 0.1; // would surface a reprise if one existed
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-002' && i.lastChance)).toBe(false);
  });

  it('getField excludes favorited items', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-001')).toBe(false);
  });

  it('removeFavorite drops it from favorites and returns it to circulation', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    const res = s.removeFavorite('u1', 't-001');
    expect(res.lines.some((l) => l.id === 't-001')).toBe(false);
    // Un-favoriting is not destructive: the piece is available again.
    expect(s.getField('u1', 60).items.some((i) => i.id === 't-001')).toBe(true);
    expect(s.getCatalog('u1').items.find((i) => i.id === 't-001')?.favorited).toBeUndefined();
  });

  it('moveFavoriteToCart removes from favorites and adds to the cart', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    const res = s.moveFavoriteToCart('u1', 't-001');
    expect(res.favorites.lines.some((l) => l.id === 't-001')).toBe(false);
    expect(res.cart.lines.some((l) => l.id === 't-001')).toBe(true);
  });

  it('resetSwipes preserves favorites; reset clears them', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');

    s.resetSwipes('u1');
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-001')).toBe(true);

    s.reset('u1');
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-001')).toBe(false);
  });
});

describe('ShopService.undo', () => {
  it('undoing a pass makes the item eligible again', () => {
    const s = withRng(0.5); // force "gone forever"
    s.pass('u1', 't-001');
    expect(s.getField('u1', 60).items.some((i) => i.id === 't-001')).toBe(false);

    const res = s.undo('u1');
    expect(res.undone?.action).toBe('pass');
    expect(res.undone?.item.id).toBe('t-001');
    expect(s.getField('u1', 60).items.some((i) => i.id === 't-001')).toBe(true);
  });

  it('a keep is NOT undoable — the piece stays in the cart', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');

    const res = s.undo('u1');
    expect(res.undone).toBeNull();
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(true);
  });

  it('a favorite is NOT undoable — the piece stays in favorites', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');

    const res = s.undo('u1');
    expect(res.undone).toBeNull();
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-001')).toBe(true);
  });

  it('returns null when there is nothing to undo', () => {
    const s = new ShopService();
    expect(s.undo('u1').undone).toBeNull();
  });

  it('skips keeps/favorites and only ever brings back passes, in reverse order', () => {
    const { s, advance } = withClock(0);
    s.pass('u1', 't-001');
    s.addToCart('u1', 't-002');
    s.pass('u1', 't-003');
    s.addFavorite('u1', 't-004');
    expect(s.undo('u1').undone?.item.id).toBe('t-003');
    // The deliberate saves were untouched (checked before the clock jump —
    // the cart hold legitimately lapses after its 10-minute TTL).
    expect(s.getCart('u1').lines.some((l) => l.id === 't-002')).toBe(true);
    advance(60 * 60 * 1000 + 1); // next hour
    expect(s.undo('u1').undone?.item.id).toBe('t-001');
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-004')).toBe(true);
  });

  it('allows three undos, then rate-limits within 10 minutes', () => {
    const { s } = withClock(0);
    for (let i = 1; i <= 3; i++) {
      s.pass('u1', id(i));
      expect(s.undo('u1').undone?.action).toBe('pass');
    }
    s.pass('u1', 't-004');
    const fourth = s.undo('u1');
    expect(fourth.undone).toBeNull();
    expect(fourth.rateLimited).toBe(true);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows undo again after the 10-minute window clears', () => {
    const { s, advance } = withClock(0);
    for (let i = 1; i <= 3; i++) {
      s.pass('u1', id(i));
      s.undo('u1');
    }
    s.pass('u1', 't-005');
    expect(s.undo('u1').undone).toBeNull(); // 4th within the window → blocked
    advance(10 * 60 * 1000 + 1);
    s.pass('u1', 't-006');
    expect(s.undo('u1').undone?.action).toBe('pass'); // window cleared
  });

  it('does not consume the hourly allowance when there is nothing to undo', () => {
    const { s } = withClock(0);
    expect(s.undo('u1').undone).toBeNull(); // empty history, not rate-limited
    s.pass('u1', 't-001');
    expect(s.undo('u1').undone?.action).toBe('pass'); // still allowed
  });

  it('moveFavoriteToCart is not an undoable swipe', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    s.moveFavoriteToCart('u1', 't-001');
    // Neither the favorite nor the move is undoable — only passes are.
    expect(s.undo('u1').undone).toBeNull();
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(true);
  });
});

describe('ShopService.resetSwipes', () => {
  it('clears swipe history but preserves the cart', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    store.rng = () => 0.5; // force "gone"
    s.pass('u1', 't-001');
    store.rng = () => 0.05; // force reprise
    s.pass('u1', 't-002');
    s.addToCart('u1', 't-003');

    s.resetSwipes('u1');

    const cart = s.getCart('u1');
    expect(cart.lines.some((l) => l.id === 't-003')).toBe(true);

    // t-001 was "gone forever"; after resetSwipes it should be eligible again.
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-001')).toBe(true);
    // No reprise ribbons surface — lastChancePool was also cleared.
    expect(res.items.every((i) => i.lastChance === false)).toBe(true);
  });
});

describe('ShopService global reservations', () => {
  it('blocks a second user from holding a piece already held', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    expect(() => s.addToCart('u2', 't-001')).toThrow(/réservé par un autre/i);
  });

  it("keeps a held piece in other users' decks, tagged reserved", () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const card = s.getField('u2', 200).items.find((i) => i.id === 't-001');
    expect(card).toBeDefined();
    expect(card?.reservedUntil).toBeGreaterThan(0);
  });

  it('reports reserved status + reservedUntil on the detail page for others', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const d = s.getOne('u2', 't-001');
    expect(d.status).toBe('reserved');
    expect(d.reservedUntil).toBeGreaterThan(0);
  });

  it('blocks moving a favorite to cart when held by another', () => {
    const s = new ShopService();
    s.addFavorite('u2', 't-001');
    s.addToCart('u1', 't-001');
    expect(() => s.moveFavoriteToCart('u2', 't-001')).toThrow(/réservé par un autre/i);
  });

  it('releases the hold after the TTL — the piece is grabbable again', () => {
    const { s, advance } = withClock(1000);
    s.addToCart('u1', 't-001');
    advance(TTL + 1);
    expect(s.getField('u2', 100).items.map((i) => i.id)).toContain('t-001');
    expect(() => s.addToCart('u2', 't-001')).not.toThrow();
  });

  it('never surfaces a held piece as a last-chance reprise (and does not burn it)', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number; now: () => number };
    let t = 1000;
    store.now = () => t;
    store.rng = () => 0.05; // forces reprise eligibility + reprise surfacing
    s.pass('u2', 't-001'); // t-001 -> u2's last-chance pool
    s.addToCart('u1', 't-001'); // u1 now holds it
    // While held, it must NOT be offered as a last-chance card.
    expect(s.getField('u2', 200).items.find((i) => i.id === 't-001')).toBeUndefined();
    // The reprise wasn't burned: once the hold frees, it can resurface.
    t += TTL + 1;
    expect(s.getField('u2', 200).items.find((i) => i.id === 't-001')?.lastChance).toBe(true);
  });
});
