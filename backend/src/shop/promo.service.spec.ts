import { describe, it, expect, vi } from 'vitest';
import { PromoService } from './promo.service';
import type { PrismaService } from './prisma.service';

function svcWith(promo: unknown) {
  const prisma = {
    promoCode: { findUnique: vi.fn(async () => promo) },
  } as unknown as PrismaService;
  return new PromoService(prisma);
}
const base = { id: 'p', code: 'X', active: true, expiresAt: null, maxUses: null, uses: 0, minOrder: null };

describe('PromoService.validateForTotal', () => {
  it('computes a percent discount (floored) on the cart total', async () => {
    const { discount } = await svcWith({ ...base, type: 'percent', value: 15 }).validateForTotal('x', 99);
    expect(discount).toBe(14); // floor(99*0.15)
  });

  it('caps a fixed discount at the cart total', async () => {
    expect((await svcWith({ ...base, type: 'fixed', value: 5 }).validateForTotal('X', 100)).discount).toBe(5);
  });

  it('rejects unknown, inactive, expired, exhausted, or below-minimum codes', async () => {
    await expect(svcWith(null).validateForTotal('X', 100)).rejects.toThrow();
    await expect(svcWith({ ...base, type: 'fixed', value: 5, active: false }).validateForTotal('X', 100)).rejects.toThrow();
    await expect(
      svcWith({ ...base, type: 'fixed', value: 5, expiresAt: new Date(Date.now() - 1000) }).validateForTotal('X', 100),
    ).rejects.toThrow();
    await expect(
      svcWith({ ...base, type: 'fixed', value: 5, maxUses: 2, uses: 2 }).validateForTotal('X', 100),
    ).rejects.toThrow();
    await expect(
      svcWith({ ...base, type: 'percent', value: 10, minOrder: 50 }).validateForTotal('X', 40),
    ).rejects.toThrow();
  });
});
