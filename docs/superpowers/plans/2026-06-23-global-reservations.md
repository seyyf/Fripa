# Global Reservations + Intro Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make swipe-right a real global 15-min reservation — the piece locks for everyone, leaves others' decks, shows "Réservé · revient dans MM:SS" on its detail page, and auto-releases — plus a one-time i18n "Comment ça marche" intro card.

**Architecture:** Per-user carts stay the source of truth (single Node process, single-threaded). A scan helper derives who holds a piece (honoring the 15-min TTL inline), so there's no second structure to drift. The deck excludes held-by-others; detail/favorites surface a `reserved` state with `reservedUntil`. Intro card is a one-time localStorage-gated overlay wired through `t()`.

**Tech Stack:** NestJS + Prisma backend, React 18 + react-router frontend, Vitest, the existing `i18n` `t()` system (FR/AR/EN).

**Spec:** `docs/superpowers/specs/2026-06-23-global-reservations-design.md`

---

## File Structure

**Backend** (`backend/src/shop/`):
- `types.ts` — add `'reserved'` to `ItemStatus`; add `reservedUntil?` to `ItemDetail`; favorites lines carry `reservedUntil?`.
- `shop.service.ts` — `holderOf`/`heldByOther` scan helpers; block double-holds in `cartAdd`; exclude held-by-others in `getField`; `reserved` status in `getOne`; `reservedUntil` in `getFavorites`/`getCatalog`; drop held-by-others in `getSimilar`.
- `shop.service.spec.ts` — reservation tests.

**Frontend** (`frontend/src/`):
- `types.ts` — mirror `'reserved'` + `reservedUntil` on the shopper-side `ItemDetail`/favorites types.
- `i18n/translations.ts` — new `intro.*`, `pd.reserved*`, `fav.reserved` keys (FR/AR/EN).
- `components/IntroCard.tsx` (new) + mount in `App.tsx` — one-time overlay.
- `components/ProductDetailContent.tsx` — reserved badge + countdown + disabled actions.
- `components/FavoritesDrawer.tsx` — reserved lock on a favorited line.

---

## Task 1: Types — `reserved` status + `reservedUntil`

**Files:**
- Modify: `backend/src/shop/types.ts`

- [ ] **Step 1: Extend the status union + ItemDetail.** In `backend/src/shop/types.ts`:
```ts
export type ItemStatus = 'available' | 'gone' | 'inCart' | 'inFavorites' | 'reserved';
```
```ts
export interface ItemDetail {
  item: TShirt;
  status: ItemStatus;
  // Set only when status === 'reserved': ms epoch when the other shopper's hold lapses.
  reservedUntil?: number;
}
```

- [ ] **Step 2: Let favorites carry the reserved flag.** Change `FavoritesResponse`:
```ts
export interface FavoritesResponse {
  lines: (TShirt & { reservedUntil?: number })[];
}
```

- [ ] **Step 3: Build check.**
Run: `cd backend && npm run build`
Expected: completes (the new optional field + union member don't break existing code).

- [ ] **Step 4: Commit**
```bash
git add backend/src/shop/types.ts
git commit -m "feat(reservations): reserved status + reservedUntil on detail/favorites types"
```

---

## Task 2: `ShopService` — global hold scan + enforcement

**Files:**
- Modify: `backend/src/shop/shop.service.ts`
- Test: `backend/src/shop/shop.service.spec.ts`

- [ ] **Step 1: Write the failing tests** (append to `shop.service.spec.ts`). Use the file's existing helpers: `new ShopService()` for plain cases and `withClock(start) → { s, advance }` for the TTL case (same pattern as the "cart hold (TTL)" block).
```ts
describe('ShopService global reservations', () => {
  it('blocks a second user from holding a piece already held', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    expect(() => s.addToCart('u2', 't-001')).toThrow(/réservé par un autre/i);
  });

  it("hides a held piece from other users' decks", () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const ids = s.getField('u2', 100).items.map((i) => i.id);
    expect(ids).not.toContain('t-001');
  });

  it('reports reserved status + reservedUntil on the detail page for others', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const d = s.getOne('u2', 't-001');
    expect(d.status).toBe('reserved');
    expect(d.reservedUntil).toBeGreaterThan(0);
  });

  it('blocks moving a favorite to cart when held by another', () => {
    const s = new ShopService();
    s.addFavorite('u2', 't-001');
    s.addToCart('u1', 't-001');
    expect(() => s.moveFavoriteToCart('u2', 't-001')).toThrow(/réservé par un autre/i);
  });

  it('releases the hold after the TTL — the piece is grabbable again', () => {
    const { s, advance } = withClock(1000);
    s.addToCart('u1', 't-001');
    advance(TTL + 1);
    expect(s.getField('u2', 100).items.map((i) => i.id)).toContain('t-001');
    expect(() => s.addToCart('u2', 't-001')).not.toThrow();
  });
});
```
(`TTL` and `withClock` already exist in this spec file.)

- [ ] **Step 2: Run them (fail).**
Run: `cd backend && npx vitest run src/shop/shop.service.spec.ts`
Expected: the 5 new tests FAIL (no global block yet — second user currently can hold).

- [ ] **Step 3: Add the scan helpers.** In `shop.service.ts`, add private methods (near `findItem`):
```ts
  // Who currently holds this piece (any user's live cart hold), or null.
  // Honors the TTL inline so expired holds count as released without a prune.
  private holderOf(itemId: string, now: number): string | null {
    for (const [uid, st] of this.states) {
      const at = st.cart.get(itemId);
      if (at !== undefined && now - at < CART_TTL_MS) return uid;
    }
    return null;
  }

  private heldByOther(itemId: string, userId: string, now: number): boolean {
    const holder = this.holderOf(itemId, now);
    return holder !== null && holder !== userId;
  }

  // The set of pieces held by someone OTHER than `userId` (for deck/list filters).
  private heldByOthers(userId: string, now: number): Set<string> {
    const held = new Set<string>();
    for (const [uid, st] of this.states) {
      if (uid === userId) continue;
      for (const [id, at] of st.cart) {
        if (now - at < CART_TTL_MS) held.add(id);
      }
    }
    return held;
  }
```

- [ ] **Step 4: Block double-holds in `cartAdd`.** At the very top of `cartAdd`:
```ts
  private cartAdd(userId: string, s: UserState, itemId: string) {
    if (this.heldByOther(itemId, userId, this.now())) {
      throw new ConflictException('Déjà réservé par un autre acheteur.');
    }
    // A refresh of an existing hold is not a new "keep" signal.
    if (!s.cart.has(itemId)) this.swipeLog?.log(userId, itemId, 'keep');
    s.cart.set(itemId, this.now());
    s.lastChancePool.delete(itemId);
  }
```
(`ConflictException` is already imported — `assertCanHold` uses it.)

- [ ] **Step 5: Exclude held-by-others from the deck.** In `getField`, after `const s = this.getState(userId);`:
```ts
    const now = this.now();
    const blocked = this.heldByOthers(userId, now);
    const fresh = ITEMS.filter(
      (i) => this.isFresh(s, i) && !blocked.has(i.id) && matchesFilters(i, filters),
    );
```
(Replace the existing `fresh` assignment; leave the `reprise` line as-is, then also exclude blocked from reprise:)
```ts
    const reprise = ITEMS.filter(
      (i) =>
        s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        !blocked.has(i.id) &&
        matchesFilters(i, filters),
    );
```

- [ ] **Step 6: `reserved` status on detail.** Replace the body of `getOne`:
```ts
  getOne(userId: string, id: string): ItemDetail {
    const item = this.getItem(id);
    const s = this.getState(userId);
    const now = this.now();
    if (s.cart.has(id)) return { item, status: 'inCart' };
    if (s.favorites.has(id)) return { item, status: 'inFavorites' };
    if (s.passed.has(id) || s.lastChancePool.has(id) || s.shownLastChance.has(id)) {
      return { item, status: 'gone' };
    }
    const holder = this.holderOf(id, now);
    if (holder && holder !== userId) {
      return { item, status: 'reserved', reservedUntil: (this.states.get(holder)!.cart.get(id) as number) + CART_TTL_MS };
    }
    return { item, status: 'available' };
  }
```

- [ ] **Step 7: Flag reserved favorites + drop held-by-others from similar.** In `getFavorites`, replace the push:
```ts
      const heldUntil = (() => {
        const holder = this.holderOf(id, this.now());
        return holder && holder !== userId
          ? (this.states.get(holder)!.cart.get(id) as number) + CART_TTL_MS
          : undefined;
      })();
      lines.push(heldUntil ? { ...item, reservedUntil: heldUntil } : item);
```
In `getSimilar`, add to the `.filter(...)` predicate (alongside the existing `!s.cart.has(i.id)`):
```ts
        !s.cart.has(i.id) &&
        !this.heldByOther(i.id, userId, this.now()),
```

- [ ] **Step 8: Run the tests (pass).**
Run: `cd backend && npx vitest run src/shop/shop.service.spec.ts`
Expected: all pass, including the 5 new ones. If a pre-existing test assumed two users could both hold one piece, update it to expect the block (that's the intended behavior change) and note it in the commit.

- [ ] **Step 9: Full backend suite + build.**
Run: `cd backend && npm test` → all PASS.
Run: `cd backend && npm run build` → no errors.

- [ ] **Step 10: Commit**
```bash
git add backend/src/shop/shop.service.ts backend/src/shop/shop.service.spec.ts
git commit -m "feat(reservations): global 15-min holds — block, deck-exclude, reserved status"
```

---

## Task 3: Frontend types mirror

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Mirror the backend.** In `frontend/src/types.ts`, find the `ItemDetail` type and its status union; add `'reserved'` to the union and `reservedUntil?: number;` to `ItemDetail`. Find the favorites line type and add `reservedUntil?: number;`. (Match the existing names in that file — read it first; the shapes mirror `backend/src/shop/types.ts`.)

- [ ] **Step 2: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/types.ts
git commit -m "feat(reservations): mirror reserved status + reservedUntil in frontend types"
```

---

## Task 4: i18n strings (FR/AR/EN)

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

- [ ] **Step 1: Add the keys.** Inside the `STRINGS` object in `frontend/src/i18n/translations.ts`, add:
```ts
  'intro.title': { fr: 'Comment ça marche', ar: 'كيف يعمل', en: 'How it works' },
  'intro.swipe': {
    fr: 'Swipe à droite = tu gardes la pièce, réservée 15 min rien que pour toi. Gauche = passer · Haut = favori.',
    ar: 'اسحب لليمين = تحتفظ بالقطعة، محجوزة 15 دقيقة لك وحدك. لليسار = تجاوز · للأعلى = المفضلة.',
    en: 'Swipe right = you keep the piece, reserved 15 min just for you. Left = pass · Up = favorite.',
  },
  'intro.cap': {
    fr: 'Jusqu’à 10 réservations à la fois.',
    ar: 'حتى 10 حجوزات في نفس الوقت.',
    en: 'Up to 10 reservations at a time.',
  },
  'intro.cod': {
    fr: 'Paiement à la livraison.',
    ar: 'الدفع عند الاستلام.',
    en: 'Cash on delivery.',
  },
  'intro.cta': { fr: 'C’est parti', ar: 'هيا بنا', en: "Let's go" },
  'pd.reserved': { fr: 'Réservé', ar: 'محجوز', en: 'Reserved' },
  'pd.reservedReturnsIn': { fr: 'Revient dans {t}', ar: 'يعود خلال {t}', en: 'Back in {t}' },
  'fav.reserved': { fr: 'Réservé', ar: 'محجوز', en: 'Reserved' },
```
(If `t()` in this project uses a different interpolation token than `{t}`, match it — check an existing interpolated string like `toast.favorited` in this file.)

- [ ] **Step 2: Build check.**
Run: `cd frontend && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/i18n/translations.ts
git commit -m "feat(reservations): FR/AR/EN strings for intro card + reserved state"
```

---

## Task 5: Intro card (one-time, i18n)

**Files:**
- Create: `frontend/src/components/IntroCard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css` (styles)

- [ ] **Step 1: Write the component** (`frontend/src/components/IntroCard.tsx`):
```tsx
import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';

const SEEN_KEY = 'fripa-intro-seen';

function seen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

// One-time "how it works" overlay shown on a shopper's first visit.
export function IntroCard() {
  const { t } = useT();
  const [open, setOpen] = useState(() => !seen());
  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div className="intro-card__backdrop" onClick={dismiss}>
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="intro-card__title">{t('intro.title')}</h2>
        <ul className="intro-card__list">
          <li>✋ {t('intro.swipe')}</li>
          <li>🛒 {t('intro.cap')}</li>
          <li>🚚 {t('intro.cod')}</li>
        </ul>
        <button className="btn btn--add intro-card__cta" onClick={dismiss}>
          {t('intro.cta')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `App.tsx`.** Add the import near the other component imports:
```ts
import { IntroCard } from './components/IntroCard';
```
Render it once at the top of the app's returned JSX (just inside the outermost wrapper, alongside `<Header .../>`):
```tsx
      <IntroCard />
```

- [ ] **Step 3: Add styles** — append to `frontend/src/App.css`:
```css
.intro-card__backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(20, 16, 10, 0.5);
  backdrop-filter: blur(4px);
}
.intro-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface, #fffdf9);
  border-radius: var(--r-lg, 18px);
  padding: 26px 24px;
  box-shadow: 0 30px 70px -24px rgba(40, 24, 8, 0.5);
  text-align: center;
}
.intro-card__title {
  margin: 0 0 16px;
  font-family: var(--display);
  font-weight: 800;
}
.intro-card__list {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: grid;
  gap: 12px;
  text-align: left;
  font-size: 15px;
  line-height: 1.4;
}
.intro-card__cta {
  width: 100%;
}
```

- [ ] **Step 4: Build check.**
Run: `cd frontend && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/IntroCard.tsx frontend/src/App.tsx frontend/src/App.css
git commit -m "feat(reservations): one-time i18n 'how it works' intro card"
```

---

## Task 6: Reserved state on the product detail page

**Files:**
- Modify: `frontend/src/components/ProductDetailContent.tsx`

- [ ] **Step 1: Read the component** to find where `status` and the add-to-cart / favorite buttons are rendered. The detail data comes from `api.item(id)` → `{ item, status, reservedUntil }`.

- [ ] **Step 2: Add a live countdown + lock.** Using the existing `formatHold` from `../cart/holdTimer` and a 1s tick:
```tsx
import { useEffect, useState } from 'react';
import { formatHold } from '../cart/holdTimer';
import { useT } from '../i18n/LanguageContext';
```
Inside the component, when `status === 'reserved'` and `reservedUntil` is set, compute remaining time and render a badge; disable the grab/favorite controls:
```tsx
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  const reserved = status === 'reserved' && typeof reservedUntil === 'number' && reservedUntil > now;
  useEffect(() => {
    if (!reserved) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [reserved]);
```
Render (placed where the price/actions are):
```tsx
  {reserved && (
    <div className="pd-reserved">
      🔒 {t('pd.reserved')} · {t('pd.reservedReturnsIn', { t: formatHold(reservedUntil! - now) })}
    </div>
  )}
```
And gate the add-to-cart / favorite buttons with `disabled={reserved}` (or hide them when `reserved`). Match the existing button markup in this file.
(If `Date.now()` is awkward in tests here, it's fine — this is a render-time clock for a live UI, not a pure unit under test.)

- [ ] **Step 3: Add the style** — append to `frontend/src/App.css`:
```css
.pd-reserved {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fdeceb;
  color: var(--accent, #e0231a);
  border: 1px solid #f1d3d0;
  border-radius: 999px;
  padding: 7px 14px;
  font-weight: 700;
  font-size: 14px;
}
```

- [ ] **Step 4: Build check.**
Run: `cd frontend && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/ProductDetailContent.tsx frontend/src/App.css
git commit -m "feat(reservations): reserved badge + countdown + locked actions on detail"
```

---

## Task 7: Reserved lock in the favorites drawer

**Files:**
- Modify: `frontend/src/components/FavoritesDrawer.tsx`

- [ ] **Step 1: Read the component** to find the favorite-line render and the move-to-cart button. Lines now carry `reservedUntil?: number`.

- [ ] **Step 2: Lock reserved favorites.** For each line, compute `const isReserved = typeof line.reservedUntil === 'number' && line.reservedUntil > Date.now();` and, when true, show a small "Réservé" label (`t('fav.reserved')`) and set the move-to-cart button `disabled={isReserved}`. Match the existing line markup + the `useT` hook (import it if not present).

- [ ] **Step 3: Build check.**
Run: `cd frontend && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/FavoritesDrawer.tsx
git commit -m "feat(reservations): lock reserved pieces in the favorites drawer"
```

---

## Task 8: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Full suites.**
Run: `cd backend && npm test` → all PASS.
Run: `cd frontend && npx vitest run` → all PASS.

- [ ] **Step 2: Manual two-shopper check.** Start backend (`npm run start:dev`) + frontend (`npm run dev`). Open two browsers (or normal + incognito = two anon userIds):
1. In browser A, swipe right on a piece (note its title).
2. In browser B, swipe through the deck — that piece should **not** appear.
3. In browser B, open that piece's direct link (`/piece/<id>`) → shows **"🔒 Réservé · Revient dans MM:SS"**, grab disabled.
4. Wait 15 min (or temporarily lower `CART_TTL_MS` to ~20s to test) → the piece reappears in B's deck and becomes grabbable.

- [ ] **Step 3: Intro card check.** In a fresh browser (or after `localStorage.removeItem('fripa-intro-seen')` + reload), the "Comment ça marche" card shows once; dismiss → never again. Toggle the language switcher to AR/EN before dismissing to confirm the strings translate.

- [ ] **Step 4: Commit (any fixups).**
```bash
git add -A && git commit -m "test(reservations): verification fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** global hold via scan helpers (T2); block double-hold (T2 cartAdd); deck exclusion (T2 getField); reserved status + reservedUntil on detail (T1 types + T2 getOne); favorites reserved flag (T1 + T2 getFavorites) and locked move-to-cart (T7); similar drops held (T2 getSimilar); auto-release after TTL (T2 inline TTL, tested); intro card one-time + i18n (T4 strings, T5 component); reserved UI i18n (T4 + T6); frontend type mirror (T3). Covered.
- **Type consistency:** `'reserved'` added to `ItemStatus` (T1) and mirrored frontend (T3); `reservedUntil` name consistent across backend `ItemDetail`/favorites (T1), service (T2), frontend (T3/T6/T7); `holderOf`/`heldByOther`/`heldByOthers` names consistent within T2; i18n keys (`intro.*`, `pd.reserved`, `pd.reservedReturnsIn`, `fav.reserved`) consistent between T4 and T5/T6/T7.
- **Behavior change flagged:** any existing test asserting two users can both hold one piece is updated in T2 Step 8 (intended).
- **Execution note:** Tasks 3, 6, 7 require reading the exact component/type files first (frontend `types.ts`, `ProductDetailContent.tsx`, `FavoritesDrawer.tsx`) and matching their existing markup/names — the steps describe the precise edits and strings to apply.
