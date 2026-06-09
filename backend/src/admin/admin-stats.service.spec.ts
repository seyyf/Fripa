import { describe, it, expect, vi } from 'vitest';
import { AdminStatsService } from './admin-stats.service';
import type { PrismaService } from '../shop/prisma.service';

describe('AdminStatsService.summary', () => {
  it('aggregates item counts, orders, revenue (incl. today), and top categories', async () => {
    const now = new Date();
    const orders = [
      { total: 50, status: 'Nouvelle', paid: false, createdAt: now },
      { total: 30, status: 'Livrée', paid: true, createdAt: new Date('2020-01-01T00:00:00Z') },
    ];
    const byStatus: Record<string, number> = { active: 58, draft: 1, sold: 1, archived: 0 };
    const prisma = {
      item: {
        count: vi.fn(async (args?: any) => (args ? (byStatus[args.where.status] ?? 0) : 60)),
        groupBy: vi.fn(async () => [
          { category: 'Maillots', _count: { _all: 5 } },
          { category: 'T-shirts', _count: { _all: 20 } },
        ]),
      },
      order: { findMany: vi.fn(async () => orders) },
    } as unknown as PrismaService;

    const s = await new AdminStatsService(prisma).summary();

    expect(s.items.total).toBe(60);
    expect(s.items.active).toBe(58);
    expect(s.orders.total).toBe(2);
    expect(s.orders.revenue).toBe(80);
    expect(s.orders.today).toBe(1); // only the order created "now"
    expect(s.orders.revenueToday).toBe(50);
    expect(s.ordersByStatus.Nouvelle).toBe(1);
    expect(s.ordersByStatus.Livrée).toBe(1);
    // delivered = only the "Livrée" order (30 TND), distinct from total revenue (80)
    expect(s.delivered).toEqual({ count: 1, revenue: 30 });
    expect(s.collected).toEqual({ count: 1, revenue: 30 }); // only the paid order

    // sorted by count desc
    expect(s.topCategories[0]).toEqual({ category: 'T-shirts', count: 20 });

    // 90-day daily series; today's bucket holds the "now" order (50 TND)
    expect(s.revenueSeries).toHaveLength(90);
    expect(s.revenueSeries[89].revenue).toBe(50);
    expect(s.revenueSeries[0].revenue).toBe(0);
  });
});
