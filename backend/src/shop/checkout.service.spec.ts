import { describe, it, expect, vi } from 'vitest';
import { CheckoutService } from './checkout.service';
import { ShopService } from './shop.service';
import type { PrismaService } from './prisma.service';
import type { CatalogueLoader } from './catalogue.loader';

const customer = { name: 'Amine', email: 'amine@fripa.tn', address: 'Tunis', phone: '20123456' };

// Builds a CheckoutService over a real (in-memory) ShopService plus mocked
// Prisma + loader. `activeIds` controls which cart pieces are still sellable.
function setup(activeIds: string[]) {
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
  };
  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  } as unknown as PrismaService;
  const loader = { reload: vi.fn(async () => {}) } as unknown as CatalogueLoader;
  const service = new CheckoutService(prisma, loader, shop);
  return { service, shop, prisma, loader, tx };
}

describe('CheckoutService.checkout', () => {
  it('places the order: persists it, marks pieces sold, reloads, clears the cart', async () => {
    const { service, shop, loader, tx } = setup(['t-001']);
    shop.addToCart('u1', 't-001');

    const res = await service.checkout('u1', customer);

    expect(res.ok).toBe(true);
    expect(res.ref).toMatch(/^FR-/);
    expect(res.orderTotal).toBeGreaterThan(0);
    expect(res.customer).toEqual(customer);
    expect(tx.item.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'sold' } }),
    );
    expect(tx.order.create).toHaveBeenCalledOnce();
    expect(loader.reload).toHaveBeenCalledOnce();
    expect(shop.getCart('u1').lines.length).toBe(0);
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
    const res = await service.checkout('u1', { name: '', email: '', address: '', phone: '' });
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
