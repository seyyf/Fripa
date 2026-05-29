import { describe, it, expect } from 'vitest';
import { ShopService } from './shop.service';

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

  it('removeFavorite drops it and it does not resurface in the deck', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    const res = s.removeFavorite('u1', 't-001');
    expect(res.lines.some((l) => l.id === 't-001')).toBe(false);
    const field = s.getField('u1', 60);
    expect(field.items.some((i) => i.id === 't-001')).toBe(false);
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

  it('undoing a keep removes it from the cart', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(true);

    const res = s.undo('u1');
    expect(res.undone?.action).toBe('keep');
    expect(s.getCart('u1').lines.some((l) => l.id === 't-001')).toBe(false);
  });

  it('undoing a favorite removes it from favorites', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    const res = s.undo('u1');
    expect(res.undone?.action).toBe('favorite');
    expect(s.getFavorites('u1').lines.some((l) => l.id === 't-001')).toBe(false);
  });

  it('returns null when there is nothing to undo', () => {
    const s = new ShopService();
    expect(s.undo('u1').undone).toBeNull();
  });

  it('undoes multiple actions in reverse order', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    s.addFavorite('u1', 't-002');
    expect(s.undo('u1').undone?.action).toBe('favorite');
    expect(s.undo('u1').undone?.action).toBe('keep');
    expect(s.undo('u1').undone).toBeNull();
  });

  it('moveFavoriteToCart is not an undoable swipe', () => {
    const s = new ShopService();
    s.addFavorite('u1', 't-001');
    s.moveFavoriteToCart('u1', 't-001');
    // The only undoable action is the original favorite, not the move.
    expect(s.undo('u1').undone?.action).toBe('favorite');
    expect(s.undo('u1').undone).toBeNull();
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
