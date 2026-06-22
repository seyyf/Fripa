# Bale Profit Tracking ("Balles") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group items by the wholesale bale they came from and give the admin a per-bale P&L: cost, realized revenue, gross gain, discounts/free-delivery given away, net gain, and recouped %.

**Architecture:** A new `Bale` model owns the purchase price; each member item's `cost` is derived (`round(totalCost ÷ count)`) and rewritten whenever membership/price changes. A `BaleService` computes the P&L on-read from `Bale` + `Item` + `OrderLine`/`Order` (+ `SettingsService` for the free-delivery estimate). New admin "Balles" tab plus a bale dropdown on the item form and a bulk-assign action.

**Tech Stack:** NestJS 10 + Prisma (SQLite), React 18 + react-router-dom, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-22-bale-profit-tracking-design.md`

---

## File Structure

**Backend — new:**
- `backend/src/admin/bale.service.ts` — Bale CRUD, `recost()`, and the P&L `compute()`/`summaries()`/`detail()`.
- `backend/src/admin/bale.service.spec.ts` — unit tests for the formulas.
- `backend/src/admin/bale.controller.ts` — guarded `/admin/bales` routes.

**Backend — modified:**
- `backend/prisma/schema.prisma` — `Bale` model + `Item.baleId`.
- `backend/src/admin/admin-items.service.ts` — accept `baleId`, re-cost affected bales on create/update.
- `backend/src/admin/admin.module.ts` — register `BaleService` + `BaleController`.

**Frontend — new:**
- `frontend/src/admin/AdminBales.tsx` — list of bales (P&L summary) + create form.
- `frontend/src/admin/AdminBaleDetail.tsx` — one bale's full P&L + member list.

**Frontend — modified:**
- `frontend/src/admin/adminApi.ts` — Bale types + methods; `baleId` on item types.
- `frontend/src/admin/ItemForm.tsx` — Bale select + inline create.
- `frontend/src/admin/AdminItems.tsx` — bulk "assign to bale".
- `frontend/src/admin/AdminApp.tsx` — nav link + routes.
- `frontend/src/admin/admin.css` — P&L card + recouped bar styles.

---

## Task 1: `Bale` model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260622120000_bale/migration.sql`

- [ ] **Step 1: Add the model + FK.** Append to `backend/prisma/schema.prisma`:
```prisma
// A wholesale lot ("balle") bought at one price. Member items derive their cost
// as totalCost / member-count; the per-bale P&L is computed on read.
model Bale {
  id          String    @id @default(cuid())
  label       String
  totalCost   Int // TND, the price paid for the bale
  supplier    String?
  purchasedAt DateTime?
  note        String?
  createdAt   DateTime  @default(now())
  items       Item[]
}
```
And inside `model Item { ... }`, add (next to `cost`):
```prisma
  baleId      String?
  bale        Bale?    @relation(fields: [baleId], references: [id])
```

- [ ] **Step 2: Stop the backend dev server** (Windows query-engine DLL lock), then generate the migration:
```bash
cd backend
mkdir -p prisma/migrations/20260622120000_bale
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260622120000_bale/migration.sql
```
Expected: SQL with `CREATE TABLE "Bale"` and an added `baleId` column on `Item` (Prisma rebuilds the Item table for SQLite — that's normal).

- [ ] **Step 3: Apply + regenerate:**
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected: migration applied; client has `prisma.bale`.

- [ ] **Step 4: Verify the client delegate:**
```bash
node -e "const{PrismaClient}=require('@prisma/client');console.log(typeof new PrismaClient().bale)"
```
Expected: `object`.

- [ ] **Step 5: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260622120000_bale/migration.sql
git commit -m "feat(bale): Bale model + Item.baleId migration"
```

---

## Task 2: `BaleService` — CRUD + cost derivation

**Files:**
- Create: `backend/src/admin/bale.service.ts`
- Test: `backend/src/admin/bale.service.spec.ts`

- [ ] **Step 1: Write the failing test** (`backend/src/admin/bale.service.spec.ts`):
```ts
import { describe, it, expect, vi } from 'vitest';
import { BaleService } from './bale.service';

describe('BaleService.recost', () => {
  it('sets every member cost to round(totalCost / count)', async () => {
    const updateMany = vi.fn(async () => ({ count: 3 }));
    const prisma = {
      bale: { findUnique: vi.fn(async () => ({ id: 'b1', totalCost: 600 })) },
      item: { findMany: vi.fn(async () => [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]) },
    } as any;
    prisma.item.updateMany = updateMany;
    await new BaleService(prisma, {} as any).recost('b1');
    expect(updateMany).toHaveBeenCalledWith({ where: { baleId: 'b1' }, data: { cost: 200 } });
  });

  it('no-ops for a null bale or an empty bale', async () => {
    const updateMany = vi.fn();
    const prisma = {
      bale: { findUnique: vi.fn(async () => ({ id: 'b1', totalCost: 600 })) },
      item: { findMany: vi.fn(async () => []), updateMany },
    } as any;
    const svc = new BaleService(prisma, {} as any);
    await svc.recost(null);
    await svc.recost('b1');
    expect(updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it (fails — no module):**
Run: `cd backend && npx vitest run src/admin/bale.service.spec.ts`
Expected: FAIL, cannot find `./bale.service`.

- [ ] **Step 3: Create the service** (`backend/src/admin/bale.service.ts`):
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Bale } from '@prisma/client';
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
    return this.prisma.bale.create({ data: this.validate(input, false) });
  }

  async update(id: string, patch: Partial<BaleInput>): Promise<Bale> {
    await this.getOrThrow(id);
    const data = this.validate(patch, true);
    const bale = await this.prisma.bale.update({ where: { id }, data });
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
```

- [ ] **Step 4: Run the test (passes):**
Run: `cd backend && npx vitest run src/admin/bale.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add backend/src/admin/bale.service.ts backend/src/admin/bale.service.spec.ts
git commit -m "feat(bale): BaleService CRUD + Option-1 cost derivation"
```

---

## Task 3: `BaleService` — P&L compute (`summaries` + `detail`)

**Files:**
- Modify: `backend/src/admin/bale.service.ts`
- Test: `backend/src/admin/bale.service.spec.ts` (add a describe block)

- [ ] **Step 1: Add the failing test** (append to the spec):
```ts
describe('BaleService.detail (P&L)', () => {
  it('computes gross/net with proportional discount + free-delivery allocation', async () => {
    // Bale b1: 600 TND, 3 members — i1 & i2 sold, i3 still active (price 200).
    const members = [
      { id: 'i1', baleId: 'b1', title: 'A', status: 'sold', cost: 200, price: 100, salePrice: null },
      { id: 'i2', baleId: 'b1', title: 'B', status: 'sold', cost: 200, price: 150, salePrice: null },
      { id: 'i3', baleId: 'b1', title: 'C', status: 'active', cost: 200, price: 200, salePrice: null },
    ];
    // o1 mixes i1 (100) with a non-bale line x1 (100); 20 promo; free delivery to Tunis.
    // o2 is just i2 (150); no discount; paid 7 delivery to Sfax.
    const orders = [
      {
        id: 'o1', discount: 20, referralDiscount: 0, deliveryFee: 0, governorate: 'Tunis',
        lines: [{ itemId: 'i1', price: 100 }, { itemId: 'x1', price: 100 }],
      },
      {
        id: 'o2', discount: 0, referralDiscount: 0, deliveryFee: 7, governorate: 'Sfax',
        lines: [{ itemId: 'i2', price: 150 }],
      },
    ];
    const prisma = {
      bale: { findUnique: async () => ({ id: 'b1', label: 'B1', totalCost: 600, supplier: null, purchasedAt: null, note: null }) },
      item: { findMany: async () => members },
      order: { findMany: async () => orders },
    } as any;
    const settings = { get: async () => ({ deliveryFee: 7, deliveryFees: { Tunis: 8 } }) } as any;

    const d = await new BaleService(prisma, settings).detail('b1');

    expect(d.itemCount).toBe(3);
    expect(d.soldCount).toBe(2);
    expect(d.realizedRevenue).toBe(250); // 100 + 150
    expect(d.costOfSold).toBe(400); // round(600 * 2/3)
    expect(d.grossGain).toBe(-150); // 250 - 400
    expect(d.discounts).toBe(10); // o1: round(20 * 100/200)
    expect(d.freeDelivery).toEqual({ count: 1, estimated: 4 }); // round(8 * 0.5)
    expect(d.netGain).toBe(-164); // -150 - 10 - 4
    expect(d.remainingCount).toBe(1);
    expect(d.remainingCost).toBe(200); // round(600 * 1/3)
    expect(d.potentialRevenue).toBe(200); // i3 effectivePrice
    expect(d.recoupedPct).toBe(42); // round(250/600*100)
    expect(d.members.find((m) => m.id === 'i1')?.soldPrice).toBe(100);
    expect(d.members.find((m) => m.id === 'i3')?.soldPrice).toBeNull();
  });
});
```

- [ ] **Step 2: Run it (fails — `detail` undefined):**
Run: `cd backend && npx vitest run src/admin/bale.service.spec.ts`
Expected: FAIL, `detail is not a function`.

- [ ] **Step 3: Implement** — add these methods to `BaleService`:
```ts
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
```

- [ ] **Step 4: Run the test (passes):**
Run: `cd backend && npx vitest run src/admin/bale.service.spec.ts`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**
```bash
git add backend/src/admin/bale.service.ts backend/src/admin/bale.service.spec.ts
git commit -m "feat(bale): per-bale P&L compute (gross/net, allocation, recouped %)"
```

---

## Task 4: Wire `baleId` into item create/update + re-cost

**Files:**
- Modify: `backend/src/admin/admin-items.service.ts`

- [ ] **Step 1: Add `baleId` to `ItemInput`** (after `publishAt?`):
```ts
  // The wholesale bale this piece belongs to (null clears it). Setting it
  // re-derives the bale's per-item cost.
  baleId?: string | null;
```

- [ ] **Step 2: Inject `BaleService`.** Update the imports + constructor:
```ts
import { BaleService } from './bale.service';
```
```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
    private readonly audit: AuditService,
    private readonly bales: BaleService,
  ) {}
```

- [ ] **Step 3: Validate `baleId`.** In `validate()`, before `return out;`:
```ts
    if (input.baleId !== undefined) {
      if (input.baleId === null) out.baleId = null;
      else if (typeof input.baleId !== 'string' || !input.baleId.trim()) {
        throw new BadRequestException('« baleId » invalide.');
      } else out.baleId = input.baleId;
    }
```

- [ ] **Step 4: Re-cost on create.** Replace the `create` method body:
```ts
  async create(input: ItemInput): Promise<Item> {
    const item = await this.createRaw(input);
    if (item.baleId) await this.bales.recost(item.baleId);
    await this.loader.reload();
    this.audit.log('item.create', item.title, `${item.price} TND · ${item.status}`);
    return item;
  }
```

- [ ] **Step 5: Re-cost on update.** Replace the `update` method:
```ts
  async update(id: string, input: Partial<ItemInput>): Promise<Item> {
    const prev = await this.getOrThrow(id);
    const data = this.validate(input, { partial: true });
    const item = await this.prisma.item.update({
      where: { id },
      data: data as Prisma.ItemUncheckedUpdateInput,
    });
    if ('baleId' in data) {
      if (prev.baleId && prev.baleId !== item.baleId) await this.bales.recost(prev.baleId);
      if (item.baleId) await this.bales.recost(item.baleId);
    }
    await this.loader.reload();
    this.audit.log('item.update', item.title, Object.keys(data).join(', '));
    return item;
  }
```

- [ ] **Step 6: Patch the existing item spec for the new constructor param.** In `backend/src/admin/admin-items.service.spec.ts` (line ~58), the helper builds the service with 3 args:
```ts
  return { svc: new AdminItemsService(prisma, loader, { log() {} } as any), prisma, loader, store };
```
Add a 4th stub (the bale service) so re-costing is a no-op in those tests:
```ts
  return { svc: new AdminItemsService(prisma, loader, { log() {} } as any, { recost: async () => {} } as any), prisma, loader, store };
```
Then run: `cd backend && npx vitest run src/admin/admin-items.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add backend/src/admin/admin-items.service.ts backend/src/admin/admin-items.service.spec.ts
git commit -m "feat(bale): item create/update accepts baleId and re-costs the bale"
```

---

## Task 5: `BaleController` + module wiring

**Files:**
- Create: `backend/src/admin/bale.controller.ts`
- Create: `backend/src/admin/bale.controller.spec.ts`
- Modify: `backend/src/admin/admin.module.ts`

- [ ] **Step 1: Write the controller** (`backend/src/admin/bale.controller.ts`):
```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { BaleService, BaleInput } from './bale.service';

@Controller('admin/bales')
@UseGuards(AdminGuard)
export class BaleController {
  constructor(private readonly bales: BaleService) {}

  @Get()
  list() {
    return this.bales.summaries();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.bales.detail(id);
  }

  @Post()
  create(@Body() body: BaleInput) {
    return this.bales.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<BaleInput>) {
    return this.bales.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bales.remove(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: { itemIds: string[] }) {
    return this.bales.assign(id, body?.itemIds);
  }
}
```

- [ ] **Step 2: Write the guard test** (`backend/src/admin/bale.controller.spec.ts`):
```ts
import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { BaleController } from './bale.controller';
import { AdminGuard } from './admin.guard';

describe('BaleController', () => {
  it('is protected by the AdminGuard', () => {
    const guards = new Reflector().get<any[]>('__guards__', BaleController) ?? [];
    expect(guards).toContain(AdminGuard);
  });

  it('delegates list to summaries()', () => {
    const rows = [{ id: 'b1' }];
    const ctrl = new BaleController({ summaries: () => rows } as any);
    expect(ctrl.list()).toBe(rows);
  });
});
```

- [ ] **Step 3: Register in `admin.module.ts`.** Add imports:
```ts
import { BaleController } from './bale.controller';
import { BaleService } from './bale.service';
```
Add `BaleController` to the `controllers` array and `BaleService` to the `providers` array.

- [ ] **Step 4: Run the new test + full backend suite:**
Run: `cd backend && npx vitest run src/admin/bale.controller.spec.ts`
Expected: PASS (2 tests).
Run: `cd backend && npm test`
Expected: all suites PASS (existing margin/items tests included).

- [ ] **Step 5: Commit**
```bash
git add backend/src/admin/bale.controller.ts backend/src/admin/bale.controller.spec.ts backend/src/admin/admin.module.ts
git commit -m "feat(bale): guarded /admin/bales endpoints + module wiring"
```

---

## Task 6: Admin API client (Bale types + methods)

**Files:**
- Modify: `frontend/src/admin/adminApi.ts`

- [ ] **Step 1: Add `baleId` to the item types.** In `AdminItem` add `baleId?: string | null;`, and in the `ItemInput` type add `baleId?: string | null;`.

- [ ] **Step 2: Add Bale types** (near the other interfaces):
```ts
export interface BaleSummary {
  id: string;
  label: string;
  totalCost: number;
  itemCount: number;
  soldCount: number;
  recoupedPct: number;
  netGain: number;
}

export interface BaleInput {
  label: string;
  totalCost: number;
  supplier?: string | null;
  purchasedAt?: string | null;
  note?: string | null;
}

export interface BaleMember {
  id: string;
  title: string;
  status: string;
  cost: number;
  soldPrice: number | null;
}

export interface BaleDetail extends BaleSummary {
  supplier: string | null;
  purchasedAt: string | null;
  note: string | null;
  remainingCount: number;
  realizedRevenue: number;
  costOfSold: number;
  grossGain: number;
  discounts: number;
  freeDelivery: { count: number; estimated: number };
  remainingCost: number;
  potentialRevenue: number;
  members: BaleMember[];
}
```

- [ ] **Step 3: Add the methods** to the `adminApi` object (after `audit`):
```ts
  listBales: () => http<BaleSummary[]>('/admin/bales'),
  getBale: (id: string) => http<BaleDetail>(`/admin/bales/${id}`),
  createBale: (input: BaleInput) =>
    http<{ id: string }>('/admin/bales', { method: 'POST', body: JSON.stringify(input) }),
  updateBale: (id: string, patch: Partial<BaleInput>) =>
    http<{ id: string }>(`/admin/bales/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteBale: (id: string) =>
    http<{ ok: true }>(`/admin/bales/${id}`, { method: 'DELETE' }),
  assignToBale: (id: string, itemIds: string[]) =>
    http<{ ok: true; count: number }>(`/admin/bales/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    }),
```

- [ ] **Step 4: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/admin/adminApi.ts
git commit -m "feat(bale): admin API client for bales + baleId on items"
```

---

## Task 7: Bale select + inline create on the item form

**Files:**
- Modify: `frontend/src/admin/ItemForm.tsx`

- [ ] **Step 1: Import the API + types.** Update the existing import from `./adminApi` to also pull `adminApi` (already imported) and add a `BaleSummary` type import:
```ts
import {
  adminApi,
  CATEGORIES,
  CONDITIONS,
  SIZES,
  STATUSES,
  type AdminItem,
  type BaleSummary,
  type ItemInput,
} from './adminApi';
```

- [ ] **Step 2: Add `baleId` to `EMPTY`** (so the form has the key):
```ts
  category: 'T-shirts',
  status: 'active',
  baleId: null,
```
And in the `initial ? {...}` prefill object add:
```ts
          status: initial.status,
          baleId: initial.baleId ?? null,
```

- [ ] **Step 3: Load bales + inline-create state.** After the existing `useState` hooks in the component, add:
```ts
  const [bales, setBales] = useState<BaleSummary[]>([]);
  const [newBale, setNewBale] = useState<{ open: boolean; label: string; cost: number }>({
    open: false,
    label: '',
    cost: 0,
  });
  useEffect(() => {
    let alive = true;
    adminApi.listBales().then((b) => alive && setBales(b)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function createBaleInline() {
    if (!newBale.label.trim() || newBale.cost <= 0) return;
    const { id } = await adminApi.createBale({ label: newBale.label.trim(), totalCost: Math.round(newBale.cost) });
    const fresh = await adminApi.listBales();
    setBales(fresh);
    set('baleId', id);
    setNewBale({ open: false, label: '', cost: 0 });
  }
```
Add `useEffect` to the React import: `import { useEffect, useState } from 'react';`

- [ ] **Step 4: Add the Bale field** to the form grid — insert this `<label>` right after the "Statut" field's closing `</label>`:
```tsx
            <label className="field">
              <span className="field__label">Balle</span>
              <select
                className="filter-input"
                value={form.baleId ?? ''}
                onChange={(e) => set('baleId', e.target.value || null)}
              >
                <option value="">— Aucune —</option>
                {bales.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              {!newBale.open ? (
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={() => setNewBale((n) => ({ ...n, open: true }))}
                >
                  + Nouvelle balle
                </button>
              ) : (
                <div className="admin-inline-bale">
                  <input
                    className="filter-input"
                    placeholder="Libellé (ex. Balle #1)"
                    value={newBale.label}
                    onChange={(e) => setNewBale((n) => ({ ...n, label: e.target.value }))}
                  />
                  <input
                    className="filter-input"
                    type="number"
                    min={1}
                    placeholder="Coût total (TND)"
                    value={newBale.cost || ''}
                    onChange={(e) => setNewBale((n) => ({ ...n, cost: e.target.valueAsNumber || 0 }))}
                  />
                  <button type="button" className="admin-btn" onClick={createBaleInline}>Créer</button>
                </div>
              )}
              {form.baleId && (
                <span className="muted">Le coût d'achat est calculé automatiquement (coût balle ÷ nb pièces).</span>
              )}
            </label>
```

- [ ] **Step 5: Add minimal styles** — append to `frontend/src/admin/admin.css`:
```css
.admin-link-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0 0;
  text-align: left;
}
.admin-inline-bale {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.admin-inline-bale .filter-input {
  flex: 1;
  min-width: 120px;
}
```

- [ ] **Step 6: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/admin/ItemForm.tsx frontend/src/admin/admin.css
git commit -m "feat(bale): bale select + inline create on the item form"
```

---

## Task 8: Bulk "assign to bale" in the items table

**Files:**
- Modify: `frontend/src/admin/AdminItems.tsx`

- [ ] **Step 1: Load bales for the dropdown.** Near the top of the component (with the other `useState`), add:
```ts
  const [bales, setBales] = useState<BaleSummary[]>([]);
  useEffect(() => {
    adminApi.listBales().then(setBales).catch(() => {});
  }, []);
```
Ensure `BaleSummary` is imported from `./adminApi` and `useEffect` from `react`.

- [ ] **Step 2: Add the assign handler** (next to the existing `bulk` function):
```ts
  async function assignToBale(baleId: string) {
    if (!baleId) return;
    const ids = [...selected];
    try {
      await adminApi.assignToBale(baleId, ids);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l’assignation.');
    }
  }
```
(`refresh` is the existing items-refresh function in `AdminItems.tsx`; `setError` is the existing error setter.)

- [ ] **Step 3: Add the control to the bulk bar.** Inside `.admin-bulkbar__actions`, after the "Archiver" button, add:
```tsx
              {bales.length > 0 && (
                <select
                  className="admin-btn admin-bulk-bale"
                  defaultValue=""
                  onChange={(e) => {
                    assignToBale(e.target.value);
                    e.currentTarget.value = '';
                  }}
                >
                  <option value="" disabled>Assigner à une balle…</option>
                  {bales.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              )}
```

- [ ] **Step 4: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/admin/AdminItems.tsx
git commit -m "feat(bale): bulk assign selected items to a bale"
```

---

## Task 9: "Balles" tab — list + detail views

**Files:**
- Create: `frontend/src/admin/AdminBales.tsx`
- Create: `frontend/src/admin/AdminBaleDetail.tsx`
- Modify: `frontend/src/admin/AdminApp.tsx`
- Modify: `frontend/src/admin/admin.css`

- [ ] **Step 1: Write the list view** (`frontend/src/admin/AdminBales.tsx`):
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, AdminAuthError, type BaleSummary } from './adminApi';

interface Props {
  onAuthError: () => void;
}

export function AdminBales({ onAuthError }: Props) {
  const nav = useNavigate();
  const [bales, setBales] = useState<BaleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', cost: 0 });

  async function load() {
    try {
      setBales(await adminApi.listBales());
    } catch (e) {
      if (e instanceof AdminAuthError) return onAuthError();
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!form.label.trim() || form.cost <= 0) return;
    try {
      await adminApi.createBale({ label: form.label.trim(), totalCost: Math.round(form.cost) });
      setForm({ label: '', cost: 0 });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création.');
    }
  }

  return (
    <section className="admin-bales">
      <div className="admin-items__head">
        <h1 className="admin-items__title">Balles</h1>
      </div>

      <div className="admin-panel admin-bale-create">
        <input
          className="filter-input"
          placeholder="Libellé (ex. Balle #1 – juin)"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        />
        <input
          className="filter-input"
          type="number"
          min={1}
          placeholder="Coût total (TND)"
          value={form.cost || ''}
          onChange={(e) => setForm((f) => ({ ...f, cost: e.target.valueAsNumber || 0 }))}
        />
        <button className="btn btn--add" onClick={create}>Créer la balle</button>
      </div>

      {error && <div className="checkout__error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Balle</th>
              <th>Coût</th>
              <th>Vendues</th>
              <th>Récupéré</th>
              <th>Gain net</th>
            </tr>
          </thead>
          <tbody>
            {bales.map((b) => (
              <tr key={b.id} className="admin-bale-row" onClick={() => nav(`/admin/bales/${b.id}`)}>
                <td>{b.label}</td>
                <td>{b.totalCost} TND</td>
                <td>{b.soldCount}/{b.itemCount}</td>
                <td>
                  <span className="admin-recoup">
                    <span className="admin-recoup__bar" style={{ width: `${b.recoupedPct}%` }} />
                    <span className="admin-recoup__val">{b.recoupedPct}%</span>
                  </span>
                </td>
                <td className={b.netGain >= 0 ? 'admin-gain-pos' : 'admin-gain-neg'}>{b.netGain} TND</td>
              </tr>
            ))}
            {bales.length === 0 && (
              <tr><td colSpan={5} className="admin-items__empty">Aucune balle pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the detail view** (`frontend/src/admin/AdminBaleDetail.tsx`):
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, AdminAuthError, type BaleDetail } from './adminApi';

interface Props {
  onAuthError: () => void;
}

const tnd = (n: number) => `${n} TND`;

export function AdminBaleDetail({ onAuthError }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [bale, setBale] = useState<BaleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    adminApi
      .getBale(id)
      .then((b) => alive && setBale(b))
      .catch((e) => {
        if (e instanceof AdminAuthError) return onAuthError();
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      });
    return () => {
      alive = false;
    };
  }, [id, onAuthError]);

  async function del() {
    if (!id || !window.confirm('Supprimer cette balle ? Les pièces seront détachées.')) return;
    await adminApi.deleteBale(id);
    nav('/admin/bales');
  }

  if (error) return <div className="admin__error">{error}</div>;
  if (!bale) return <div className="admin-boot">Chargement…</div>;

  return (
    <section className="admin-bale-detail">
      <div className="admin-items__head">
        <h1 className="admin-items__title">{bale.label}</h1>
        <div className="admin-items__head-actions">
          <button className="admin-btn" onClick={() => nav('/admin/bales')}>← Balles</button>
          <button className="admin-btn admin-btn--danger" onClick={del}>Supprimer</button>
        </div>
      </div>

      <div className="admin-panel admin-pnl">
        <div className="admin-pnl__row"><span>Coût de la balle</span><strong>{tnd(bale.totalCost)}</strong></div>
        <div className="admin-pnl__row"><span>Revenu réalisé ({bale.soldCount}/{bale.itemCount} vendues)</span><strong>{tnd(bale.realizedRevenue)}</strong></div>
        <div className="admin-pnl__row"><span>Coût des pièces vendues</span><span>−{tnd(bale.costOfSold)}</span></div>
        <div className="admin-pnl__row admin-pnl__sub"><span>Gain brut</span><strong>{tnd(bale.grossGain)}</strong></div>
        <div className="admin-pnl__row"><span>Promos / parrainage</span><span>−{tnd(bale.discounts)}</span></div>
        <div className="admin-pnl__row"><span>Livraisons offertes ({bale.freeDelivery.count}) <em>estimé</em></span><span>−{tnd(bale.freeDelivery.estimated)}</span></div>
        <div className={`admin-pnl__row admin-pnl__net ${bale.netGain >= 0 ? 'admin-gain-pos' : 'admin-gain-neg'}`}>
          <span>Gain net</span><strong>{tnd(bale.netGain)}</strong>
        </div>
      </div>

      <div className="admin-panel">
        <h3 className="admin-panel__title">Récupération</h3>
        <div className="admin-recoup admin-recoup--lg">
          <span className="admin-recoup__bar" style={{ width: `${bale.recoupedPct}%` }} />
          <span className="admin-recoup__val">{bale.recoupedPct}%</span>
        </div>
        <p className="muted">
          {bale.remainingCount} pièce(s) en stock · coût restant {tnd(bale.remainingCost)} · potentiel {tnd(bale.potentialRevenue)}.
          Les coûts par pièce sont la moyenne de la balle.
        </p>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Pièce</th><th>Statut</th><th>Coût</th><th>Vendue à</th></tr></thead>
          <tbody>
            {bale.members.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.status}</td>
                <td>{tnd(m.cost)}</td>
                <td>{m.soldPrice != null ? tnd(m.soldPrice) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add nav link + routes in `AdminApp.tsx`.** Add imports:
```ts
import { AdminBales } from './AdminBales';
import { AdminBaleDetail } from './AdminBaleDetail';
```
Add a nav link (after the "Pièces" link):
```tsx
          <NavLink to="/admin/bales" className={navClass}>
            Balles
          </NavLink>
```
Add the routes inside `<Routes>`:
```tsx
          <Route path="bales" element={<AdminBales onAuthError={logout} />} />
          <Route path="bales/:id" element={<AdminBaleDetail onAuthError={logout} />} />
```

- [ ] **Step 4: Add styles** — append to `frontend/src/admin/admin.css`:
```css
/* ---------- Bales (P&L) ---------- */
.admin-bale-create {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 14px;
}
.admin-bale-create .filter-input {
  flex: 1;
  min-width: 160px;
}
.admin-bale-row {
  cursor: pointer;
}
.admin-recoup {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 120px;
  height: 18px;
  background: var(--a-canvas);
  border-radius: 999px;
  overflow: hidden;
}
.admin-recoup--lg {
  width: 100%;
  height: 26px;
}
.admin-recoup__bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, #0f7b46, #34c77b);
}
.admin-recoup__val {
  position: relative;
  margin: 0 auto;
  font-size: 11px;
  font-weight: 800;
  color: var(--a-ink);
}
.admin-gain-pos { color: #0f7b46; font-weight: 800; }
.admin-gain-neg { color: var(--accent); font-weight: 800; }
.admin-pnl__row {
  display: flex;
  justify-content: space-between;
  padding: 9px 2px;
  border-bottom: 1px solid var(--a-line-soft);
}
.admin-pnl__row em { font-style: normal; opacity: 0.6; font-size: 11px; }
.admin-pnl__sub strong, .admin-pnl__net strong { font-family: var(--display); font-size: 18px; }
.admin-pnl__net { border-bottom: none; border-top: 2px solid var(--a-line); margin-top: 4px; }
.admin-bulk-bale { color: var(--a-ink); }
```

- [ ] **Step 5: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/admin/AdminBales.tsx frontend/src/admin/AdminBaleDetail.tsx frontend/src/admin/AdminApp.tsx frontend/src/admin/admin.css
git commit -m "feat(bale): Balles admin tab — list + P&L detail"
```

---

## Task 10: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Full backend + frontend suites.**
Run: `cd backend && npm test` → all PASS.
Run: `cd frontend && npx vitest run` → all PASS.

- [ ] **Step 2: Manual end-to-end (local).**
Start backend (`npm run start:dev`) + frontend (`npm run dev`). In `/admin`:
1. Open **Balles** → create "Balle test" with cost 600.
2. Go to **Pièces** → select 3 items → "Assigner à une balle…" → Balle test.
3. Open an assigned item → its **Coût d'achat** now shows 200 (600 ÷ 3) after save/reload.
4. Place an order for one of those items on the shopper site (with a promo if you have one).
5. Back in **Balles → Balle test**: realized revenue, gross/net gain, recouped %, and the member list reflect the sale; the free-delivery line shows "estimé".

- [ ] **Step 3: Commit (if any verification fixups were needed).**
```bash
git add -A && git commit -m "test(bale): verification fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** Bale model + `Item.baleId` (T1); Option-1 derived cost via `recost` (T2, wired in T4); P&L gross→discounts→free-delivery→net with proportional allocation (T3); realized + remaining + recouped % (T3); assignment a (item form, T7) + b (bulk, T8); Balles tab list with recouped %/net up front + detail (T9); endpoints + guard (T5); migration via diff/deploy (T1); free-delivery labeled "estimé" (T9); existing margin stats untouched (T4 keeps `Item.cost`). Covered.
- **Type consistency:** `BaleSummary`/`BaleDetail`/`BaleMember`/`BaleInput` identical between backend (T2/T3) and frontend (T6); `assignToBale(id, itemIds)` ↔ `POST :id/assign { itemIds }` (T5/T6/T8); `recost` name consistent (T2 public, called in T4); `detail`/`summaries` names match controller (T5).
- **Risk note:** the `AdminItemsService` constructor gains a 4th param — Task 4 Step 6 explicitly checks the existing spec and patches its instantiation if needed.
