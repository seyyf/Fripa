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
  ordersByStatus: Record<string, number>;
  topCategories: { category: string; count: number }[];
}

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AdminStats> {
    const [total, byStatus, orders, grouped] = await Promise.all([
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
      ordersByStatus,
      topCategories,
    };
  }
}
