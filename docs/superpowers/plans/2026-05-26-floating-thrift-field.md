# Fripa — La fripa flottante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Fripa's one-card swipe selection with a mobile-first field of blurry rounded clothing boxes that drift, sharpen on tap/hover to reveal the piece, and get snatched by a simulated crowd — reusing the existing 90%-gone / "Dernière chance" dice.

**Architecture:** Hybrid rendering. Clothing boxes are DOM `<img>` elements animated by framer-motion; a Three.js particle layer drifts behind them (downgradable). A new batch endpoint `GET /api/items/field` feeds a client-side deck; a phantom-crowd timer periodically calls the existing `pass` endpoint to snatch un-grabbed boxes. The scarcity business logic in `shop.service.ts` is preserved untouched in spirit (same probability constants, same per-user state sets).

**Tech Stack:** React 18 + Vite + framer-motion (existing), Three.js (new), NestJS 10 (existing), Vitest + Testing Library (new test infra).

**Spec:** `docs/superpowers/specs/2026-05-26-floating-thrift-design.md`

**Domain docs:** `CONTEXT.md` (glossary — Pass vs Snatch, Reprise, Stock-refresh, etc.), [ADR-0001](../../adr/0001-pass-vs-snatch-naming.md) (pass/snatch naming split), [ADR-0002](../../adr/0002-preserve-cart-on-stock-refresh.md) (preserve cart on stock-refresh).

**Decisions resolved during the grill-with-docs session (2026-05-28):**
1. **Reprise items are snatchable.** No safety filter in `pickSnatchTarget`. Brutal-fripa feel — a Dernière chance ribbon may flash and vanish.
2. **`pass` = mechanism, `snatch` = trigger** ([ADR-0001](../../adr/0001-pass-vs-snatch-naming.md)). Frontend exposes `api.snatch(itemId)`. Route stays `/api/swipes/pass`.
3. **Tap-on-another-box = focus swap.** `FloatingBox` MUST `e.stopPropagation()` on the outer `motion.button` click. Without it, React 18 batching makes the field's background-dismiss handler clobber the new focus state — a bug the original plan's prose mis-described.
4. **↩ Reposer = just unfocus.** Same effect as empty-space tap. The button is a thumb-reachable affordance, not a separate semantic.
5. **Stock-refresh preserves the cart** ([ADR-0002](../../adr/0002-preserve-cart-on-stock-refresh.md)). New backend method `resetSwipes`, new route, new `EmptyState` CTA.

---

## File Structure

**Backend (`backend/`):**
- `src/shop/items.data.ts` — MODIFY: keep 16 curated items, add a generator producing ~44 more (60 total).
- `src/shop/shop.service.ts` — MODIFY: add `getField`, add injectable `rng`, remove `getNext`, add `resetSwipes` (ADR-0002).
- `src/shop/shop.controller.ts` — MODIFY: add `GET items/field`, remove `GET items/next`, add `POST session/:userId/reset-swipes`.
- `src/shop/types.ts` — MODIFY: replace `NextItemResponse` with `FieldResponse`.
- `src/shop/shop.service.spec.ts` — CREATE: unit tests for dice + `getField` + `resetSwipes`.
- `vitest.config.ts` — CREATE: node test config.

**Frontend (`frontend/`):**
- `src/types.ts` — MODIFY: replace `NextItemResponse` with `FieldItem` + `FieldResponse`.
- `src/api.ts` — MODIFY: replace `next()` with `field(count)`; rename `pass` → `snatch` (ADR-0001); add `resetSwipes`.
- `src/field/fieldLayout.ts` — CREATE: pure placement helpers + `FieldBox` type.
- `src/field/pickSnatchTarget.ts` — CREATE: pure snatch-selection function.
- `src/field/usePhantomCrowd.ts` — CREATE: snatch-timer hook.
- `src/components/FloatingBox.tsx` — CREATE: one box (idle drift, reveal, grab); outer click MUST `stopPropagation` for focus swap.
- `src/components/AmbientLayer.tsx` — CREATE: Three.js particle backdrop.
- `src/components/FloatingField.tsx` — CREATE: the stage (renders boxes + ambient + crowd).
- `src/components/SwipeCard.tsx` — DELETE.
- `src/App.tsx` — MODIFY: own the deck/boxes/top-up, wire field ↔ cart, expose `stockRefresh` + `hardReset`.
- `src/components/Cart.tsx` — MODIFY: update one swipe-era copy line.
- `src/components/EmptyState.tsx` — MODIFY: dual CTA (stock-refresh primary, hard-reset secondary) per ADR-0002.
- `src/App.css` — MODIFY: add field/box/reveal/last-chance/perf-toggle styles + `.btn--ghost`.
- `src/field/fieldLayout.test.ts`, `src/field/pickSnatchTarget.test.ts`, `src/field/usePhantomCrowd.test.ts`, `src/components/FloatingBox.test.tsx` — CREATE.
- `vitest.config.ts`, `src/test/setup.ts` — CREATE.

---

## Task 0: Initialize git repository

This folder is not a git repo yet; the TDD tasks below commit frequently.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
.superpowers/
*.log
.DS_Store
```

- [ ] **Step 2: Init and make the baseline commit**

```bash
git init
git add .gitignore backend frontend README.md docs
git commit -m "chore: baseline before floating-field redesign"
```

Expected: a repo with one commit. `git status` shows a clean tree (node_modules ignored).

---

## Task 1: Backend test infra + lock the pass dice

Make `shop.service.ts`'s randomness injectable so the 90/10 dice is testable, and add Vitest.

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Modify: `backend/tsconfig.json` (exclude spec files from `nest build`)
- Modify: `backend/src/shop/shop.service.ts:21-23` (add `rng`), `:90` (use `this.rng`)
- Create: `backend/src/shop/shop.service.spec.ts`

- [ ] **Step 1: Install Vitest**

Run (in `backend/`):
```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `backend/package.json`**

In the `"scripts"` block, add:
```json
    "test": "vitest run"
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 4: Exclude spec files from the Nest build**

In `backend/tsconfig.json`, change the `"exclude"` array to:
```json
  "exclude": ["node_modules", "dist", "src/**/*.spec.ts"]
```

- [ ] **Step 5: Make randomness injectable in `shop.service.ts`**

In `backend/src/shop/shop.service.ts`, inside the class right after `private states = new Map<string, UserState>();` add:
```ts
  // Injectable randomness so the 90/10 dice and field shuffle are testable.
  private rng: () => number = Math.random;
```

Then in `pass(...)`, change the dice line from:
```ts
    if (Math.random() < LAST_CHANCE_PROBABILITY) {
```
to:
```ts
    if (this.rng() < LAST_CHANCE_PROBABILITY) {
```

- [ ] **Step 6: Write the failing test for the dice**

Create `backend/src/shop/shop.service.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ShopService } from './shop.service';

function withRng(value: number): ShopService {
  const s = new ShopService();
  (s as unknown as { rng: () => number }).rng = () => value;
  return s;
}

describe('ShopService.pass dice', () => {
  it('keeps the item for a reprise when the roll is below 0.1', () => {
    const s = withRng(0.05);
    const res = s.pass('u1', 't-001');
    expect(res).toEqual({ gone: false, eligibleForReprise: true });
  });

  it('drops the item forever when the roll is at/above 0.1', () => {
    const s = withRng(0.5);
    const res = s.pass('u1', 't-001');
    expect(res).toEqual({ gone: true });
  });
});
```

- [ ] **Step 7: Run the test to verify it passes**

Run (in `backend/`):
```bash
npm test
```
Expected: 2 passing tests (the `rng` refactor makes the dice deterministic).

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/vitest.config.ts backend/tsconfig.json backend/src/shop/shop.service.ts backend/src/shop/shop.service.spec.ts backend/package-lock.json
git commit -m "test: add vitest and lock pass dice via injectable rng"
```

---

## Task 2: Expand the catalog to ~60 items

**Files:**
- Modify: `backend/src/shop/items.data.ts`

- [ ] **Step 1: Rename the curated array and append a generator**

In `backend/src/shop/items.data.ts`, rename the existing `export const ITEMS` to `const CURATED` (keep all 16 entries unchanged), then at the bottom of the file add:

```ts
// --- Generated filler stock so the floating field has real variety. ---
// Deterministic combinations of brands, garment types, colours, sizes and
// Tunisian sellers. Swap for real inventory later (stable picsum seeds).
const BRANDS = [
  'Nike', 'Adidas', 'Puma', "Levi's", 'Carhartt', 'Lacoste',
  'Fila', 'Kappa', 'Umbro', 'Reebok', 'Diadora', 'Sergio Tacchini',
];
const TYPES: { t: string; c: TShirt['condition'] }[] = [
  { t: 'Sweat à capuche', c: 'Comme neuf' },
  { t: 'T-shirt vintage', c: 'Vintage' },
  { t: 'Polo piqué', c: 'Très bon état' },
  { t: 'Veste coupe-vent', c: 'Bon état' },
  { t: 'Maillot rétro', c: 'Vintage' },
  { t: 'Crewneck molleton', c: 'Comme neuf' },
];
const COLORS = [
  'Noir', 'Blanc cassé', 'Bleu marine', 'Rouge',
  'Vert bouteille', 'Beige', 'Gris chiné', 'Bordeaux',
];
const SIZES: TShirt['size'][] = ['S', 'M', 'L', 'XL', 'XXL'];
const SELLERS = [
  'Souk El Jemaa, Tunis', 'Fripa Sfax', 'Bab El Falla', 'Fripa La Marsa',
  'Sousse Médina', 'Fripa Bardo', 'Fripa Ariana', 'Fripa Menzah',
  'Fripa Lac 2', 'Fripa Hammamet', 'Fripa Kram', 'Bab Jedid',
];

function generateItems(n: number): TShirt[] {
  const out: TShirt[] = [];
  for (let i = 0; i < n; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const type = TYPES[i % TYPES.length];
    const color = COLORS[i % COLORS.length];
    const size = SIZES[i % SIZES.length];
    const seller = SELLERS[i % SELLERS.length];
    const id = `g-${String(i + 1).padStart(3, '0')}`;
    out.push({
      id,
      title: `${brand} ${type.t}`,
      description: `${type.t} ${brand}, coloris ${color.toLowerCase()}. Pièce chinée, prête à repartir.`,
      imageUrl: img(`fripa-${id}`),
      price: 15 + ((i * 7) % 50),
      size,
      brand,
      condition: type.c,
      color,
      seller,
    });
  }
  return out;
}

export const ITEMS: TShirt[] = [...CURATED, ...generateItems(44)];
```

- [ ] **Step 2: Verify it compiles and counts 60**

Run (in `backend/`):
```bash
npx tsc --noEmit -p tsconfig.json
node -e "require('ts-node/register'); console.log(require('./src/shop/items.data').ITEMS.length)"
```
Expected: no type errors; prints `60`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/shop/items.data.ts
git commit -m "feat: expand catalog to 60 items for the floating field"
```

---

## Task 3: Add `getField` to ShopService (TDD)

**Files:**
- Modify: `backend/src/shop/types.ts`
- Modify: `backend/src/shop/shop.service.ts`
- Modify: `backend/src/shop/shop.service.spec.ts`

- [ ] **Step 1: Replace the response type**

In `backend/src/shop/types.ts`, delete the `NextItemResponse` interface and add:
```ts
export interface FieldResponse {
  items: (TShirt & { lastChance: boolean })[];
  remaining: number;
}
```

- [ ] **Step 2: Write the failing tests for `getField`**

Append to `backend/src/shop/shop.service.spec.ts`:
```ts
describe('ShopService.getField', () => {
  it('returns at most `count` items, none of them in the cart', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const res = s.getField('u1', 5);
    expect(res.items.length).toBeLessThanOrEqual(5);
    expect(res.items.some((i) => i.id === 't-001')).toBe(false);
    expect(res.items.every((i) => i.lastChance === false)).toBe(true);
  });

  it('excludes passed items', () => {
    const s = new ShopService();
    (s as unknown as { rng: () => number }).rng = () => 0.9; // force "gone"
    s.pass('u1', 't-002');
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-002')).toBe(false);
  });

  it('surfaces a last-chance reprise when the roll is below the surface rate', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    store.rng = () => 0.05; // < 0.1 → t-003 enters the last-chance pool
    s.pass('u1', 't-003');
    store.rng = () => 0.1; // < 0.2 surface rate → reprise surfaces
    const res = s.getField('u1', 60);
    const reprise = res.items.find((i) => i.id === 't-003');
    expect(reprise).toBeDefined();
    expect(reprise!.lastChance).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (in `backend/`): `npm test`
Expected: FAIL — `getField` is not a function on `ShopService`.

- [ ] **Step 4: Implement `getField` + `shuffle`**

In `backend/src/shop/shop.service.ts`, update the import line to drop `NextItemResponse` and add `FieldResponse`:
```ts
import { CartLine, FieldResponse, TShirt } from './types';
```
Delete the entire `getNext(userId: string): NextItemResponse { ... }` method. Then add these two methods to the class:
```ts
  getField(userId: string, count: number): FieldResponse {
    const s = this.getState(userId);

    const fresh = ITEMS.filter(
      (i) =>
        !s.passed.has(i.id) &&
        !s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        !s.cart.has(i.id),
    );
    const reprise = ITEMS.filter(
      (i) => s.lastChancePool.has(i.id) && !s.shownLastChance.has(i.id),
    );

    const items: (TShirt & { lastChance: boolean })[] = [];

    // Occasionally sneak one last-chance reprise into the batch.
    if (reprise.length > 0 && this.rng() < LAST_CHANCE_SURFACE_RATE) {
      const chosen = reprise[Math.floor(this.rng() * reprise.length)];
      s.lastChancePool.delete(chosen.id);
      s.shownLastChance.add(chosen.id);
      items.push({ ...chosen, lastChance: true });
    }

    for (const item of this.shuffle([...fresh])) {
      if (items.length >= count) break;
      items.push({ ...item, lastChance: false });
    }

    const remaining = fresh.length + reprise.length - items.length;
    return { items, remaining: Math.max(0, remaining) };
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (in `backend/`): `npm test`
Expected: all tests pass (5 total).

- [ ] **Step 6: Commit**

```bash
git add backend/src/shop/types.ts backend/src/shop/shop.service.ts backend/src/shop/shop.service.spec.ts
git commit -m "feat: add getField batch endpoint logic, remove getNext"
```

---

## Task 4: Wire the `items/field` route, remove `items/next`

**Files:**
- Modify: `backend/src/shop/shop.controller.ts`

- [ ] **Step 1: Replace the route**

In `backend/src/shop/shop.controller.ts`, replace the `next(...)` handler:
```ts
  @Get('items/next')
  next(@Query('userId') userId: string) {
    return this.shop.getNext(userId || 'anon');
  }
```
with:
```ts
  @Get('items/field')
  field(@Query('userId') userId: string, @Query('count') count?: string) {
    const n = Math.min(Math.max(parseInt(count ?? '12', 10) || 12, 1), 60);
    return this.shop.getField(userId || 'anon', n);
  }
```

- [ ] **Step 2: Verify the backend builds and serves the new route**

Run (in `backend/`):
```bash
npm run build
```
Expected: build succeeds with no reference to `getNext`.

Then start it (`npm run start:dev`) and in another shell:
```bash
curl "http://localhost:3001/api/items/field?userId=demo&count=4"
```
Expected: JSON `{ "items": [ ...4 items each with lastChance:false... ], "remaining": <number> }`. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add backend/src/shop/shop.controller.ts
git commit -m "feat: expose GET /api/items/field, remove /api/items/next"
```

---

## Task 4b: Backend `resetSwipes` for stock-refresh

Background: see [ADR-0002](../../adr/0002-preserve-cart-on-stock-refresh.md). Exhaustion is a routine event in this UI (~5 min per session); destroying the cart at that moment would force the user to checkout or lose work. We add a second reset path that clears swipe history only.

**Files:**
- Modify: `backend/src/shop/shop.service.ts` (add `resetSwipes`)
- Modify: `backend/src/shop/shop.controller.ts` (add `POST session/:userId/reset-swipes`)
- Modify: `backend/src/shop/shop.service.spec.ts` (cover the new method)

- [ ] **Step 1: Write the failing test**

Append to `backend/src/shop/shop.service.spec.ts`:
```ts
describe('ShopService.resetSwipes', () => {
  it('clears swipe history but preserves the cart', () => {
    const s = new ShopService();
    const store = s as unknown as { rng: () => number };
    store.rng = () => 0.5; // force "gone"
    s.pass('u1', 't-001');
    store.rng = () => 0.05; // force reprise
    s.pass('u1', 't-002');
    s.addToCart('u1', 't-003');

    s.resetSwipes('u1');

    const cart = s.getCart('u1');
    expect(cart.lines.some((l) => l.id === 't-003')).toBe(true);

    // t-001 was "gone forever"; after resetSwipes it should be eligible again.
    const res = s.getField('u1', 60);
    expect(res.items.some((i) => i.id === 't-001')).toBe(true);
    // No reprise ribbons surface — lastChancePool was also cleared.
    expect(res.items.every((i) => i.lastChance === false)).toBe(true);
  });
});
```

Run (in `backend/`): `npm test`
Expected: FAIL — `resetSwipes` is not a function.

- [ ] **Step 2: Implement `resetSwipes`**

In `backend/src/shop/shop.service.ts`, add this method to the class (next to `reset`):
```ts
  // Stock-refresh: keep the curated cart, wipe everything the swipe loop has
  // touched. See docs/adr/0002-preserve-cart-on-stock-refresh.md.
  resetSwipes(userId: string) {
    const s = this.getState(userId);
    s.passed.clear();
    s.lastChancePool.clear();
    s.shownLastChance.clear();
    return { ok: true };
  }
```

Run: `npm test` — all tests pass.

- [ ] **Step 3: Expose the route**

In `backend/src/shop/shop.controller.ts`, add a handler next to the existing reset:
```ts
  @Post('session/:userId/reset-swipes')
  resetSwipes(@Param('userId') userId: string) {
    return this.shop.resetSwipes(userId);
  }
```

- [ ] **Step 4: Smoke check**

Run (in `backend/`): `npm run build`, then start the dev server and:
```bash
curl -X POST "http://localhost:3001/api/session/demo/reset-swipes"
```
Expected: `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shop/shop.service.ts backend/src/shop/shop.controller.ts backend/src/shop/shop.service.spec.ts
git commit -m "feat: resetSwipes endpoint preserves cart on stock-refresh"
```

---

## Task 5: Frontend types + API client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Update `frontend/src/types.ts`**

Delete the `NextItemResponse` interface and add:
```ts
export interface FieldItem extends TShirt {
  lastChance: boolean;
}

export interface FieldResponse {
  items: FieldItem[];
  remaining: number;
}
```

- [ ] **Step 2: Update `frontend/src/api.ts`**

Change the import line to:
```ts
import type { CartResponse, FieldResponse } from './types';
```
Then replace the `next:` entry in the `api` object:
```ts
  next: () => http<NextItemResponse>(`/items/next?userId=${userId()}`),
```
with:
```ts
  field: (count: number) =>
    http<FieldResponse>(`/items/field?userId=${userId()}&count=${count}`),
```

Also rename the existing `pass:` entry to `snatch:` (the floating-field UI only ever fires this from the phantom-crowd handler, never from a user action — see [ADR-0001](../../adr/0001-pass-vs-snatch-naming.md)). Find:
```ts
  pass: (itemId: string) =>
    http<{ gone: boolean }>(`/swipes/pass`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
```
and replace with:
```ts
  // Narrative trigger: the phantom crowd "snatches" a box off the field.
  // Hits the unchanged /api/swipes/pass route which still rolls the 90/10 dice.
  snatch: (itemId: string) =>
    http<{ gone: boolean }>(`/swipes/pass`, {
      method: 'POST',
      body: JSON.stringify({ userId: userId(), itemId }),
    }),
```

And add a `resetSwipes` entry next to the existing `reset` entry (see Task 4b for the backend route, and [ADR-0002](../../adr/0002-preserve-cart-on-stock-refresh.md) for the why):
```ts
  resetSwipes: () =>
    http<{ ok: boolean }>(`/session/${userId()}/reset-swipes`, { method: 'POST' }),
```

- [ ] **Step 3: Verify types compile**

Run (in `frontend/`): `npx tsc --noEmit`
Expected: errors ONLY in `App.tsx` / `SwipeCard.tsx` that still reference `api.next` / `NextItemResponse` (fixed in later tasks). No errors in `types.ts` or `api.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts
git commit -m "feat: frontend field types and api.field client"
```

---

## Task 6: Frontend test infra + Three.js dependency

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Modify: `frontend/tsconfig.json` (exclude tests from `tsc -b` build)

- [ ] **Step 1: Install dependencies**

Run (in `frontend/`):
```bash
npm install three
npm install -D @types/three vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add the test script to `frontend/package.json`**

In `"scripts"`, add:
```json
    "test": "vitest run"
```

- [ ] **Step 3: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Create `frontend/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Keep test files out of the production build**

In `frontend/tsconfig.json`, add an `"exclude"` key (sibling of `"include"`):
```json
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"],
```

- [ ] **Step 6: Smoke-test the runner**

Create `frontend/src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest runs', () => {
  it('adds', () => {
    expect(1 + 1).toBe(2);
  });
});
```
Run (in `frontend/`): `npm test`
Expected: 1 passing test. Then delete the smoke file: `rm src/test/smoke.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/tsconfig.json
git commit -m "chore: add three.js and vitest + testing-library to frontend"
```

---

## Task 7: `pickSnatchTarget` + `usePhantomCrowd` (TDD)

**Files:**
- Create: `frontend/src/field/pickSnatchTarget.ts`
- Create: `frontend/src/field/pickSnatchTarget.test.ts`
- Create: `frontend/src/field/usePhantomCrowd.ts`
- Create: `frontend/src/field/usePhantomCrowd.test.ts`

- [ ] **Step 1: Write the failing test for `pickSnatchTarget`**

Create `frontend/src/field/pickSnatchTarget.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickSnatchTarget } from './pickSnatchTarget';

describe('pickSnatchTarget', () => {
  it('returns null when the field is at or below the minimum size', () => {
    expect(pickSnatchTarget(['a', 'b'], null, 2, () => 0)).toBeNull();
  });

  it('never picks the focused box', () => {
    const target = pickSnatchTarget(['a', 'b', 'c'], 'a', 1, () => 0);
    expect(target).not.toBe('a');
    expect(['b', 'c']).toContain(target);
  });

  it('picks deterministically from candidates using rng', () => {
    // rng=0.99 → last candidate; candidates after removing focused 'b' = [a, c]
    expect(pickSnatchTarget(['a', 'b', 'c'], 'b', 1, () => 0.99)).toBe('c');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (in `frontend/`): `npm test -- pickSnatchTarget`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pickSnatchTarget`**

Create `frontend/src/field/pickSnatchTarget.ts`:
```ts
// Picks which box a phantom shopper grabs. Pure so it can be tested without
// timers. Returns null when the field is too small or only the focused box
// remains — we never snatch the box the user is currently looking at.
export function pickSnatchTarget(
  boxKeys: string[],
  focusedKey: string | null,
  minFieldSize: number,
  rng: () => number = Math.random,
): string | null {
  if (boxKeys.length <= minFieldSize) return null;
  const candidates = boxKeys.filter((k) => k !== focusedKey);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}
```

- [ ] **Step 4: Run to verify it passes**

Run (in `frontend/`): `npm test -- pickSnatchTarget`
Expected: 3 passing tests.

- [ ] **Step 5: Write the failing test for `usePhantomCrowd`**

Create `frontend/src/field/usePhantomCrowd.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhantomCrowd } from './usePhantomCrowd';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePhantomCrowd', () => {
  it('snatches a non-focused box after the interval elapses', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        boxKeys: ['a', 'b', 'c'],
        focusedKey: 'a',
        minFieldSize: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0, // first candidate after removing focused 'a' = 'b'
      }),
    );
    expect(onSnatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSnatch).toHaveBeenCalledWith('b');
  });

  it('does not snatch when the field is at the minimum size', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        boxKeys: ['a'],
        focusedKey: null,
        minFieldSize: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0,
      }),
    );
    vi.advanceTimersByTime(3000);
    expect(onSnatch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run (in `frontend/`): `npm test -- usePhantomCrowd`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `usePhantomCrowd`**

Create `frontend/src/field/usePhantomCrowd.ts`:
```ts
import { useEffect, useRef } from 'react';
import { pickSnatchTarget } from './pickSnatchTarget';

export interface PhantomCrowdOptions {
  boxKeys: string[];
  focusedKey: string | null;
  minFieldSize: number;
  minInterval: number;
  maxInterval: number;
  onSnatch: (boxKey: string) => void;
  rng?: () => number;
}

// Drives the "other shoppers" pressure: on a randomised interval it grabs one
// un-focused box and reports it via onSnatch. Reads live state through refs so
// the running timer always sees the current field without resetting.
export function usePhantomCrowd(opts: PhantomCrowdOptions): void {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const o = ref.current;
      const rng = o.rng ?? Math.random;
      const target = pickSnatchTarget(o.boxKeys, o.focusedKey, o.minFieldSize, rng);
      if (target) o.onSnatch(target);
      schedule();
    };

    const schedule = () => {
      const o = ref.current;
      const span = Math.max(0, o.maxInterval - o.minInterval);
      const delay = o.minInterval + (o.rng ?? Math.random)() * span;
      timer = setTimeout(tick, delay);
    };

    schedule();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 8: Run to verify it passes**

Run (in `frontend/`): `npm test -- usePhantomCrowd`
Expected: 2 passing tests.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/field/pickSnatchTarget.ts frontend/src/field/pickSnatchTarget.test.ts frontend/src/field/usePhantomCrowd.ts frontend/src/field/usePhantomCrowd.test.ts
git commit -m "feat: phantom-crowd snatch logic and hook (TDD)"
```

---

## Task 8: Field layout helpers (TDD)

**Files:**
- Create: `frontend/src/field/fieldLayout.ts`
- Create: `frontend/src/field/fieldLayout.test.ts`

> Naming note: the spec called this `useFieldLayout.ts`; we use a pure module `fieldLayout.ts` instead (no React state needed → easier to test). Positions are percentages so the field needs no measurement.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/field/fieldLayout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { placeBox, X_MIN, X_MAX, Y_MIN, Y_MAX } from './fieldLayout';

describe('placeBox', () => {
  it('keeps positions inside the field margins', () => {
    for (let i = 0; i < 50; i++) {
      const p = placeBox(Math.random);
      expect(p.xPct).toBeGreaterThanOrEqual(X_MIN);
      expect(p.xPct).toBeLessThanOrEqual(X_MAX);
      expect(p.yPct).toBeGreaterThanOrEqual(Y_MIN);
      expect(p.yPct).toBeLessThanOrEqual(Y_MAX);
    }
  });

  it('produces a scale within the configured band', () => {
    const p = placeBox(() => 0.5);
    expect(p.scale).toBeGreaterThanOrEqual(0.85);
    expect(p.scale).toBeLessThanOrEqual(1.15);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (in `frontend/`): `npm test -- fieldLayout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `fieldLayout.ts`**

Create `frontend/src/field/fieldLayout.ts`:
```ts
import type { FieldItem } from '../types';

export const X_MIN = 6;
export const X_MAX = 82;
export const Y_MIN = 6;
export const Y_MAX = 80;

export interface Placement {
  xPct: number;
  yPct: number;
  scale: number;
  driftSeed: number;
}

// A box instance living in the field. `boxKey` is unique per mount so framer
// AnimatePresence keeps a leaving box stable even if the same item recycles.
export interface FieldBox extends Placement {
  boxKey: string;
  item: FieldItem;
}

function between(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

export function placeBox(rng: () => number = Math.random): Placement {
  return {
    xPct: between(X_MIN, X_MAX, rng),
    yPct: between(Y_MIN, Y_MAX, rng),
    scale: between(0.85, 1.15, rng),
    driftSeed: rng() * Math.PI * 2,
  };
}

let counter = 0;
export function makeBox(item: FieldItem, rng: () => number = Math.random): FieldBox {
  counter += 1;
  return { boxKey: `${item.id}-${counter}`, item, ...placeBox(rng) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run (in `frontend/`): `npm test -- fieldLayout`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/field/fieldLayout.ts frontend/src/field/fieldLayout.test.ts
git commit -m "feat: field layout placement helpers (TDD)"
```

---

## Task 9: `FloatingBox` component (TDD for interaction)

**Files:**
- Create: `frontend/src/components/FloatingBox.tsx`
- Create: `frontend/src/components/FloatingBox.test.tsx`

- [ ] **Step 1: Write the failing interaction tests**

Create `frontend/src/components/FloatingBox.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingBox } from './FloatingBox';
import type { FieldBox } from '../field/fieldLayout';

const box: FieldBox = {
  boxKey: 'g-001-1',
  xPct: 20,
  yPct: 30,
  scale: 1,
  driftSeed: 0.5,
  item: {
    id: 'g-001',
    title: 'Nike Sweat à capuche',
    description: 'desc',
    imageUrl: 'https://example.test/x.jpg',
    price: 22,
    size: 'M',
    brand: 'Nike',
    condition: 'Comme neuf',
    color: 'Noir',
    seller: 'Fripa Sfax',
    lastChance: false,
  },
};

function noop() {}

describe('FloatingBox', () => {
  it('reveals on click when not focused', async () => {
    const onReveal = vi.fn();
    render(
      <FloatingBox box={box} focused={false} reducedMotion onReveal={onReveal} onDismiss={noop} onGrab={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Nike Sweat à capuche/i }));
    expect(onReveal).toHaveBeenCalledWith('g-001-1');
  });

  it('shows the grab button and price when focused, and grabs', async () => {
    const onGrab = vi.fn();
    render(
      <FloatingBox box={box} focused reducedMotion onReveal={noop} onDismiss={noop} onGrab={onGrab} />,
    );
    expect(screen.getByText(/22 TND/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    expect(onGrab).toHaveBeenCalledWith(box);
  });

  it('does not bubble the click to a wrapping background handler (focus swap)', async () => {
    // Simulates the FloatingField wrapper: tapping an unfocused box must
    // call onReveal but NOT the background's dismiss handler. Without
    // stopPropagation, React 18 batching makes the dismiss win.
    const onReveal = vi.fn();
    const onBackground = vi.fn();
    render(
      <div onClick={onBackground}>
        <FloatingBox box={box} focused={false} reducedMotion onReveal={onReveal} onDismiss={noop} onGrab={noop} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Nike Sweat à capuche/i }));
    expect(onReveal).toHaveBeenCalledWith('g-001-1');
    expect(onBackground).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (in `frontend/`): `npm test -- FloatingBox`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FloatingBox.tsx`**

Create `frontend/src/components/FloatingBox.tsx`:
```tsx
import { motion } from 'framer-motion';
import type { FieldBox } from '../field/fieldLayout';

interface Props {
  box: FieldBox;
  focused: boolean;
  reducedMotion: boolean;
  onReveal: (boxKey: string) => void;
  onDismiss: () => void;
  onGrab: (box: FieldBox) => void;
}

const DRIFT_AMP = 16; // px

export function FloatingBox({ box, focused, reducedMotion, onReveal, onDismiss, onGrab }: Props) {
  const { item } = box;
  const dx = Math.sin(box.driftSeed) * DRIFT_AMP;
  const dy = Math.cos(box.driftSeed * 1.3) * DRIFT_AMP;

  const drift =
    reducedMotion || focused
      ? { x: 0, y: 0 }
      : { x: [0, dx, 0], y: [0, dy, 0] };

  return (
    <motion.button
      type="button"
      className={`fbox ${focused ? 'fbox--focused' : ''} ${item.lastChance ? 'fbox--last-chance' : ''}`}
      style={{ left: `${box.xPct}%`, top: `${box.yPct}%`, zIndex: focused ? 40 : 1 }}
      aria-label={focused ? `${item.title} — détails` : item.title}
      onClick={(e) => {
        // Without stopPropagation, the box click bubbles to .field's
        // onClick={() => setFocusedKey(null)}, and React 18 batching makes
        // the dismiss win — focus swap silently breaks. The intended
        // behaviour: tap on any box (focused or not) is handled here only.
        e.stopPropagation();
        if (!focused) onReveal(box.boxKey);
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: 1,
        scale: focused ? 1.4 : box.scale,
        ...drift,
      }}
      exit={{ opacity: 0, scale: 0.5, y: -36, transition: { duration: 0.32 } }}
      transition={
        focused
          ? { type: 'spring', stiffness: 300, damping: 26 }
          : { duration: reducedMotion ? 0 : 9, repeat: reducedMotion ? 0 : Infinity, ease: 'easeInOut' }
      }
    >
      <span className="fbox__imgwrap">
        <img className="fbox__img" src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" />
        {item.lastChance && <span className="fbox__ribbon">Dernière chance</span>}
      </span>

      {focused && (
        <span className="fbox__panel" onClick={(e) => e.stopPropagation()}>
          <span className="fbox__title-row">
            <strong className="fbox__title">{item.title}</strong>
            <span className="fbox__brand">{item.brand}</span>
          </span>
          <span className="fbox__chips">
            <span className="chip">Taille {item.size}</span>
            <span className="chip">{item.condition}</span>
            <span className="chip">{item.color}</span>
          </span>
          <span className="fbox__seller">📍 {item.seller}</span>
          <span className="fbox__actions">
            <button
              type="button"
              className="btn btn--add btn--full"
              onClick={() => onGrab(box)}
            >
              🛒 Ajouter — {item.price} TND
            </button>
            <button type="button" className="btn btn--pass" onClick={onDismiss} aria-label="Reposer">
              ↩
            </button>
          </span>
        </span>
      )}
    </motion.button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run (in `frontend/`): `npm test -- FloatingBox`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FloatingBox.tsx frontend/src/components/FloatingBox.test.tsx
git commit -m "feat: FloatingBox with reveal + grab (TDD)"
```

---

## Task 10: `AmbientLayer` (Three.js backdrop)

Visual; verified by eye, not unit-tested.

**Files:**
- Create: `frontend/src/components/AmbientLayer.tsx`

- [ ] **Step 1: Implement `AmbientLayer.tsx`**

Create `frontend/src/components/AmbientLayer.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Decorative warm "dust motes" drifting behind the field. Capped pixel ratio,
// modest particle count, paused when the tab is hidden. Render nothing — and
// run nothing — when disabled (reduced motion or calm mode).
export function AmbientLayer({ enabled }: { enabled: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const COUNT = 110;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color('#d4a017'),
      size: 0.09,
      transparent: true,
      opacity: 0.5,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      points.rotation.y += 0.0008;
      points.rotation.x += 0.0004;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) animate();
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div className="ambient-layer" ref={mountRef} aria-hidden="true" />;
}
```

- [ ] **Step 2: Type-check**

Run (in `frontend/`): `npx tsc --noEmit`
Expected: no errors in `AmbientLayer.tsx` (errors may remain in `App.tsx`/`SwipeCard.tsx` until Task 12).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AmbientLayer.tsx
git commit -m "feat: Three.js ambient dust-mote backdrop"
```

---

## Task 11: `FloatingField` (the stage)

**Files:**
- Create: `frontend/src/components/FloatingField.tsx`

- [ ] **Step 1: Implement `FloatingField.tsx`**

Create `frontend/src/components/FloatingField.tsx`:
```tsx
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { FieldBox } from '../field/fieldLayout';
import { usePhantomCrowd } from '../field/usePhantomCrowd';
import { FloatingBox } from './FloatingBox';
import { AmbientLayer } from './AmbientLayer';

interface Props {
  boxes: FieldBox[];
  reducedMotion: boolean;
  minFieldSize: number;
  onGrab: (box: FieldBox) => void;
  onSnatch: (boxKey: string) => void;
}

const SNATCH_MIN_INTERVAL = 4000;
const SNATCH_MAX_INTERVAL = 8000;

export function FloatingField({ boxes, reducedMotion, minFieldSize, onGrab, onSnatch }: Props) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [calm, setCalm] = useState(false);
  const ambientEnabled = !calm && !reducedMotion;

  usePhantomCrowd({
    boxKeys: boxes.map((b) => b.boxKey),
    focusedKey,
    minFieldSize,
    minInterval: SNATCH_MIN_INTERVAL,
    maxInterval: SNATCH_MAX_INTERVAL,
    onSnatch,
  });

  function grab(box: FieldBox) {
    setFocusedKey(null);
    onGrab(box);
  }

  return (
    <div className="field" onClick={() => setFocusedKey(null)}>
      <AmbientLayer enabled={ambientEnabled} />

      <AnimatePresence>
        {boxes.map((box) => (
          <FloatingBox
            key={box.boxKey}
            box={box}
            focused={focusedKey === box.boxKey}
            reducedMotion={reducedMotion}
            onReveal={(k) => setFocusedKey(k)}
            onDismiss={() => setFocusedKey(null)}
            onGrab={grab}
          />
        ))}
      </AnimatePresence>

      {!reducedMotion && (
        <button
          type="button"
          className="calm-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setCalm((c) => !c);
          }}
        >
          {calm ? '✨ Animations' : '🌙 Mode calme'}
        </button>
      )}
    </div>
  );
}
```

> Note: `FloatingBox` calls `e.stopPropagation()` on its outer click (Task 9), and the focused-state panel ALSO stops propagation. So `.field`'s `onClick` only fires on truly empty-space taps — both unfocused-box taps (focus swap to that box) and Ajouter taps (grab) are handled by their own handlers without bubbling. This is what makes tap-on-another-box behave as a focus swap rather than a dismiss-then-nothing — see the focus-swap test added in Task 9.

- [ ] **Step 2: Type-check**

Run (in `frontend/`): `npx tsc --noEmit`
Expected: no errors in `FloatingField.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FloatingField.tsx
git commit -m "feat: FloatingField stage wiring boxes, crowd, ambient layer"
```

---

## Task 12: App integration, styles, and cleanup

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/components/SwipeCard.tsx`
- Modify: `frontend/src/components/Cart.tsx:51`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Rewrite `frontend/src/App.tsx`**

Replace the whole file with:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { CartResponse, FieldItem } from './types';
import { type FieldBox, makeBox } from './field/fieldLayout';
import { FloatingField } from './components/FloatingField';
import { Cart } from './components/Cart';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';

const isMobile = window.matchMedia('(max-width: 600px)').matches;
const TARGET = isMobile ? 9 : 16;
const DECK_FETCH = 60;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [boxes, setBoxes] = useState<FieldBox[]>([]);
  const [cart, setCart] = useState<CartResponse>({ lines: [], total: 0 });
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const deck = useRef<FieldItem[]>([]);
  const onScreen = useRef<Set<string>>(new Set());

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  const refillDeck = useCallback(async () => {
    const res = await api.field(DECK_FETCH);
    for (const item of res.items) {
      if (onScreen.current.has(item.id)) continue;
      if (deck.current.some((d) => d.id === item.id)) continue;
      deck.current.push(item);
    }
    return res.remaining;
  }, []);

  const topUp = useCallback(async () => {
    const next: FieldBox[] = [];
    while (true) {
      if (deck.current.length === 0) {
        const remaining = await refillDeck();
        if (deck.current.length === 0) {
          if (remaining === 0) setExhausted(true);
          break;
        }
      }
      const item = deck.current.shift()!;
      const box = makeBox(item);
      onScreen.current.add(item.id);
      next.push(box);
      // Stop once we've queued enough to reach the target.
      if (onScreen.current.size >= TARGET) break;
    }
    if (next.length) setBoxes((prev) => [...prev, ...next]);
  }, [refillDeck]);

  const refreshCart = useCallback(async () => {
    setCart(await api.cart());
  }, []);

  useEffect(() => {
    void (async () => {
      await refillDeck();
      await topUp();
    })();
    void refreshCart();
  }, [refillDeck, topUp, refreshCart]);

  function removeBox(boxKey: string) {
    setBoxes((prev) => {
      const leaving = prev.find((b) => b.boxKey === boxKey);
      if (leaving) onScreen.current.delete(leaving.item.id);
      return prev.filter((b) => b.boxKey !== boxKey);
    });
  }

  async function handleGrab(box: FieldBox) {
    removeBox(box.boxKey);
    try {
      setCart(await api.add(box.item.id));
      flash(`Ajouté au panier — ${box.item.title}`);
    } catch (e) {
      console.error('add failed', e);
    }
    void topUp();
  }

  async function handleSnatch(boxKey: string) {
    const box = boxes.find((b) => b.boxKey === boxKey);
    if (!box) return;
    removeBox(boxKey);
    try {
      // The phantom crowd "snatches" — hits the backend pass mechanic.
      // See ADR-0001 for the naming split.
      await api.snatch(box.item.id);
    } catch (e) {
      console.error('snatch failed', e);
    }
    if (Math.random() < 0.35) flash('Quelqu’un l’a pris… 👀');
    void topUp();
  }

  async function refresh(opts: { keepCart: boolean }) {
    if (opts.keepCart) {
      await api.resetSwipes(); // ADR-0002
    } else {
      await api.reset();
    }
    deck.current = [];
    onScreen.current = new Set();
    setBoxes([]);
    setExhausted(false);
    await refreshCart();
    await refillDeck();
    await topUp();
  }

  const stockRefresh = () => refresh({ keepCart: true });
  const hardReset = () => refresh({ keepCart: false });

  const cartCount = cart.lines.reduce((a, l) => a + l.quantity, 0);
  const showEmpty = exhausted && boxes.length === 0;

  return (
    <div className="app app--field">
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onReset={hardReset} />

      <main className="stage stage--field">
        {showEmpty ? (
          // EmptyState exposes the stock-refresh (preserves cart) as primary,
          // hard reset as secondary. See ADR-0002. The component needs a
          // small prop addition — see Task 12 Step 3b below.
          <EmptyState
            onStockRefresh={stockRefresh}
            onHardReset={hardReset}
            onOpenCart={() => setCartOpen(true)}
            cartCount={cartCount}
          />
        ) : (
          <FloatingField
            boxes={boxes}
            reducedMotion={reducedMotion}
            minFieldSize={Math.min(4, TARGET)}
            onGrab={handleGrab}
            onSnatch={handleSnatch}
          />
        )}
        {!showEmpty && (
          <p className="hint">Survole ou tape une pièce pour la révéler. Les autres chinent aussi…</p>
        )}
      </main>

      <Cart open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} refresh={refreshCart} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
```

> Note: `handleSnatch` reads `boxes` from closure; because `usePhantomCrowd` re-reads `onSnatch` through a ref each tick and `App` re-renders on every `setBoxes`, the handler always closes over current `boxes`. The `removeBox`/`onScreen` updates use functional state + a ref, so they stay correct across rapid snatches.

- [ ] **Step 2: Delete the swipe card**

```bash
git rm frontend/src/components/SwipeCard.tsx
```

- [ ] **Step 2b: Update `EmptyState` to expose stock-refresh as primary CTA**

See [ADR-0002](../../adr/0002-preserve-cart-on-stock-refresh.md). Replace `frontend/src/components/EmptyState.tsx` with:

```tsx
interface Props {
  onStockRefresh: () => void;
  onHardReset: () => void;
  onOpenCart: () => void;
  cartCount: number;
}

export function EmptyState({ onStockRefresh, onHardReset, onOpenCart, cartCount }: Props) {
  return (
    <div className="empty">
      <div className="empty__emoji">🪙</div>
      <h2>Tu as tout vu.</h2>
      <p>
        Toute la fripa est passée devant tes yeux. On peut rouvrir le rayon —
        ton panier reste comme tu l'as laissé.
      </p>
      <div className="empty__actions">
        {cartCount > 0 && (
          <button className="btn btn--add" onClick={onOpenCart}>
            Voir mon panier ({cartCount})
          </button>
        )}
        <button className="btn btn--add btn--wide" onClick={onStockRefresh}>
          ✨ Voir d'autres pièces
        </button>
        <button className="btn btn--pass btn--ghost" onClick={onHardReset}>
          Tout recommencer (vide le panier)
        </button>
      </div>
    </div>
  );
}
```

If `btn--ghost` doesn't exist in `App.css`, add a tiny rule alongside the field styles:
```css
.btn--ghost { background: transparent; color: var(--muted); text-decoration: underline; box-shadow: none; }
```

- [ ] **Step 3: Fix the swipe-era copy in `Cart.tsx`**

In `frontend/src/components/Cart.tsx`, change the empty-cart hint line:
```tsx
            <p className="muted">Swipe à gauche pour passer, tape 🛒 pour garder.</p>
```
to:
```tsx
            <p className="muted">Tape une pièce qui flotte, puis 🛒 pour la garder avant les autres.</p>
```

- [ ] **Step 4: Append field styles to `frontend/src/App.css`**

Add at the end of `frontend/src/App.css`:
```css
/* ---------- Floating field ---------- */
.app--field { max-width: 540px; }
.stage--field { padding: 8px 12px 18px; }

.field {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 72vh;
  overflow: hidden;
  border-radius: 22px;
  background:
    radial-gradient(700px 380px at 70% 10%, #ffe9d4 0%, transparent 60%),
    var(--paper);
  box-shadow: var(--shadow);
}

.ambient-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.fbox {
  position: absolute;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  width: clamp(82px, 26vw, 120px);
  transform-origin: center;
  -webkit-tap-highlight-color: transparent;
}
.fbox__imgwrap {
  display: block;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.fbox__img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  filter: blur(6px);
  opacity: 0.82;
  transition: filter 0.35s ease, opacity 0.35s ease;
}
.fbox--focused .fbox__img { filter: blur(0); opacity: 1; }

.fbox__ribbon {
  position: absolute;
  top: 8px; left: -2px;
  background: linear-gradient(90deg, var(--gold), #f0b84a);
  color: #2a1a00;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 3px 8px;
  border-radius: 0 8px 8px 0;
}
.fbox--last-chance .fbox__imgwrap {
  outline: 3px solid var(--gold);
  outline-offset: -3px;
  animation: glow 1.4s ease-in-out infinite;
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 160, 23, 0.0), var(--shadow); }
  50% { box-shadow: 0 0 26px 4px rgba(212, 160, 23, 0.55), var(--shadow); }
}

.fbox__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 12px;
  background: var(--paper);
  border-radius: 16px;
  box-shadow: var(--shadow);
  width: clamp(180px, 60vw, 240px);
  text-align: left;
}
.fbox__title-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.fbox__title { font-size: 15px; line-height: 1.2; }
.fbox__brand { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.fbox__chips { display: flex; flex-wrap: wrap; gap: 5px; }
.fbox__seller { font-size: 12px; color: var(--muted); }
.fbox__actions { display: flex; gap: 8px; }

.calm-toggle {
  position: absolute;
  bottom: 12px; right: 12px;
  z-index: 45;
  border: none;
  background: var(--paper);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  box-shadow: var(--shadow);
}

@media (prefers-reduced-motion: reduce) {
  .fbox__img { transition: none; }
  .fbox--last-chance .fbox__imgwrap { animation: none; }
}
```

- [ ] **Step 5: Type-check the whole frontend**

Run (in `frontend/`): `npx tsc --noEmit`
Expected: zero errors (all `api.next` / `NextItemResponse` / `SwipeCard` references are gone).

- [ ] **Step 6: Run the full test suite**

Run (in `frontend/`): `npm test`
Expected: all tests pass (pickSnatchTarget, usePhantomCrowd, fieldLayout, FloatingBox).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Cart.tsx frontend/src/App.css
git rm --cached frontend/src/components/SwipeCard.tsx 2>/dev/null; true
git commit -m "feat: floating-field App integration, styles, retire SwipeCard"
```

---

## Task 13: End-to-end verification & polish pass

No new files — exercise the running app and confirm the spec's behaviours.

- [ ] **Step 1: Start both servers**

Two shells:
```bash
cd backend && npm run start:dev
```
```bash
cd frontend && npm run dev
```
Open http://localhost:5173.

- [ ] **Step 2: Walk the behaviour checklist**

Confirm each:
- Field loads ~9 (narrow window) blurry boxes drifting over kraft paper; warm dust motes visible behind them.
- Hover (desktop) or tap (use devtools mobile emulation) a box → it sharpens, scales up, shows title/brand/price/chips/seller + **Ajouter**.
- Tapping empty space re-blurs the box.
- **Focus swap:** with one box focused, tapping a different (unfocused) box dismisses the first and focuses the second in a single tap (not two taps, not "tap does nothing"). This is the test that catches the React 18 batching bug — if the focus-swap test in Task 9 passes but this manual check fails, something else added a bubbling click handler.
- The ↩ Reposer button in the panel just unfocuses (returns the box to drift). It does NOT fire any backend call.
- Clicking **Ajouter** adds to cart (badge increments, toast shows) and a replacement drifts in.
- Within ~4–8s, an un-focused box gets snatched (slides up + fades); occasionally the *Quelqu'un l'a pris…* toast appears. The focused box is never snatched.
- After enough snatches, a *Dernière chance* box eventually drifts back with a gold pulse ribbon. (To force it quickly, lower `LAST_CHANCE_PROBABILITY`/`LAST_CHANCE_SURFACE_RATE` temporarily, or trigger several snatches.) **It can be re-snatched by the crowd before you focus it** — this is intentional (see grill-with-docs session decision #1).
- Cart drawer and checkout still work.
- **Stock-refresh:** play until the field exhausts (EmptyState appears). Click **✨ Voir d'autres pièces** — field repopulates, cart count is preserved. Then click **Tout recommencer** — cart empties too.
- The `↻` Header button still hard-resets (same as **Tout recommencer**).

- [ ] **Step 3: Verify the reduced-motion fallback**

In devtools, emulate `prefers-reduced-motion: reduce`, reload. Confirm: no drift, no Three.js layer, no calm-mode toggle, boxes still reveal/grab on tap.

- [ ] **Step 4: Verify the calm-mode toggle**

With normal motion, click **🌙 Mode calme** → the Three.js layer disappears; click again → it returns.

- [ ] **Step 5: Production build sanity**

Run (in `frontend/`): `npm run build`
Expected: `tsc -b && vite build` succeeds (tests excluded from the build).

- [ ] **Step 6: Commit any tweaks made during verification**

```bash
git add -A
git commit -m "chore: floating-field verification pass"
```

---

## Self-Review

**Spec coverage:**
- Floating field, Friperie douce look → Tasks 9, 11, 12 (CSS), 10 (ambient). ✓
- Mobile-first tap reveal, hover bonus → FloatingBox click + CSS hover-agnostic reveal; `isMobile` density. ✓
- Hover/tap reveal, click grab, crowd snatches rest → Tasks 7, 9, 11, 12. ✓
- Snatch reuses 90/10 dice; 10% drift back as Dernière chance → `handleSnatch` → `api.snatch` (Task 5); `getField` reprise surfacing (Task 3); ribbon/glow CSS (Task 12). ✓
- Simulated crowd, single-player backend → `usePhantomCrowd` client-side; backend unchanged in model. ✓
- ~60-item catalog → Task 2. ✓
- Batch `GET /api/items/field`, remove `getNext` → Tasks 3, 4. ✓
- Hybrid architecture (DOM boxes + Three.js ambient) → Tasks 9, 10. ✓
- Perf/a11y: lazy images, capped pixelRatio, pause on hidden, reduced-motion, focusable buttons, calm toggle → Tasks 9, 10, 11, 13. ✓
- Stays: Header, Cart, EmptyState (now with stock-refresh CTA), scarcity logic, palette/French → preserved; Cart copy updated. ✓
- Testing: getField + dice + resetSwipes (backend), usePhantomCrowd/pickSnatchTarget/fieldLayout/FloatingBox + focus-swap (frontend) → Tasks 1, 3, 4b, 7, 8, 9. ✓

**Grill-with-docs decisions covered (2026-05-28):**
- Reprise snatchable → no filter added to `pickSnatchTarget`. ✓
- `pass` vs `snatch` naming → `api.snatch` in Task 5; `handleSnatch` calls `api.snatch` in Task 12; route unchanged. ADR-0001. ✓
- Focus swap → `e.stopPropagation()` in Task 9; focus-swap test added; Task 11 note clarified; manual check in Task 13. ✓
- ↩ Reposer = unfocus → no change to FloatingBox dismiss wiring; verification step in Task 13. ✓
- Stock-refresh preserves cart → new Task 4b (backend `resetSwipes`); `api.resetSwipes` added in Task 5; App split into `stockRefresh` / `hardReset` in Task 12; EmptyState redesigned in Task 12 Step 2b. ADR-0002. ✓

**Placeholder scan:** No TBDs, no "implement later", no vague error-handling steps. Every code step shows complete code.

**Type consistency:** `FieldResponse` shape matches backend `getField` return and frontend `api.field`. `FieldBox`/`Placement`/`makeBox` from `fieldLayout.ts` are used consistently in `FloatingBox`, `FloatingField`, and `App`. `usePhantomCrowd` option names (`boxKeys`, `focusedKey`, `minFieldSize`, `minInterval`, `maxInterval`, `onSnatch`, `rng`) match between definition, tests, and `FloatingField` call site. `pickSnatchTarget` signature matches its tests and hook usage.
