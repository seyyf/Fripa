# Reserved Cards in Deck + Freed-Favorite Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep held pieces visible in everyone's deck as locked cards (swipe-right blocked + notification, swipe-up to favorite), and toast a shopper when a favorited held piece becomes available.

**Architecture:** Backend `getField` stops excluding held-by-others and instead tags them with `reservedUntil`. The deck card renders a locked state and intercepts the "keep" commit (drag or button) to notify + spring back, while favorite/pass still work. A pure `detectFreedFavorites` helper plus a light favorites poll fires the "now available" toast.

**Tech Stack:** NestJS backend, React 18 + framer-motion frontend, Vitest, existing `t()` i18n (FR/AR/EN).

**Spec:** `docs/superpowers/specs/2026-06-26-reserved-cards-in-deck-design.md`

---

## File Structure

**Backend** (`backend/src/shop/`):
- `shop.service.ts` — `getField` includes held pieces + tags `reservedUntil`; replace `heldByOthers` (Set) with `heldByOthersMap`.
- `types.ts` — `FieldResponse` items gain `reservedUntil?`.
- `shop.service.spec.ts` — update the deck-hiding test.

**Frontend** (`frontend/src/`):
- `types.ts` — `FieldItem` gains `reservedUntil?`.
- `components/SwipeCard.tsx` — locked render + block keep + `onReservedBlock` prop.
- `components/SwipeDeck.tsx` — thread `onReservedBlock`.
- `App.tsx` — pass the block toast; freed-favorite poll + effect.
- `favorites/freedAlert.ts` (new) + `favorites/freedAlert.test.ts` — pure detector.
- `i18n/translations.ts` — `toast.favAvailable`, `toast.favAvailableN`.

---

## Task 1: Backend — held pieces stay in the deck, tagged reserved

**Files:**
- Modify: `backend/src/shop/types.ts`
- Modify: `backend/src/shop/shop.service.ts`
- Test: `backend/src/shop/shop.service.spec.ts`

- [ ] **Step 1: Update the failing test.** In `shop.service.spec.ts`, replace the existing test `"hides a held piece from other users' decks"` with:
```ts
  it('keeps a held piece in other users\' decks, tagged reserved', () => {
    const s = new ShopService();
    s.addToCart('u1', 't-001');
    const card = s.getField('u2', 200).items.find((i) => i.id === 't-001');
    expect(card).toBeDefined();
    expect(card?.reservedUntil).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it (fails — currently excluded).**
Run: `cd backend && npx vitest run src/shop/shop.service.spec.ts`
Expected: FAIL — `card` is `undefined` (held pieces are still excluded).

- [ ] **Step 3: Add `reservedUntil` to the field item type.** In `backend/src/shop/types.ts`:
```ts
export interface FieldResponse {
  items: (TShirt & { lastChance: boolean; reservedUntil?: number })[];
  remaining: number;
}
```

- [ ] **Step 4: Replace the `heldByOthers` helper with a map.** In `shop.service.ts`, replace the whole `heldByOthers` method:
```ts
  // itemId -> hold expiry (ms epoch), for pieces held by someone OTHER than
  // `userId`. Drives the locked "Réservé" cards in everyone else's deck.
  private heldByOthersMap(userId: string, now: number): Map<string, number> {
    const map = new Map<string, number>();
    for (const [uid, st] of this.states) {
      if (uid === userId) continue;
      for (const [itemId, at] of st.cart) {
        if (now - at < CART_TTL_MS) map.set(itemId, at + CART_TTL_MS);
      }
    }
    return map;
  }
```

- [ ] **Step 5: Update `getField`** to include held pieces and tag them. Replace the method's filtering + push lines:
```ts
  getField(userId: string, count: number, filters: FieldFilters = {}): FieldResponse {
    const s = this.getState(userId);
    // Held pieces stay in the deck as locked cards (tagged with reservedUntil),
    // rather than disappearing.
    const heldUntil = this.heldByOthersMap(userId, this.now());

    const fresh = ITEMS.filter((i) => this.isFresh(s, i) && matchesFilters(i, filters));
    const reprise = ITEMS.filter(
      (i) =>
        s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        matchesFilters(i, filters),
    );

    const items: (TShirt & { lastChance: boolean; reservedUntil?: number })[] = [];

    // Occasionally sneak one last-chance reprise into the batch.
    if (reprise.length > 0 && this.rng() < LAST_CHANCE_SURFACE_RATE) {
      const chosen = reprise[Math.floor(this.rng() * reprise.length)];
      s.lastChancePool.delete(chosen.id);
      s.shownLastChance.add(chosen.id);
      items.push({ ...chosen, lastChance: true, ...(heldUntil.has(chosen.id) ? { reservedUntil: heldUntil.get(chosen.id) } : {}) });
    }

    for (const item of this.shuffle([...fresh])) {
      if (items.length >= count) break;
      items.push({ ...item, lastChance: false, ...(heldUntil.has(item.id) ? { reservedUntil: heldUntil.get(item.id) } : {}) });
    }

    const remaining = fresh.length + reprise.length - items.length;
    return { items, remaining: Math.max(0, remaining) };
  }
```

- [ ] **Step 6: Run the test + full shop suite.**
Run: `cd backend && npx vitest run src/shop/shop.service.spec.ts`
Expected: PASS (the held-card test + the other reservation tests; the 409 block test still passes).
Run: `cd backend && npm test` → all PASS.
Run: `cd backend && npm run build` → no errors.

- [ ] **Step 7: Commit**
```bash
git add backend/src/shop/types.ts backend/src/shop/shop.service.ts backend/src/shop/shop.service.spec.ts
git commit -m "feat(reservations): held pieces stay in the deck tagged reservedUntil"
```

---

## Task 2: Frontend type + locked deck card

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/SwipeCard.tsx`
- Modify: `frontend/src/components/SwipeDeck.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Mirror the type.** In `frontend/src/types.ts`, change `FieldItem`:
```ts
export interface FieldItem extends TShirt {
  lastChance: boolean;
  // Set when another shopper currently holds this piece — shown as a locked card.
  reservedUntil?: number;
}
```

- [ ] **Step 2: Add the prop + reserved state to `SwipeCard`.** In `frontend/src/components/SwipeCard.tsx`, add the import:
```ts
import { formatHold } from '../cart/holdTimer';
```
Add `onReservedBlock` to the `Props` interface:
```ts
  // Fired when the shopper tries to KEEP a piece held by someone else.
  onReservedBlock?: (item: FieldItem) => void;
```
Destructure it in the component signature (add `onReservedBlock` to the params), and add reserved state near the other hooks:
```ts
  const [nowTs, setNowTs] = useState(() => Date.now());
  const reserved = typeof item.reservedUntil === 'number' && item.reservedUntil > nowTs;
  useEffect(() => {
    if (!reserved) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [reserved]);
```

- [ ] **Step 3: Block the keep in `fire`** (covers both drag-commit and the 🛒 button). Replace `fire`:
```ts
  function fire(action: SwipeAction) {
    // A held piece can't be grabbed — notify and bounce back, but favorite/pass
    // still work so the shopper can save it for later or skip it.
    if (action === 'keep' && reserved) {
      onReservedBlock?.(item);
      springBack();
      return;
    }
    haptic();
    if (action === 'keep') onKeep(item);
    else if (action === 'pass') onPass(item);
    else onFavorite(item);
  }
```

- [ ] **Step 4: Render the locked overlay.** Add a `swipe-card--reserved` class when reserved and a badge. On the root `motion.div`, change the className to include the reserved modifier:
```tsx
      className={`swipe-card ${item.lastChance ? 'swipe-card--last-chance' : ''} ${reserved ? 'swipe-card--reserved' : ''}`}
```
And add the badge as the first child inside the card (right after the opening `motion.div`'s children begin — e.g. just before the `last-chance-banner` block):
```tsx
      {reserved && (
        <div className="swipe-card__reserved" aria-hidden="true">
          🔒 {t('pd.reserved')} · {formatHold(item.reservedUntil! - nowTs)}
        </div>
      )}
```
(`t` and `useT` are already in this component.)

- [ ] **Step 5: Thread the prop through `SwipeDeck`.** In `frontend/src/components/SwipeDeck.tsx`, add `onReservedBlock` to its `Props`:
```ts
  onReservedBlock?: (item: FieldItem) => void;
```
Destructure it in the component params, and pass it to `<SwipeCard ... />`:
```tsx
            onReservedBlock={onReservedBlock}
```

- [ ] **Step 6: Wire the toast in `App.tsx`.** Find where `<SwipeDeck ... />` is rendered and add the prop (reuses the existing `toast.reservedHeld` string):
```tsx
            onReservedBlock={(item) => flash(t('toast.reservedHeld', { title: item.title }), 'error')}
```

- [ ] **Step 7: Add styles** — append to `frontend/src/App.css`:
```css
/* Locked (held by another shopper) deck card */
.swipe-card--reserved .swipe-card__image,
.swipe-card--reserved .swipe-card__body {
  filter: grayscale(0.5) brightness(0.92);
}
.swipe-card__reserved {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(20, 16, 10, 0.82);
  color: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.2px;
}
```

- [ ] **Step 8: Build check.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 9: Commit**
```bash
git add frontend/src/types.ts frontend/src/components/SwipeCard.tsx frontend/src/components/SwipeDeck.tsx frontend/src/App.tsx frontend/src/App.css
git commit -m "feat(reservations): locked reserved cards in the deck — block keep, allow favorite"
```

---

## Task 3: Freed-favorite detector (pure) + tests

**Files:**
- Create: `frontend/src/favorites/freedAlert.ts`
- Test: `frontend/src/favorites/freedAlert.test.ts`

- [ ] **Step 1: Write the failing test** (`frontend/src/favorites/freedAlert.test.ts`):
```ts
import { describe, it, expect } from 'vitest';
import { detectFreedFavorites } from './freedAlert';

const NOW = 1_000_000;
const reserved = (id: string) => ({ id, reservedUntil: NOW + 60_000 });
const free = (id: string) => ({ id });

describe('detectFreedFavorites', () => {
  it('fires for a piece that went reserved -> available', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [free('a')], NOW)).toEqual(['a']);
  });

  it('does not fire for a still-reserved piece', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [reserved('a')], NOW)).toEqual([]);
  });

  it('does not fire for a piece that disappeared (sold/removed)', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [free('b')], NOW)).toEqual([]);
  });

  it('treats an expired reservedUntil as freed', () => {
    const prev = new Set(['a']);
    expect(detectFreedFavorites(prev, [{ id: 'a', reservedUntil: NOW - 1 }], NOW)).toEqual(['a']);
  });

  it('returns every freed id', () => {
    const prev = new Set(['a', 'b']);
    expect(detectFreedFavorites(prev, [free('a'), free('b')], NOW).sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run it (fails — no module).**
Run: `cd frontend && npx vitest run src/favorites/freedAlert.test.ts`
Expected: FAIL — cannot find `./freedAlert`.

- [ ] **Step 3: Implement** (`frontend/src/favorites/freedAlert.ts`):
```ts
// Pure detector: given the ids that were reserved last poll and the current
// favorites lines, return the ids that just became available (still present,
// previously reserved, no longer held). Used to fire a "now available" toast.
export function detectFreedFavorites(
  prevReservedIds: Set<string>,
  lines: { id: string; reservedUntil?: number }[],
  now: number,
): string[] {
  const freed: string[] = [];
  for (const line of lines) {
    const stillReserved = typeof line.reservedUntil === 'number' && line.reservedUntil > now;
    if (prevReservedIds.has(line.id) && !stillReserved) freed.push(line.id);
  }
  return freed;
}

// Current reserved ids in a favorites list (for the next comparison).
export function reservedIdsOf(
  lines: { id: string; reservedUntil?: number }[],
  now: number,
): Set<string> {
  return new Set(
    lines.filter((l) => typeof l.reservedUntil === 'number' && l.reservedUntil > now).map((l) => l.id),
  );
}
```

- [ ] **Step 4: Run it (passes).**
Run: `cd frontend && npx vitest run src/favorites/freedAlert.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/favorites/freedAlert.ts frontend/src/favorites/freedAlert.test.ts
git commit -m "feat(reservations): pure detector for freed favorites"
```

---

## Task 4: Freed-favorite poll + toasts (i18n)

**Files:**
- Modify: `frontend/src/i18n/translations.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the toast strings.** In `frontend/src/i18n/translations.ts`, after the `toast.reservedHeld` entry:
```ts
  'toast.favAvailable': {
    fr: '⭐ {title} est de nouveau disponible !',
    ar: '⭐ {title} متاحة من جديد!',
    en: '⭐ {title} is available again!',
  },
  'toast.favAvailableN': {
    fr: '⭐ {n} favoris sont de nouveau disponibles !',
    ar: '⭐ {n} من المفضلة متاحة من جديد!',
    en: '⭐ {n} favorites are available again!',
  },
```

- [ ] **Step 2: Add the poll + detection in `App.tsx`.** Add the imports:
```ts
import { detectFreedFavorites, reservedIdsOf } from './favorites/freedAlert';
```
Add a constant near the top of the file (with the other module constants):
```ts
const FREED_POLL_MS = 20_000; // how often we re-check held favorites
```
Inside the `App` component, add a ref + two effects (place them after `favorites` state and `refreshFavorites` are defined):
```ts
  // Toast when a favorited held piece becomes available again.
  const prevReservedFav = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = Date.now();
    const freed = detectFreedFavorites(prevReservedFav.current, favorites.lines, now);
    if (freed.length === 1) {
      const line = favorites.lines.find((l) => l.id === freed[0]);
      flash(t('toast.favAvailable', { title: line?.title ?? '' }));
    } else if (freed.length > 1) {
      flash(t('toast.favAvailableN', { n: freed.length }));
    }
    prevReservedFav.current = reservedIdsOf(favorites.lines, now);
  }, [favorites, t]);

  // Light poll while ≥1 favorite is held, so we catch an early drop too.
  useEffect(() => {
    const hasReserved = favorites.lines.some(
      (l) => typeof l.reservedUntil === 'number' && l.reservedUntil > Date.now(),
    );
    if (!hasReserved) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void refreshFavorites();
    }, FREED_POLL_MS);
    return () => window.clearInterval(id);
  }, [favorites, refreshFavorites]);
```
(`useRef` is already imported in `App.tsx`; if not, add it to the `react` import. `flash`, `t`, `favorites`, and `refreshFavorites` are existing.)

- [ ] **Step 3: Build + tests.**
Run: `cd frontend && npm run build` → no errors.
Run: `cd frontend && npx vitest run` → all PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/i18n/translations.ts frontend/src/App.tsx
git commit -m "feat(reservations): toast when a favorited held piece becomes available"
```

---

## Task 5: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Full suites.**
Run: `cd backend && npm test` → all PASS.
Run: `cd frontend && npx vitest run` → all PASS.

- [ ] **Step 2: Two-shopper manual check.** Start backend (`npm run start:dev`) + frontend (`npm run dev`). Two browsers (normal + incognito = two anon ids), and make sure you're on the **real backend** (not demo — the deck shows your DB items, not the sample set):
1. In browser A, swipe a piece right (hold it).
2. In browser B, find that same piece in the deck → it shows a **"🔒 Réservé · MM:SS"** locked card.
3. In browser B, **swipe it right** → it springs back + toast *"Déjà réservé par un autre acheteur — swipe vers le haut ⭐…"*.
4. In browser B, **swipe it up** → it's favorited (check the ⭐ drawer; it shows the countdown).
5. In browser A, **remove it from the cart** (early drop). Within ~20s, browser B gets *"⭐ {title} est de nouveau disponible !"*.

- [ ] **Step 3: Commit (any fixups).**
```bash
git add -A && git commit -m "test(reservations): verification fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** held pieces stay in deck + tagged (T1); FieldItem type (T2 Step 1); locked card render + live countdown (T2 Steps 2,4,7); swipe-right blocked + notification, favorite/pass allowed (T2 Step 3); deck/App wiring of the toast (T2 Steps 5,6); pure detector + tests (T3); poll + freed toast + i18n (T4); demo-mode note (spec only — no code). Covered.
- **Type consistency:** `reservedUntil` on `FieldResponse` items (backend T1) ↔ `FieldItem` (frontend T2); `onReservedBlock(item: FieldItem)` consistent across SwipeCard (T2 Step 2), SwipeDeck (T2 Step 5), App (T2 Step 6); `detectFreedFavorites`/`reservedIdsOf` signatures consistent between T3 and T4; i18n keys `toast.favAvailable`/`toast.favAvailableN` match between T4 Step 1 and Step 2.
- **Reuse:** the swipe-right block reuses the existing `toast.reservedHeld` string (no new key); the 409 server block stays as the safety net.
- **Execution note:** Tasks 2 and 4 require reading the exact current `SwipeCard.tsx` / `SwipeDeck.tsx` / `App.tsx` regions and matching their params/JSX before editing.
