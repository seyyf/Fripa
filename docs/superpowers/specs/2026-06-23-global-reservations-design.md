# Global Reservations + Intro Card — Design Spec

**Date:** 2026-06-23
**Status:** Approved, ready for implementation plan

## Goal

Make a swipe-right (garder) a **real, global** 15-minute reservation: the piece
is locked for that shopper, leaves everyone else's deck, and shows
"Réservé · revient dans MM:SS" on its detail page until the hold lapses or the
holder checks out. Plus a one-time "Comment ça marche" intro card teaching the
core rules, internationalised (FR/AR/EN).

## Decisions (locked during brainstorming)

1. **Hold is global** (not the current per-user soft hold). Swipe-right locks the
   piece for everyone for `CART_TTL_MS` (now 15 min).
2. **Others see it locked, not gone:** pulled from the swipe **deck** (clean swipe
   flow), but shown as **"Réservé · revient dans MM:SS"** on the **detail page**
   and reflected in **favorites**. Released automatically on expiry.
3. **Phantom crowd is OUT of scope** — it's currently client-side on the hidden
   catalogue grid (dormant). A server-side phantom that places temporary global
   holds is a **separate follow-up spec**.
4. **Intro card** = one-time overlay on first visit, gated by its own
   `localStorage['fripa-intro-seen']`, wired through `t()` for FR/AR/EN.
5. **Reserved piece on detail = fully locked** (no grab, no favorite) with the
   countdown.

## Storage approach (chosen: A — scan, no new structure)

ShopService runs as a **single Node process** (one Render instance,
single-threaded), so per-user carts stay the source of truth and "held by
another user" is derived by scanning live holds. No new map to keep in sync →
no drift. Because JS is single-threaded, two shoppers grabbing the same piece
are serialised — first wins, second is blocked — with no race.

A helper computes live holds, honouring the TTL inline:

```
// itemId -> holder userId, for every cart hold still within CART_TTL_MS.
private liveHolds(now): Map<string, string>   // scans this.states
private heldByOther(itemId, userId, now): boolean
```

(Expired holds are simply absent from the result, so release is automatic — no
separate global expiry pass is needed beyond the existing per-user `expireCart`.)

## Backend changes (`backend/src/shop/`)

- **`shop.service.ts`**
  - `cartAdd` (shared by swipe-keep and move-from-favorites): if
    `heldByOther(itemId, userId, now)` → throw
    `ConflictException('Déjà réservé par un autre acheteur.')`. Self/free →
    proceed. The `MAX_CART_HOLDS = 10` cap is unchanged.
  - `getField` (deck): exclude pieces held by another user (own holds already
    excluded via `isFresh`/`s.cart`).
  - `getOne` (detail): when held by another → `status: 'reserved'` and
    `reservedUntil = holderReservedAt + CART_TTL_MS`.
  - `getSimilar`: drop pieces held by another (keep the rail grabbable).
  - `getFavorites`: flag a favorited piece held by another with `reservedUntil`
    so the drawer shows it locked.
  - `getCatalog` (grid; route hidden but kept consistent): mark held-by-others
    with `reservedUntil` too.
- **`types.ts`**: add `'reserved'` to the `ItemDetail['status']` union; ensure
  `reservedUntil` is available on the favorite line / catalogue item shapes used
  above (the `reservedUntil` field already exists on catalogue items).

The conflict message is thrown in French from the backend (no backend i18n yet);
the frontend surfaces it verbatim. Translating backend messages is a future item.

## Frontend changes (`frontend/src/`)

- **Product detail** (`components/ProductDetailContent.tsx` / `ProductDetail.tsx`):
  when `status === 'reserved'`, render a **"Réservé · revient dans MM:SS"** badge
  (countdown from `reservedUntil` via the existing `formatHold` in
  `cart/holdTimer.ts`), and **disable** the add-to-cart and favorite actions.
  New `t()` keys: `pd.reserved`, `pd.reservedReturnsIn`.
- **Favorites drawer** (`components/FavoritesDrawer.tsx`): a reserved favorite
  shows a lock/"Réservé" and its move-to-cart is disabled. New key:
  `fav.reserved`.
- **Grab conflict**: a 409 from `cartAdd` already bubbles its message through the
  existing toast path (`errMsg` in `App.tsx`) — surfaces "Déjà réservé par un
  autre acheteur."
- **Deck**: no change — held pieces are absent from the field response.

## Intro card (`frontend/src/components/IntroCard.tsx`)

- A modal/overlay shown **once** on first visit, gated by
  `localStorage['fripa-intro-seen']` (separate from the gesture demo's
  `fripa-coached` — both can run; intro first, then the deck + gesture demo).
- Mounted at the shopper app root (`App.tsx`), above the deck.
- Three lines + a "C'est parti" button, all via `t()`:
  - `intro.title` — "Comment ça marche"
  - `intro.swipe` — "Swipe : garder réserve la pièce 15 min rien que pour toi · passer · favori"
  - `intro.cap` — "Jusqu'à 10 réservations à la fois"
  - `intro.cod` — "Paiement à la livraison"
  - `intro.cta` — "C'est parti"
- **i18n:** add FR/AR/EN entries for every new key in `i18n/translations.ts`.
- Respects nothing special for reduced-motion (it's a static card); a simple fade
  is fine.

## Edge cases

- **Server restart** clears in-memory holds (same as all current shop state) —
  acceptable for 15-min holds; noted.
- **Single-instance only:** correct because there's one Render process; multiple
  instances would need shared hold storage (out of scope, noted).
- **Holder's own view** is unchanged: the piece sits in their cart with the
  existing countdown; they can still check out (→ permanent sold).
- **Lingering on a detail page** when someone else grabs the piece: it flips to
  "Réservé" on the next load/refresh of that page (no live socket).

## Testing

- **`shop.service.spec.ts`**: `cartAdd` throws when the piece is held by another
  user; `getField` excludes held-by-others; `getOne` returns `reserved` +
  `reservedUntil`; `moveFavoriteToCart` throws when held by another; a hold past
  `CART_TTL_MS` is treated as released (the piece is grabbable / back in the deck);
  the 10-cap and own-hold paths still pass. Update any existing test that assumed
  two distinct users could both hold the same piece.
- **Frontend**: `IntroCard` renders once and sets `fripa-intro-seen` on dismiss
  (and does not render when the flag is set); the detail reserved state shows the
  countdown and disables actions.

## Out of scope / future

- Server-side phantom crowd placing temporary global holds (next spec).
- Backend i18n for the conflict message.
- Shared hold storage for multi-instance scaling.
- Live (socket/poll) flip of the detail page the moment a piece is grabbed.
