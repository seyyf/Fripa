import { describe, it, expect, vi } from 'vitest';
import { AdminCustomersService } from './admin-customers.service';
import type { PrismaService } from '../shop/prisma.service';

describe('AdminCustomersService.list', () => {
  it('groups orders by phone, sums spend, keeps the latest contact', async () => {
    // findMany returns newest-first
    const orders = [
      { id: 'o3', customerName: 'Amine B', customerPhone: '22 000', customerEmail: 'a@x.tn', customerAddress: 'Tunis 2', total: 40, createdAt: new Date('2026-02-01') },
      { id: 'o2', customerName: 'Sarra', customerPhone: '99 111', customerEmail: 's@x.tn', customerAddress: 'Sfax', total: 25, createdAt: new Date('2026-01-15') },
      { id: 'o1', customerName: 'Amine', customerPhone: '22 000', customerEmail: 'a@x.tn', customerAddress: 'Tunis 1', total: 30, createdAt: new Date('2026-01-01') },
    ];
    const prisma = { order: { findMany: vi.fn(async () => orders) } } as unknown as PrismaService;

    const res = await new AdminCustomersService(prisma).list();

    expect(res).toHaveLength(2);
    const amine = res.find((c) => c.phone === '22 000')!;
    expect(amine.orders).toBe(2);
    expect(amine.total).toBe(70);
    expect(amine.name).toBe('Amine B'); // latest order's name/address
    expect(amine.address).toBe('Tunis 2');
    // sorted by spend desc
    expect(res[0].phone).toBe('22 000');
  });
});
