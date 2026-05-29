# Fripa — Swipe Deck (Tinder/Bumble model) Design

**Date:** 2026-05-29
**Branch:** `feat/swipe-deck` (off `feat/floating-field`)
**Supersedes:** the floating-field UI (`docs/superpowers/specs/2026-05-26-floating-thrift-design.md`). See **ADR-0003** (to be written) for the reversal rationale.

## Goal

Make the whole app a Tinder/Bumble-style card deck. One garment card at a time, draggable in three directions:

- **→ Droite = Garder** → add to cart.
- **← Gauche = Passer** → fire the existing **90/10 dice** (90% gone forever, 10% resurfaces once as a gold **"Dernière chance"** card). This is a **user-triggered pass** — the action ADR-0001 had removed from the floating-field UI.
- **↑ Haut = Favori** → add to a **favorites / save-for-later list**, separate from the cart. **New feature.**

On-screen buttons mirror all three for mouse/desktop users. Built **desktop-first** (mouse-drag + buttons); mobile-responsive polish is a planned follow-up.

## What is removed

The phantom-crowd scarcity model is retired from the UI. Scarcity now comes purely from the user's own swipe-left dice (the original app's model). These components become unused and are **deleted** (history preserved):

`FloatingField`, `FloatingBox`, `AmbientLayer`, `usePhantomCrowd`, `pickSnatchTarget`, `fieldLayout`, and their tests. The Three.js dust-mote backdrop is dropped (trivial to re-add later). `three` / `@types/three` can stay installed for now (removing them is out of scope).

## What is preserved (untouched in spirit)

- The 90/10 `pass()` dice in `shop.service.ts` — unchanged.
- The batch endpoint `GET /api/items/field` feeds the deck. The deck pops cards one at a time client-side; **"Dernière chance" reprises arrive mixed into the batch** with `lastChance: true`, exactly as today. No new "next card" endpoint is needed.
- Cart, checkout, stock-refresh (ADR-0002), hard reset, the French copy and kraft-paper palette.

---

## Architecture

### Backend — add favorites only

**`shop.service.ts`:**
- Add `favorites: Set<string>` to `UserState` (initialized in `getState`).
- `getField` fresh-filter gains `&& !s.favorites.has(i.id)` so favorited items don't reappear in the deck (same treatment the cart already gets).
- New methods:
  - `addFavorite(userId, itemId)` — validates the item, `favorites.add(id)`, `lastChancePool.delete(id)` (mirrors `addToCart`), returns the favorites list.
  - `removeFavorite(userId, itemId)` — `favorites.delete(id)`, `passed.add(id)` (a removed favorite is a decision: it does not resurface), returns the favorites list.
  - `moveFavoriteToCart(userId, itemId)` — `favorites.delete(id)`, then `addToCart(...)`; returns `{ cart, favorites }`.
  - `getFavorites(userId)` — `{ lines: TShirt[] }` (each favorite once; no quantity).
- `reset` (hard) already wipes the whole state → favorites clear too. `resetSwipes` (stock-refresh) clears only `passed`/`lastChancePool`/`shownLastChance` → **cart and favorites are preserved** (consistent with ADR-0002; no code change needed beyond not touching favorites).

**`types.ts`:** add `export interface FavoritesResponse { lines: TShirt[]; }`.

**`shop.controller.ts`:** add
- `POST /api/favorites` `{ userId, itemId }` → `addFavorite`
- `GET /api/favorites/:userId` → `getFavorites`
- `DELETE /api/favorites/:userId/:itemId` → `removeFavorite`
- `POST /api/favorites/:userId/:itemId/to-cart` → `moveFavoriteToCart`

### Frontend

**`api.ts`:** add
- `pass(itemId)` → `POST /swipes/pass` (the user swipe-left; replaces the `snatch` alias, which is removed).
- `favorite(itemId)` → `POST /favorites`
- `favorites()` → `GET /favorites/:userId`
- `unfavorite(itemId)` → `DELETE /favorites/:userId/:itemId`
- `favoriteToCart(itemId)` → `POST /favorites/:userId/:itemId/to-cart`

**`types.ts` (frontend):** add `FavoritesResponse { lines: TShirt[] }`.

**`SwipeCard.tsx`** (rebuilt) — the single draggable card. One clear job: present an item and report a decision.
- Props: `item: FieldItem`, `onKeep(item)`, `onPass(item)`, `onFavorite(item)`.
- framer-motion `drag` with `x`/`y` motion values. Thresholds: horizontal past `±SWIPE_X` commits keep (right) / pass (left); vertical past `-SWIPE_Y` commits favorite (up). Otherwise it springs back.
- Drag direction drives **overlay stamps** via opacity: `GARDER` (green, right), `PASSER` (red, left), `FAVORI` (gold, up).
- On commit: animate the card flying off in that direction, then call the matching callback.
- Renders the photo, title, brand, price, size/condition/color chips, seller, and — if `item.lastChance` — the **Dernière chance** banner (reuse existing `.last-chance-banner` styles).
- Three action buttons (mouse/desktop, also a11y): **✕ Passer**, **⭐ Favori**, **🛒 Garder** — call the same callbacks as the gestures.
- Reduced-motion: thresholds still work; fly-off transition is instant; no spring wobble.

**`SwipeDeck.tsx`** — the stage.
- Props: `deck: FieldItem[]`, the three `on*` callbacks, `onExhausted`.
- Renders the **top card** plus a faint, non-interactive **peek of the next card** behind it (depth cue).
- Stable per-card `key` (the item id is unique within a batch) so framer `AnimatePresence` animates the exiting card cleanly.

**`App.tsx`** — owns deck + cart + favorites + toast + exhaustion.
- `deck: FieldItem[]` state; `seen` ref to avoid re-queuing items already on/through the deck.
- `topUp()` shifts cards in; when the deck length drops below a small threshold (e.g. 4), fetch another `api.field(60)` batch and append unseen items; if the fetch returns nothing new and `remaining === 0`, set `exhausted`.
- `handleKeep` → `api.add`, refresh cart, toast "Ajouté au panier", advance.
- `handlePass` → `api.pass`; if the card was `lastChance`, toast "Parti pour de bon 👋"; advance.
- `handleFavorite` → `api.favorite`, refresh favorites, toast "Gardé pour plus tard ⭐", advance.
- `stockRefresh` / `hardReset` unchanged in spirit (refresh favorites too).
- Empty state uses the existing dual-CTA `EmptyState` (stock-refresh primary, hard reset secondary).

**`Header.tsx`** — add a **♥ favorites** button with a count badge, opening the favorites drawer (next to the existing cart button).

**`FavoritesDrawer.tsx`** (new, same pattern as `Cart.tsx`) — lists favorites; per line: **🛒 Mettre au panier** (`favoriteToCart`) and **🗑 Retirer** (`unfavorite`). Empty: a short hint.

**`Cart.tsx`** — unchanged except it already had its copy updated; no further change.

**CSS (`App.css`):** add deck/card-stack styles, the three overlay stamps, the favorites drawer (reuse drawer styles). Remove the now-dead floating-field block. Desktop-first sizing (a centered card column ~420–460px feels right for a deck even on desktop; the deck is the exception to "wide stage" — Tinder decks are columnar).

---

## Data flow

```
App.deck (FieldItem[])  ── top ──▶  SwipeDeck ──▶ SwipeCard (top + peek)
        ▲                                              │ gesture / button
        │ topUp() when low                             ▼
   api.field(60) ◀───────────────────────  onKeep / onPass / onFavorite
        │                                              │
        └── excludes passed/cart/favorites/shown       ├ keep     → api.add        → cart
            (+ 10% Dernière chance reprise)            ├ pass     → api.pass        → 90/10 dice
                                                       └ favorite → api.favorite    → favorites
```

## Error handling

- Each action optimistically removes the top card, then awaits the API call; on failure, `console.error` and a toast ("Oups, réessaie"), and the card is restored to the front of the deck. (Same forgiving posture as the current `App`.)
- `getItem` 404 stays a NestJS `NotFoundException`.

## Testing (TDD)

**Backend (`shop.service.spec.ts`):**
- `addFavorite` adds to favorites and removes any pending reprise; `getFavorites` lists it.
- `getField` excludes favorited items.
- `removeFavorite` drops it from favorites and it does not resurface in the deck.
- `moveFavoriteToCart` removes from favorites and appears in the cart.
- `resetSwipes` preserves favorites (and cart); `reset` clears them.

**Frontend (`SwipeCard.test.tsx`):**
- Clicking **Garder** / **Passer** / **Favori** buttons calls the right callback with the item.
- A horizontal drag past threshold commits keep/pass; an upward drag past threshold commits favorite (simulate via the component's drag-end handler).
- `lastChance` renders the Dernière chance banner.

Deck top-up / exhaustion logic is covered by a small `SwipeDeck`/App-level test where practical; otherwise verified live.

## Docs

- **ADR-0003** — "Revert to a swipe deck; user-triggered pass returns; phantom crowd retired; favorites added." Reference and partially supersede ADR-0001.
- **CONTEXT.md** — un-retire the swipe card; redefine **Pass** as user-triggered again (swipe-left); add **Favori**; note the phantom crowd / Field / Box / Snatch / Reveal / Grab terms are retired with the floating field.
- **README.md** — update the pitch and the "logique métier" section to describe the three-way swipe.

## Out of scope (YAGNI)

- Real auth, persistence beyond in-memory, undo/rewind ("back" swipe), match animations, mobile-specific layout tuning (planned follow-up), removing `three` from package.json.
