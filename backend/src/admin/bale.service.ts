import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Bale } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { SettingsService } from '../shop/settings.service';
import { effectivePrice } from '../shop/types';

export interface BaleInput {
  label: string;
  totalCost: number;
  supplier?: string | null;
  purchasedAt?: string | null;
  note?: string | null;
}

export interface BaleSummary {
  id: string;
  label: string;
  totalCost: number;
  itemCount: number;
  soldCount: number;
  recoupedPct: number;
  netGain: number;
}

export interface BaleMember {
  id: string;
  title: string;
  status: string;
  cost: number;
  soldPrice: number | null;
}

export interface BaleDetail {
  id: string;
  label: string;
  totalCost: number;
  supplier: string | null;
  purchasedAt: string | null;
  note: string | null;
  itemCount: number;
  soldCount: number;
  remainingCount: number;
  realizedRevenue: number;
  costOfSold: number;
  grossGain: number;
  discounts: number;
  freeDelivery: { count: number; estimated: number };
  netGain: number;
  remainingCost: number;
  potentialRevenue: number;
  recoupedPct: number;
  members: BaleMember[];
}

@Injectable()
export class BaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  list(): Promise<Bale[]> {
    return this.prisma.bale.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: BaleInput): Promise<Bale> {
    return this.prisma.bale.create({
      data: this.validate(input, false) as Prisma.BaleUncheckedCreateInput,
    });
  }

  async update(id: string, patch: Partial<BaleInput>): Promise<Bale> {
    await this.getOrThrow(id);
    const data = this.validate(patch, true);
    const bale = await this.prisma.bale.update({
      where: { id },
      data: data as Prisma.BaleUncheckedUpdateInput,
    });
    if ('totalCost' in data) await this.recost(id); // re-average members
    return bale;
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.getOrThrow(id);
    await this.prisma.item.updateMany({ where: { baleId: id }, data: { baleId: null } });
    await this.prisma.bale.delete({ where: { id } });
    return { ok: true };
  }

  // Assign items to this bale; re-cost the target and any bale they left.
  async assign(id: string, itemIds: string[]): Promise<{ ok: true; count: number }> {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new BadRequestException('Aucune pièce sélectionnée.');
    }
    await this.getOrThrow(id);
    const moving = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { baleId: true },
    });
    const sources = new Set(
      moving.map((m) => m.baleId).filter((b): b is string => !!b && b !== id),
    );
    const { count } = await this.prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: { baleId: id },
    });
    await this.recost(id);
    for (const b of sources) await this.recost(b);
    return { ok: true, count };
  }

  // Option-1 cost derivation: every current member's cost = round(totalCost / N).
  async recost(baleId: string | null): Promise<void> {
    if (!baleId) return;
    const bale = await this.prisma.bale.findUnique({ where: { id: baleId } });
    if (!bale) return;
    const members = await this.prisma.item.findMany({ where: { baleId }, select: { id: true } });
    if (members.length === 0) return;
    const per = Math.round(bale.totalCost / members.length);
    await this.prisma.item.updateMany({ where: { baleId }, data: { cost: per } });
  }

  async summaries(): Promise<BaleSummary[]> {
    const bales = await this.prisma.bale.findMany({ orderBy: { createdAt: 'desc' } });
    const out: BaleSummary[] = [];
    for (const b of bales) {
      const d = await this.detail(b.id);
      out.push({
        id: d.id,
        label: d.label,
        totalCost: d.totalCost,
        itemCount: d.itemCount,
        soldCount: d.soldCount,
        recoupedPct: d.recoupedPct,
        netGain: d.netGain,
      });
    }
    return out;
  }

  async detail(id: string): Promise<BaleDetail> {
    const bale = await this.getOrThrow(id);
    const members = await this.prisma.item.findMany({ where: { baleId: id } });
    const n = members.length;
    const sold = members.filter((m) => m.status === 'sold');
    const remaining = members.filter((m) => m.status !== 'sold');
    const s = sold.length;
    const soldIds = new Set(sold.map((m) => m.id));

    const orders =
      s === 0
        ? []
        : await this.prisma.order.findMany({
            where: { lines: { some: { itemId: { in: [...soldIds] } } } },
            include: { lines: true },
          });

    const config = await this.settings.get();
    let realizedRevenue = 0;
    let discounts = 0;
    let freeDeliveryEstimated = 0;
    let freeDeliveryCount = 0;
    const soldPriceById = new Map<string, number>();

    for (const order of orders) {
      const orderSubtotal = order.lines.reduce((sum, l) => sum + l.price, 0);
      const baleLines = order.lines.filter((l) => soldIds.has(l.itemId));
      const baleRevenue = baleLines.reduce((sum, l) => sum + l.price, 0);
      realizedRevenue += baleRevenue;
      for (const l of baleLines) soldPriceById.set(l.itemId, l.price);
      const share = orderSubtotal > 0 ? baleRevenue / orderSubtotal : 0;
      discounts += Math.round((order.discount + order.referralDiscount) * share);
      if (order.deliveryFee === 0) {
        const standardFee = config.deliveryFees[order.governorate] ?? config.deliveryFee;
        freeDeliveryEstimated += Math.round(standardFee * share);
        freeDeliveryCount += 1;
      }
    }

    const costOfSold = n > 0 ? Math.round((bale.totalCost * s) / n) : 0;
    const grossGain = realizedRevenue - costOfSold;
    const netGain = grossGain - discounts - freeDeliveryEstimated;
    const remainingCost = n > 0 ? Math.round((bale.totalCost * (n - s)) / n) : 0;
    const potentialRevenue = remaining.reduce((sum, m) => sum + effectivePrice(m), 0);
    const recoupedPct =
      bale.totalCost > 0 ? Math.min(100, Math.round((realizedRevenue / bale.totalCost) * 100)) : 0;

    return {
      id: bale.id,
      label: bale.label,
      totalCost: bale.totalCost,
      supplier: bale.supplier,
      purchasedAt: bale.purchasedAt ? bale.purchasedAt.toISOString() : null,
      note: bale.note,
      itemCount: n,
      soldCount: s,
      remainingCount: n - s,
      realizedRevenue,
      costOfSold,
      grossGain,
      discounts,
      freeDelivery: { count: freeDeliveryCount, estimated: freeDeliveryEstimated },
      netGain,
      remainingCost,
      potentialRevenue,
      recoupedPct,
      members: members.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        cost: m.cost,
        soldPrice: soldPriceById.get(m.id) ?? null,
      })),
    };
  }

  private async getOrThrow(id: string): Promise<Bale> {
    const bale = await this.prisma.bale.findUnique({ where: { id } });
    if (!bale) throw new NotFoundException(`Balle ${id} introuvable.`);
    return bale;
  }

  private validate(input: Partial<BaleInput>, partial: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (input.label != null) {
      if (typeof input.label !== 'string' || !input.label.trim()) {
        throw new BadRequestException('Le libellé est obligatoire.');
      }
      out.label = input.label.trim();
    } else if (!partial) {
      throw new BadRequestException('Le libellé est obligatoire.');
    }
    if (input.totalCost != null) {
      const c = input.totalCost;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) {
        throw new BadRequestException('Le coût total doit être un entier positif.');
      }
      out.totalCost = c;
    } else if (!partial) {
      throw new BadRequestException('Le coût total est obligatoire.');
    }
    if (input.supplier !== undefined) out.supplier = input.supplier ? String(input.supplier).trim() : null;
    if (input.note !== undefined) out.note = input.note ? String(input.note).trim() : null;
    if (input.purchasedAt !== undefined) {
      if (!input.purchasedAt) out.purchasedAt = null;
      else {
        const d = new Date(input.purchasedAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Date d’achat invalide.');
        out.purchasedAt = d;
      }
    }
    return out;
  }
}
