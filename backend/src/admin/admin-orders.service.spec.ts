import { describe, it, expect, vi } from 'vitest';
import { AdminOrdersService } from './admin-orders.service';
import type { PrismaService } from '../shop/prisma.service';

describe('AdminOrdersService.list', () => {
  it('returns orders newest-first, including their lines', async () => {
    const rows = [{ id: 'o1', ref: 'FR-1002', lines: [{ id: 'l1' }] }];
    const prisma = {
      order: { findMany: vi.fn(async () => rows) },
    } as unknown as PrismaService;
    const svc = new AdminOrdersService(prisma);

    const res = await svc.list();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { lines: true }, orderBy: { createdAt: 'desc' } }),
    );
    expect(res).toBe(rows);
  });
});

describe('AdminOrdersService.updateStatus', () => {
  function svcWith(update = vi.fn(async ({ data }: any) => ({ id: 'o1', ...data }))) {
    const prisma = { order: { update } } as unknown as PrismaService;
    return { svc: new AdminOrdersService(prisma), update };
  }

  it('updates a valid status', async () => {
    const { svc, update } = svcWith();
    const res = await svc.updateStatus('o1', 'Expédiée');
    expect(res.status).toBe('Expédiée');
    expect(update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'Expédiée' } });
  });

  it('rejects an invalid status (no DB write)', async () => {
    const { svc, update } = svcWith();
    await expect(svc.updateStatus('o1', 'shipped')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
