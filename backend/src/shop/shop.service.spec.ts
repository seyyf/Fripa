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
