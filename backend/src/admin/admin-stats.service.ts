import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shop/prisma.service';
import { ITEM_STATUSES } from '../shop/types';
import { ORDER_STATUSES } from './admin-orders.service';

export interface AdminStats {
  items: { total: number } & Record<string, number>;
  orders: { total: number; revenue: number; today: number; revenueToday: number };
  // Realized sales: orders confirmed delivered (status "Livrée").
  delivered: { count: number; revenue: number };
  // Cash actually in hand: orders flagged paid (COD collected).
  collected: { count: number; revenue: number };
  // Margin = sold-line revenue − snapshotted cost. `realized` counts only
  // delivered orders; `gross` counts every placed order's lines.
  margin: { gross: number; realized: number; activeStockCost: number };
  ordersByStatus: Record<string, number>;
  topCategories: { category: string; count: number }[];
  // Daily gross revenue for the last 90 days (oldest → newest).
  revenueSeries: { date: string; revenue: number }[];
}

const SERIES_DAYS = 90;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AdminStats> {
    const [total, byStatus, orders, grouped, lines, activeCost] = await Promise.all([
      this.prisma.item.count(),
      Promise.all(
        ITEM_STATUSES.map(async (s) => [s, await this.prisma.item.count({ where: { status: s } })] as const),
      ),
      this.prisma.order.findMany({ select: { total: true, status: true, paid: true, createdAt: true } }),
      this.prisma.item.groupBy({
        by: ['category'],
        where: { status: 'active' },
        _count: { _all: true },
      }),
      // Sold-line margin needs each line's price + cost and its order's status.
      this.prisma.orderLine.findMany({
        select: { price: true, cost: true, order: { select: { status: true } } },
      }),
      this.prisma.item.aggregate({ _sum: { cost: true }, where: { status: 'active' } }),
    ]);

    const items: AdminStats['items'] = { total };
    for (const [status, count] of byStatus) items[status] = count;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todays = orders.filter((o) => o.createdAt >= startOfToday);
    const deliveredOrders = orders.filter((o) => o.status === 'Livrée');
    const collectedOrders = orders.filter((o) => o.paid);

    const ordersByStatus: Record<string, number> = {};
    for (const s of ORDER_STATUSES) ordersByStatus[s] = orders.filter((o) => o.status === s).length;

    const topCategories = grouped
      .map((g) => ({ category: g.category, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    // Margin from snapshotted line cost. Voided orders don't count toward gross.
    const VOID = new Set(['Annulée', 'Retournée']);
    let grossMargin = 0;
    let realizedMargin = 0;
    for (const l of lines) {
      const m = l.price - l.cost;
      if (!VOID.has(l.order.status)) grossMargin += m;
      if (l.order.status === 'Livrée') realizedMargin += m;
    }

    // Bucket order revenue by local day, then emit a continuous last-90-days series.
    const buckets = new Map<string, number>();
    for (const o of orders) {
      const k = dayKey(new Date(o.createdAt));
      buckets.set(k, (buckets.get(k) ?? 0) + o.total);
    }
    const revenueSeries: { date: string; revenue: number }[] = [];
    for (let i = SERIES_DAYS - 1; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      revenueSeries.push({ date: k, revenue: buckets.get(k) ?? 0 });
    }

    return {
      items,
      orders: {
        total: orders.length,
        revenue: orders.reduce((sum, o) => sum + o.total, 0),
        today: todays.length,
        revenueToday: todays.reduce((sum, o) => sum + o.total, 0),
      },
      delivered: {
        count: deliveredOrders.length,
        revenue: deliveredOrders.reduce((sum, o) => sum + o.total, 0),
      },
      collected: {
        count: collectedOrders.length,
        revenue: collectedOrders.reduce((sum, o) => sum + o.total, 0),
      },
      margin: {
        gross: grossMargin,
        realized: realizedMargin,
        activeStockCost: activeCost._sum.cost ?? 0,
      },
      ordersByStatus,
      topCategories,
      revenueSeries,
    };
  }
}
