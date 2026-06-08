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
