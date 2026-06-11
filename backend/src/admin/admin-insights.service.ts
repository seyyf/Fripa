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
  // Sell-through + aging per category: what actually sells, and how fast — the
  // buying signal. rate = sold / (sold + still-listed) in %.
  sellThrough: {
    category: string;
    sold: number;
    listed: number; // active + draft (still on hand, not yet sold)
    rate: number;
    medianDaysToSell: number | null;
  }[];
  // Overall median days a sold piece spent in stock (null if nothing sold yet).
  medianDaysToSell: number | null;
}

const DAY_MS = 86400000;
const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const TOP_N = 8;

@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AdminInsights> {
    const [events, items, purchases, soldLines] = await Promise.all([
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
          createdAt: true,
        },
      }),
      this.prisma.orderLine.count(),
      // Sale dates for days-to-sell: each line + when its order was placed.
      this.prisma.orderLine.findMany({
        select: { itemId: true, order: { select: { createdAt: true, status: true } } },
      }),
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

    // Days-to-sell: earliest non-void sale date per item − its listing date.
    const itemCreated = new Map(items.map((i) => [i.id, i.createdAt]));
    const itemCategory = new Map(items.map((i) => [i.id, i.category]));
    const soldAt = new Map<string, Date>();
    for (const l of soldLines) {
      if (l.order.status === 'Annulée' || l.order.status === 'Retournée') continue;
      const cur = soldAt.get(l.itemId);
      if (!cur || l.order.createdAt < cur) soldAt.set(l.itemId, l.order.createdAt);
    }
    const daysAll: number[] = [];
    const daysByCat = new Map<string, number[]>();
    for (const [itemId, when] of soldAt) {
      const created = itemCreated.get(itemId);
      if (!created) continue;
      const days = Math.max(0, Math.round((when.getTime() - created.getTime()) / DAY_MS));
      daysAll.push(days);
      const cat = itemCategory.get(itemId) ?? '—';
      (daysByCat.get(cat) ?? daysByCat.set(cat, []).get(cat)!).push(days);
    }

    // Sell-through per category: sold / (sold + still-listed).
    const sellAgg = new Map<string, { sold: number; listed: number }>();
    for (const it of items) {
      const a = sellAgg.get(it.category) ?? { sold: 0, listed: 0 };
      if (it.status === 'sold') a.sold += 1;
      else if (it.status === 'active' || it.status === 'draft') a.listed += 1;
      sellAgg.set(it.category, a);
    }
    const sellThrough = [...sellAgg.entries()]
      .map(([category, a]) => {
        const denom = a.sold + a.listed;
        return {
          category,
          sold: a.sold,
          listed: a.listed,
          rate: denom === 0 ? 0 : Math.round((a.sold / denom) * 100),
          medianDaysToSell: median(daysByCat.get(category) ?? []),
        };
      })
      .filter((c) => c.sold + c.listed > 0)
      .sort((a, b) => b.rate - a.rate);

    return {
      totals,
      categories,
      topPassed,
      topWanted,
      abandoned,
      sellThrough,
      medianDaysToSell: median(daysAll),
    };
  }
}
