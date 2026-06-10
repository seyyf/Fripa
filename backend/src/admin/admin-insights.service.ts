import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shop/prisma.service';

export interface ItemSwipeStats {
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  salePrice: number | null;
  category: string;
  status: string;
  passes: number;
  keeps: number;
  favorites: number;
  cartExpired: number;
}

export interface AdminInsights {
  // Global funnel: every recorded interaction + actual purchases.
  totals: {
    pass: number;
    keep: number;
    favorite: number;
    cartExpired: number;
    purchases: number;
  };
  // Demand per category: what shoppers keep vs. what they flick away.
  categories: {
    category: string;
    passes: number;
    keeps: number;
    favorites: number;
    keepRate: number; // (keeps + favorites) / all swipes, in % — what to restock
  }[];
  // Most-passed active pieces (price/photo probably wrong) and most-wanted ones.
  topPassed: ItemSwipeStats[];
  topWanted: ItemSwipeStats[];
  // Abandoned interest: active pieces that were carted-then-expired or
  // favorited but never bought — prime candidates for a markdown.
  abandoned: ItemSwipeStats[];
}

const TOP_N = 8;

@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AdminInsights> {
    const [events, items, purchases] = await Promise.all([
      this.prisma.swipeEvent.groupBy({
        by: ['itemId', 'action'],
        _count: { _all: true },
      }),
      this.prisma.item.findMany({
        select: {
          id: true,
          title: true,
          brand: true,
          imageUrl: true,
          price: true,
          salePrice: true,
          category: true,
          status: true,
        },
      }),
      this.prisma.orderLine.count(),
    ]);

    // Per-item counters (events for deleted items are silently dropped).
    const byItem = new Map<string, ItemSwipeStats>();
    for (const it of items) {
      byItem.set(it.id, { ...it, passes: 0, keeps: 0, favorites: 0, cartExpired: 0 });
    }
    const totals = { pass: 0, keep: 0, favorite: 0, cartExpired: 0, purchases };
    for (const e of events) {
      const n = e._count._all;
      if (e.action === 'pass') totals.pass += n;
      else if (e.action === 'keep') totals.keep += n;
      else if (e.action === 'favorite') totals.favorite += n;
      else if (e.action === 'cart_expired') totals.cartExpired += n;
      const stats = byItem.get(e.itemId);
      if (!stats) continue;
      if (e.action === 'pass') stats.passes += n;
      else if (e.action === 'keep') stats.keeps += n;
      else if (e.action === 'favorite') stats.favorites += n;
      else if (e.action === 'cart_expired') stats.cartExpired += n;
    }

    // Category demand.
    const byCat = new Map<string, { passes: number; keeps: number; favorites: number }>();
    for (const s of byItem.values()) {
      const c = byCat.get(s.category) ?? { passes: 0, keeps: 0, favorites: 0 };
      c.passes += s.passes;
      c.keeps += s.keeps;
      c.favorites += s.favorites;
      byCat.set(s.category, c);
    }
    const categories = [...byCat.entries()]
      .map(([category, c]) => {
        const swipes = c.passes + c.keeps + c.favorites;
        return {
          category,
          ...c,
          keepRate: swipes === 0 ? 0 : Math.round(((c.keeps + c.favorites) / swipes) * 100),
        };
      })
      .filter((c) => c.passes + c.keeps + c.favorites > 0)
      .sort((a, b) => b.keepRate - a.keepRate);

    const active = [...byItem.values()].filter((s) => s.status === 'active');
    const topPassed = [...active]
      .filter((s) => s.passes > 0)
      .sort((a, b) => b.passes - a.passes)
      .slice(0, TOP_N);
    const topWanted = [...active]
      .filter((s) => s.keeps + s.favorites > 0)
      .sort((a, b) => b.keeps + b.favorites - (a.keeps + a.favorites))
      .slice(0, TOP_N);
    const abandoned = [...active]
      .filter((s) => s.cartExpired > 0 || s.favorites > 0)
      .sort((a, b) => b.cartExpired + b.favorites - (a.cartExpired + a.favorites));

    return { totals, categories, topPassed, topWanted, abandoned };
  }
}
