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
