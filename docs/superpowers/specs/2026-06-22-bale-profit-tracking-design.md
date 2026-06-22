# Bale Profit Tracking ("Balles") — Design Spec

**Date:** 2026-06-22
**Status:** Approved, ready for implementation plan

## Goal

Group items by the wholesale **bale (balle)** they were bought in, and give the
admin a per-bale profit-and-loss view: what the bale cost, what its pieces have
sold for, the gross gain, the discounts/free-delivery that ate into it, the net
gain, and how much of the bale's cost has been recouped so far.

## Decisions (locked during brainstorming)

1. **Feature is reporting (A):** track each bale's gain; no automatic
   customer-perk engine.
2. **Cost basis = Option 1:** the bale holds the **total purchase price**; each
   member item's `cost` is **derived** = `round(totalCost ÷ memberCount)`,
   recomputed as the count changes. Solves the "unknown piece count" problem and
   keeps the per-bale P&L honest against the real price paid.
3. **Assignment = a + b:** a **Bale dropdown** on the item add/edit form (with
   inline "new bale"), plus a **bulk "assign to bale"** action in the items table.
   No CSV column for now (YAGNI).
4. **Gain = full P&L:** Gross gain → minus promos/referral/loyalty discounts
   (allocated proportionally) → minus free-delivery absorbed (estimated) → **Net
   gain**.
5. **Scope = Realized + remaining:** show realized numbers from sold pieces AND
   the unsold remainder at cost, with a **break-even / recouped %** surfaced on
   the list view, not just the detail.

## Existing model this builds on

- `Item.cost` (Int, TND) + a live margin display already exist; checkout snapshots
  each line's cost into `OrderLine.cost` (immutable past margin).
- `Order` carries `discount` (promo amount off the cart), `referralDiscount`,
  `deliveryFee` (0 when free delivery applied), `governorate`.
- `OrderLine` carries `price` (sale price snapshot) and `cost`.
- `SettingsService` holds `deliveryFee` (default) + `deliveryFees` (per-governorate
  overrides) — the source for the free-delivery estimate.
- Items are one-off (sell once), so each sold item maps to exactly one OrderLine.
- Bulk item actions already exist (`POST /admin/items/bulk`) with row checkboxes.

## Data model

New Prisma model + a nullable FK on `Item`:

```prisma
model Bale {
  id          String   @id @default(cuid())
  label       String                       // e.g. "Balle #1 – juin"
  totalCost   Int                          // TND, the price paid for the bale
  supplier    String?
  purchasedAt DateTime?
  note        String?
  createdAt   DateTime @default(now())
  items       Item[]
}
```

`Item` gains:
```prisma
  baleId String?
  bale   Bale?   @relation(fields: [baleId], references: [id])
```

Migration created via `prisma migrate diff --script` → `prisma migrate deploy` +
`prisma generate` (the `migrate dev` non-interactive workaround used previously;
stop the dev server first on Windows).

## Cost derivation (Option 1)

A single private helper `recostBale(baleId)` runs on every change to a bale's
membership or `totalCost`:

- `members = items where baleId = bale.id`
- for each member, set `Item.cost = round(totalCost / members.length)` (guard
  `length > 0`).

Triggers: create-item-into-bale, assign/unassign (single or bulk), delete a
member item, edit `totalCost`. **Sold items keep their `OrderLine.cost`
snapshot** — re-costing only affects live `Item.cost` of current members, so past
realized margin is never rewritten.

## Per-bale P&L (`BaleService`)

For a bale with members partitioned into `sold` (status `sold`) and `remaining`
(everything else, i.e. active/draft/archived counted as not-yet-realized):

- `N = members.length`, `S = sold.length`, `R = N - S`.
- **Cost** = `bale.totalCost`.
- **Realized revenue** = Σ `OrderLine.price` over sold members (join each sold
  item to its order line).
- **Cost of sold** = `round(totalCost * S / N)` (0 when `N = 0`).
- **Gross gain** = `realizedRevenue − costOfSold`.
- **Give-aways**, allocated per order by the bale's value share of that order:
  - For each order containing ≥1 sold member: `orderSubtotal = Σ OrderLine.price`
    over all of the order's lines; `baleShare = (Σ this bale's sold lines in the
    order) / orderSubtotal`.
  - **Discounts attributed** += `(order.discount + order.referralDiscount) * baleShare`.
  - **Free-delivery absorbed:** if `order.deliveryFee === 0`, the standard fee =
    `settings.deliveryFees[order.governorate] ?? settings.deliveryFee`; add
    `standardFee * baleShare` and increment a `freeDeliveryCount`. Returned as an
    **estimate** (labeled).
- **Net gain** = `grossGain − discountsAttributed − freeDeliveryAbsorbed`.
- **Remaining / break-even:**
  - `remainingCost = round(totalCost * R / N)`.
  - `potentialRevenue = Σ effectivePrice(remaining members)` (uses the shared
    `effectivePrice` helper, honoring `salePrice`).
  - `recoupedPct = totalCost > 0 ? min(100, round(realizedRevenue / totalCost * 100)) : 0`.

`BaleService.summary()` returns one lightweight row per bale (label, totalCost,
S, N, recoupedPct, netGain) for the list; `BaleService.detail(id)` returns the
full breakdown above plus the member list (id, title, status, derived cost, and
sale price for sold).

## API (behind `AdminGuard`)

- `GET /admin/bales` → summary rows.
- `GET /admin/bales/:id` → full P&L + members.
- `POST /admin/bales` `{ label, totalCost, supplier?, purchasedAt?, note? }` → create.
- `PATCH /admin/bales/:id` → edit fields (re-costs members if `totalCost` changes).
- `DELETE /admin/bales/:id` → set members' `baleId = null`, then delete the bale.
- `POST /admin/bales/:id/assign` `{ itemIds: string[] }` → assign items, re-cost
  the new bale (and any bale an item moved *out of*).
- The existing item create/update path accepts an optional `baleId`; setting it
  re-costs the affected bale(s).

## Frontend — new "Balles" tab

- **Nav:** add "Balles" to the `/admin` nav + route.
- **`AdminBales` list:** rows = label · total cost · sold/total · **recouped %
  bar** · net gain. Sortable; click → detail.
- **`AdminBaleDetail`:** the P&L card (Cost → Revenue → Gross → −discounts →
  −free delivery *(estimé)* → Net), a break-even bar (recouped vs. remaining
  cost), and the member-piece list with status + per-piece share.
- **Create bale:** small form/modal (label + total cost, optional supplier/date/note).
- **Item form:** a **Bale** select (existing bales + "+ Nouvelle balle" inline),
  sends `baleId`.
- **Bulk assign:** an "Assigner à une balle" control in the items bulk bar →
  `POST /admin/bales/:id/assign` with the checked ids.
- Warm admin tokens; responsive (tables already scroll per the recent pass).

## Edge cases

- **Item with no bale** → excluded from all bale views; existing flows unchanged.
- **`N = 0`** (empty bale) → cost-of-sold and derived cost are 0; P&L shows cost
  with 0% recouped.
- **Reassign after partial sale** → current members re-cost; sold snapshots stay;
  P&L cost stays `totalCost`. Slight average drift if `N` changes post-sale —
  acceptable; the detail view notes costs are bale-average.
- **Delete bale** → members revert to `baleId = null` (their last derived `cost`
  is left as-is, not zeroed); confirm dialog.
- **Free-delivery line** is labeled **"estimé"** (it's a delivery cost, not an
  item discount).
- Existing `margin` stats keep working unchanged (still read `Item.cost` /
  `OrderLine.cost`).

## Testing

`BaleService` unit tests (the formulas are the risk), `*.service.spec.ts` style
with mocked Prisma:
- `recostBale` sets `round(totalCost / N)` and updates on assign/unassign;
- gross gain = realized revenue − cost-of-sold;
- **proportional allocation across a multi-bale order** (one order, two bales,
  one promo) splits the discount by value share;
- free-delivery estimate uses governorate fee × share and counts the order;
- realized + remaining + `recoupedPct` math, including `totalCost = 0` and `N = 0`
  guards.
Plus an `AdminGuard` wiring test on `BaleController`, and confirmation the
existing `AdminStatsService` margin tests stay green.

## Out of scope / future

- Automatic customer perks funded by margin (the "B" option) — not now.
- CSV `bale` column on import.
- Multi-currency / supplier payment terms.
- Re-snapshotting sold items when a bale is re-costed (intentionally immutable).
