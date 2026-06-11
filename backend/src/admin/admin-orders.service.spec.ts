import { describe, it, expect, vi } from 'vitest';
import { AdminOrdersService } from './admin-orders.service';
import type { PrismaService } from '../shop/prisma.service';
import type { CatalogueLoader } from '../shop/catalogue.loader';

const loader = { reload: vi.fn(async () => {}) } as unknown as CatalogueLoader;

describe('AdminOrdersService.list', () => {
  it('returns orders newest-first, including their lines', async () => {
    const rows = [{ id: 'o1', ref: 'FR-1002', lines: [{ id: 'l1' }] }];
    const prisma = { order: { findMany: vi.fn(async () => rows) } } as unknown as PrismaService;
    const res = await new AdminOrdersService(prisma, loader, { log() {} } as any).list();
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { lines: true }, orderBy: { createdAt: 'desc' } }),
    );
    expect(res).toBe(rows);
  });
});

describe('AdminOrdersService.update', () => {
  function svcWith(update = vi.fn(async ({ data }: any) => ({ id: 'o1', ...data }))) {
    const prisma = { order: { update } } as unknown as PrismaService;
    return { svc: new AdminOrdersService(prisma, loader, { log() {} } as any), update };
  }

  it('updates a valid status', async () => {
    const { svc, update } = svcWith();
    const res = await svc.update('o1', { status: 'Expédiée' });
    expect(res.status).toBe('Expédiée');
    expect(update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'Expédiée' } });
  });

  it('updates the paid flag and trims customer fields', async () => {
    const { svc, update } = svcWith();
    await svc.update('o1', { paid: true, customerPhone: '  22 000 000 ' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { paid: true, customerPhone: '22 000 000' },
    });
  });

  it('rejects an invalid status and an empty customer field (no write)', async () => {
    const { svc, update } = svcWith();
    await expect(svc.update('o1', { status: 'shipped' })).rejects.toThrow();
    await expect(svc.update('o1', { customerName: '   ' })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('AdminOrdersService.returnOrder', () => {
  it('marks the order Retournée, restocks its sold pieces, and reloads', async () => {
    const order = { id: 'o1', lines: [{ itemId: 'a' }, { itemId: 'b' }] };
    const updateMany = vi.fn();
    const update = vi.fn();
    const prisma = {
      order: {
        findUnique: vi.fn(async () => order),
        update,
        findUniqueOrThrow: vi.fn(async () => ({ id: 'o1', status: 'Retournée' })),
      },
      item: { updateMany },
      $transaction: vi.fn(async (ops: any[]) => ops),
    } as unknown as PrismaService;
    const reload = vi.fn(async () => {});
    const svc = new AdminOrdersService(prisma, { reload } as unknown as CatalogueLoader, { log() {} } as any);

    const res = await svc.returnOrder('o1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, status: 'sold' },
      data: { status: 'active' },
    });
    expect(reload).toHaveBeenCalledOnce();
    expect(res.status).toBe('Retournée');
  });

  it('throws for an unknown order', async () => {
    const prisma = { order: { findUnique: vi.fn(async () => null) } } as unknown as PrismaService;
    await expect(new AdminOrdersService(prisma, loader, { log() {} } as any).returnOrder('nope')).rejects.toThrow();
  });
});
