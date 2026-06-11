import { describe, it, expect, vi } from 'vitest';
import { CheckoutService } from './checkout.service';
import { ShopService } from './shop.service';
import type { PrismaService } from './prisma.service';
import type { CatalogueLoader } from './catalogue.loader';

const customer = {
  name: 'Amine',
  email: 'amine@fripa.tn',
  address: 'Tunis',
  phone: '20123456',
  governorate: 'Tunis',
};

const DELIVERY_FEE = 7;

// Builds a CheckoutService over a real (in-memory) ShopService plus mocked
// Prisma + loader. `activeIds` controls which cart pieces are still sellable.
function setup(
  activeIds: string[],
  promo?: { code: string; discount: number; maxUses?: number | null },
  opts: { freeDelivery?: boolean } = {},
) {
  const shop = new ShopService();
  const tx = {
    item: {
      findMany: vi.fn(async ({ where }: any) =>
        where.id.in.filter((id: string) => activeIds.includes(id)).map((id: string) => ({ id })),
      ),
      updateMany: vi.fn(async () => ({ count: activeIds.length })),
    },
    order: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: any) => ({ ref: data.ref, ...data })),
    },
    promoCode: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  } as unknown as PrismaService;
  const loader = { reload: vi.fn(async () => {}) } as unknown as CatalogueLoader;
  const promoSvc = {
    validateForTotal: vi.fn(async () => {
      if (!promo) throw new Error('no promo configured');
      return { promo: { id: 'p1', code: promo.code, maxUses: promo.maxUses ?? null }, discount: promo.discount };
    }),
  };
  const settings = {
    qualifiesFreeDelivery: vi.fn(async () => opts.freeDelivery ?? false),
    feeFor: vi.fn(async () => DELIVERY_FEE),
  };
  const notify = { orderPlaced: vi.fn() };
  // No loyalty/referral rewards by default; tests that exercise them override.
  const rewards = {
    validateReferral: vi.fn(async () => ({ ok: false, message: 'off' })),
    loyaltyStatus: vi.fn(async () => ({ available: 0 })),
    referrerStatus: vi.fn(async () => ({ available: 0 })),
  };
  const service = new CheckoutService(
    prisma,
    loader,
    shop,
    promoSvc as any,
    settings as any,
    notify as any,
    rewards as any,
  );
  return { service, shop, prisma, loader, tx, promoSvc, settings, notify, rewards };
}

describe('CheckoutService.checkout', () => {
  it('places the order: persists it, marks pieces sold, reloads, clears the cart', async () => {
    const { service, shop, loader, tx, notify } = setup(['t-001']);
    shop.addToCart('u1', 't-001');
    const itemsTotal = shop.getCart('u1').total;

    const res = await service.checkout('u1', customer);

    expect(res.ok).toBe(true);
    expect(res.ref).toMatch(/^FR-/);
    expect(res.orderTotal).toBe(itemsTotal + DELIVERY_FEE);
    expect(res.deliveryFee).toBe(DELIVERY_FEE);
    expect(res.customer).toEqual(customer);
    expect(tx.item.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'sold' } }),
    );
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ governorate: 'Tunis', deliveryFee: DELIVERY_FEE }),
      }),
    );
    expect(loader.reload).toHaveBeenCalledOnce();
    expect(shop.getCart('u1').lines.length).toBe(0);
    expect(notify.orderPlaced).toHaveBeenCalledOnce();
  });

  it('waives the delivery fee when the bundle rule qualifies', async () => {
    const { service, shop } = setup(['t-001'], undefined, { freeDelivery: true });
    shop.addToCart('u1', 't-001');
    const itemsTotal = shop.getCart('u1').total;

    const res = await service.checkout('u1', customer);

    expect(res.ok).toBe(true);
    expect(res.deliveryFee).toBe(0);
    expect(res.orderTotal).toBe(itemsTotal);
  });

  it('redeems a loyalty stamp: waives the delivery fee and flags the order', async () => {
    const { service, shop, tx, rewards } = setup(['t-001']);
    rewards.loyaltyStatus.mockResolvedValueOnce({ available: 1 });
    shop.addToCart('u1', 't-001');
    const itemsTotal = shop.getCart('u1').total;

    const res = await service.checkout('u1', customer);

    expect(res.ok).toBe(true);
    expect(res.deliveryFee).toBe(0);
    expect(res.loyaltyApplied).toBe(true);
    expect(res.orderTotal).toBe(itemsTotal);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ loyaltyApplied: true }) }),
    );
  });

  it('applies a referral code: discounts the buyer and records the code', async () => {
    const { service, shop, tx, rewards } = setup(['t-001']);
    rewards.validateReferral.mockResolvedValueOnce({ ok: true, code: 'FR1234ABC', discount: 5 });
    shop.addToCart('u1', 't-001');
    const itemsTotal = shop.getCart('u1').total;

    const res = await service.checkout('u1', customer, undefined, 'FR1234ABC');

    expect(res.ok).toBe(true);
    expect(res.referralDiscount).toBe(5);
    expect(res.orderTotal).toBe(itemsTotal - 5 + DELIVERY_FEE);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referredByCode: 'FR1234ABC', referralDiscount: 5 }),
      }),
    );
  });

  it('rejects an invalid referral code (no order)', async () => {
    const { service, shop, prisma, rewards } = setup(['t-001']);
    rewards.validateReferral.mockResolvedValueOnce({ ok: false, message: 'Code inconnu.' });
    shop.addToCart('u1', 't-001');
    const res = await service.checkout('u1', customer, undefined, 'BADREF');
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an unknown governorate (no transaction)', async () => {
    const { service, shop, prisma } = setup(['t-001']);
    shop.addToCart('u1', 't-001');
    const res = await service.checkout('u1', { ...customer, governorate: 'Atlantis' });
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an empty cart (no transaction)', async () => {
    const { service, prisma } = setup([]);
    const res = await service.checkout('u1', customer);
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses missing customer info (no transaction)', async () => {
    const { service, shop, prisma } = setup(['t-001']);
    shop.addToCart('u1', 't-001');
    const res = await service.checkout('u1', {
      name: '',
      email: '',
      address: '',
      phone: '',
      governorate: '',
    });
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies a valid promo: discounts the total, records it, claims one use', async () => {
    const { service, shop, tx } = setup(['t-001'], { code: 'FRIPA10', discount: 10, maxUses: 5 });
    shop.addToCart('u1', 't-001');
    const fullTotal = shop.getCart('u1').total;

    const res = await service.checkout('u1', customer, 'FRIPA10');

    expect(res.ok).toBe(true);
    expect(res.orderTotal).toBe(fullTotal - 10 + DELIVERY_FEE);
    expect(tx.promoCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { uses: { increment: 1 } } }),
    );
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discount: 10, promoCode: 'FRIPA10' }) }),
    );
  });

  it('rejects checkout when the promo code is invalid (no order)', async () => {
    const { service, shop, prisma } = setup(['t-001']); // no promo configured → validate throws
    shop.addToCart('u1', 't-001');
    const res = await service.checkout('u1', customer, 'BADCODE');
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails the order when a piece was already sold (does not mark sold), and re-syncs', async () => {
    const { service, shop, loader, tx } = setup([]); // t-001 no longer active
    shop.addToCart('u1', 't-001');

    const res = await service.checkout('u1', customer);

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/vient de partir/i);
    expect(tx.item.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(loader.reload).toHaveBeenCalledOnce(); // re-sync after the conflict
  });
});
