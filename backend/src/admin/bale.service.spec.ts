import { describe, it, expect, vi } from 'vitest';
import { BaleService } from './bale.service';

describe('BaleService.recost', () => {
  it('sets every member cost to round(totalCost / count)', async () => {
    const updateMany = vi.fn(async () => ({ count: 3 }));
    const prisma = {
      bale: { findUnique: vi.fn(async () => ({ id: 'b1', totalCost: 600 })) },
      item: { findMany: vi.fn(async () => [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]) },
    } as any;
    prisma.item.updateMany = updateMany;
    await new BaleService(prisma, {} as any).recost('b1');
    expect(updateMany).toHaveBeenCalledWith({ where: { baleId: 'b1' }, data: { cost: 200 } });
  });

  it('no-ops for a null bale or an empty bale', async () => {
    const updateMany = vi.fn();
    const prisma = {
      bale: { findUnique: vi.fn(async () => ({ id: 'b1', totalCost: 600 })) },
      item: { findMany: vi.fn(async () => []), updateMany },
    } as any;
    const svc = new BaleService(prisma, {} as any);
    await svc.recost(null);
    await svc.recost('b1');
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('BaleService.detail (P&L)', () => {
  it('computes gross/net with proportional discount + free-delivery allocation', async () => {
    // Bale b1: 600 TND, 3 members — i1 & i2 sold, i3 still active (price 200).
    const members = [
      { id: 'i1', baleId: 'b1', title: 'A', status: 'sold', cost: 200, price: 100, salePrice: null },
      { id: 'i2', baleId: 'b1', title: 'B', status: 'sold', cost: 200, price: 150, salePrice: null },
      { id: 'i3', baleId: 'b1', title: 'C', status: 'active', cost: 200, price: 200, salePrice: null },
    ];
    // o1 mixes i1 (100) with a non-bale line x1 (100); 20 promo; free delivery to Tunis.
    // o2 is just i2 (150); no discount; paid 7 delivery to Sfax.
    const orders = [
      {
        id: 'o1', discount: 20, referralDiscount: 0, deliveryFee: 0, governorate: 'Tunis',
        lines: [{ itemId: 'i1', price: 100 }, { itemId: 'x1', price: 100 }],
      },
      {
        id: 'o2', discount: 0, referralDiscount: 0, deliveryFee: 7, governorate: 'Sfax',
        lines: [{ itemId: 'i2', price: 150 }],
      },
    ];
    const prisma = {
      bale: { findUnique: async () => ({ id: 'b1', label: 'B1', totalCost: 600, supplier: null, purchasedAt: null, note: null }) },
      item: { findMany: async () => members },
      order: { findMany: async () => orders },
    } as any;
    const settings = { get: async () => ({ deliveryFee: 7, deliveryFees: { Tunis: 8 } }) } as any;

    const d = await new BaleService(prisma, settings).detail('b1');

    expect(d.itemCount).toBe(3);
    expect(d.soldCount).toBe(2);
    expect(d.realizedRevenue).toBe(250); // 100 + 150
    expect(d.costOfSold).toBe(400); // round(600 * 2/3)
    expect(d.grossGain).toBe(-150); // 250 - 400
    expect(d.discounts).toBe(10); // o1: round(20 * 100/200)
    expect(d.freeDelivery).toEqual({ count: 1, estimated: 4 }); // round(8 * 0.5)
    expect(d.netGain).toBe(-164); // -150 - 10 - 4
    expect(d.remainingCount).toBe(1);
    expect(d.remainingCost).toBe(200); // round(600 * 1/3)
    expect(d.potentialRevenue).toBe(200); // i3 effectivePrice
    expect(d.recoupedPct).toBe(42); // round(250/600*100)
    expect(d.members.find((m) => m.id === 'i1')?.soldPrice).toBe(100);
    expect(d.members.find((m) => m.id === 'i3')?.soldPrice).toBeNull();
  });
});
