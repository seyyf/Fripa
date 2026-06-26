# Reserved Cards Stay in the Deck + Freed-Favorite Alert — Design Spec

**Date:** 2026-06-26
**Status:** Approved, ready for implementation plan

## Goal

Change the global-reservation UX so a held piece **stays visible in every
shopper's deck as a locked card** (instead of disappearing). Others can't
swipe it right (grab) — they get a notification suggesting they swipe up to
favorite it — and when the hold frees, anyone who favorited it gets an in-app
"now available" toast.

## Decisions (locked during brainstorming)

1. **Held pieces stay in the deck** for everyone, rendered locked — this
   **reverses** the earlier "pull held items out of the deck" decision.
2. The locked card shows a **live countdown** ("🔒 Réservé · MM:SS").
3. **Swipe-right (keep) is blocked** → the card springs back and a toast fires
   (reusing `toast.reservedHeld`). **Swipe-up (favorite)** and **swipe-left
   (pass)** still work.
4. **Notify-when-freed is built now** (not deferred): a light favorites poll
   shows a toast when a favorited held piece becomes available.
5. In-app only; no web push (separate future spec).

## What already exists (keep unchanged)

Global holds are already implemented: per-user carts are the source of truth;
`holderOf`/`heldByOther` scan helpers; `cartAdd` throws `Conflict` ("Déjà
réservé par un autre acheteur."); `getOne` returns `reserved` + `reservedUntil`;
favorites flag reserved lines; `getSimilar` drops held pieces; the detail page
shows the reserved badge + "save for later"; the favorites drawer shows the
countdown; toasts run longer; the hold is 15 min. **All of that stays.**

## Backend changes (`backend/src/shop/`)

- **`shop.service.ts` — `getField`:** stop excluding held-by-others. Instead
  **include** them and tag each with `reservedUntil`. Replace the now-unused
  `heldByOthers` (Set) helper with `heldByOthersMap(userId, now): Map<itemId,
  reservedUntil>` and use it to attach `reservedUntil` when pushing items:
  - `fresh`/`reprise` no longer filter on `blocked`.
  - each pushed item: `{ ...item, lastChance, ...(heldUntil.has(item.id) ? { reservedUntil: heldUntil.get(item.id) } : {}) }`.
  - `remaining` still counts the same fresh/reprise pool (held items now count
    as cards in the deck).
- **`types.ts`:** `FieldResponse` items gain `reservedUntil?: number`.

The `cartAdd` 409 block stays as the server-side safety net (covers a race where
a card was reserved after the deck was fetched).

## Frontend changes (`frontend/src/`)

- **`types.ts`:** `FieldItem` gains `reservedUntil?: number`.
- **`components/SwipeCard.tsx`:**
  - Compute `reserved = typeof item.reservedUntil === 'number' && item.reservedUntil > now`
    with a 1s tick (only while reserved).
  - Render a **locked overlay**: dimmed card + a "🔒 Réservé · MM:SS" badge
    (via `formatHold`).
  - **Block keep:** in the drag-commit path, if `reserved` and the decided
    action is `'keep'`, call a new `onReservedBlock?(item)` prop and spring back
    instead of firing keep. The **🛒 keep button** does the same. **Favorite
    (⭐ / swipe-up)** and **pass (✕ / swipe-left)** are unaffected.
  - The first-visit demo never animates a reserved card's keep (the demo is a
    scripted nudge; reserved blocking only intercepts a real keep commit, so no
    special handling needed — but the demo card is the top card, which is rarely
    reserved; acceptable).
- **`components/SwipeDeck.tsx`:** thread an `onReservedBlock` prop down to the
  card; the deck forwards it to the parent.
- **`App.tsx`:** pass `onReservedBlock={(item) => flash(t('toast.reservedHeld', { title: item.title }), 'error')}` to the deck. (Reuses the existing toast — no new string for the block.)

## Freed-favorite alert (`frontend/src/favorites/`)

- **`freedAlert.ts`** (new, pure + unit-testable):
  `detectFreedFavorites(prevReservedIds: Set<string>, lines: { id: string; reservedUntil?: number }[], now: number): string[]`
  — returns ids present in `lines`, in `prevReservedIds`, and **no longer
  reserved** (`reservedUntil` absent or `<= now`).
- **`App.tsx`:**
  - A ref `prevReservedIds` and an effect that, whenever `favorites` changes,
    runs `detectFreedFavorites`, toasts any freed pieces, then updates the ref to
    the current reserved set.
  - A poll effect: while `favorites` contains ≥1 reserved line and the tab is
    visible, `refreshFavorites()` every `FREED_POLL_MS` (≈20_000). It stops when
    no favorite is reserved (no load otherwise) and pauses on `document.hidden`.
  - Toast copy: one freed → `toast.favAvailable` `{title}`; several →
    `toast.favAvailableN` `{n}`.
- **i18n** (`translations.ts`): add `toast.favAvailable`, `toast.favAvailableN`
  (FR/AR/EN).

## Edge cases

- **Re-grab race:** they swipe up to favorite or the card frees and they grab,
  but someone re-took it → the existing 409 path handles it gracefully.
- **Sold (not freed):** a favorite that disappears from the list is not treated
  as "available" (the helper only fires for ids still present).
- **Demo mode** (single-user mock): no other holders → no locked cards and no
  freed toasts. Expected; noted.
- **Scoped out:** favorite an *available* piece that someone grabs *later* — the
  poll only runs once the client has seen a favorite as reserved, so that exact
  sequence may not alert. The described flow (favorite a *held* card → notified
  when it frees) is fully covered.

## Testing

- **Backend** `shop.service.spec.ts`: `getField` now **includes** a held piece
  and tags it with `reservedUntil` (was: excluded); the 409 grab-block still
  throws. Update the prior "hides a held piece from other users' decks" test to
  assert it's now **present with `reservedUntil`**.
- **Frontend** `freedAlert.test.ts`: reserved→available fires; still-reserved
  doesn't; removed/sold doesn't; multiple freed returns all.
- The SwipeCard block is thin UI wiring; covered by build + the existing card
  tests (extend if a seam exists).

## Out of scope / future

- Web push (app-closed notifications).
- Demo-mode latch hardening (flagged separately).
- Broadening the freed alert to favorites that were available-then-grabbed-later.
