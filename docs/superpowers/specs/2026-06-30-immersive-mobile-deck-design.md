# Immersive Mobile Deck (full-screen, app-like) + Desktop Image Fix — Design Spec

**Date:** 2026-06-30
**Status:** Approved, ready for implementation plan

## Goal

On **mobile**, turn the `/shop` swipe deck into a full-screen, app-like
experience: no header, the photo fills the screen, piece info + swipe buttons
overlay the bottom, and favoris / cart / filter / undo float over the image.
Separately, **fix the desktop bug** where the card image is blank in the
≥1100px rail layout.

## Decisions (locked during brainstorming)

1. **Scope: mobile only** (≤600px), **only the `/shop` deck route.** Desktop
   keeps its rail layout; cart/checkout/account pages keep the normal header.
2. **Full-bleed Tinder-style card:** photo fills the screen; a bottom gradient
   carries **title · brand · price · size/condition**; the **✕ ⭐ 🛒** buttons
   sit over that gradient.
3. **Header hidden** on the mobile deck; its controls become floating overlays.
4. **Floating controls:** top-right **favoris ⭐ + cart 🛒** (with badges);
   top-left **Filtrer** + **Reviens (undo)** (undo shown only when available).
   **No language toggle** on the deck (dropped per request).
5. **Top filter chips removed** from the deck — filtering via the existing
   Filtrer drawer.
6. **Desktop:** layout unchanged, but the **blank card image is fixed**.

## A. Mobile immersive deck (≤600px, `/shop` only)

### Header
- Hidden via CSS on the deck route only: `@media (max-width: 600px) { .app:has(.stage) .app-header { display: none } }`. Other routes keep the header.

### Full-bleed card
The `SwipeCard` markup is unchanged; mobile CSS restyles it:
- `.swipe-card` fills the deck (already flex-fills on mobile); `position: relative`.
- `.swipe-card__image` is **absolutely positioned to fill the card** (`inset: 0`),
  so the photo is full-bleed. Tapping halves still cycles angles; the segment
  bars, stamps, glow, and the first-visit demo are unaffected (they live on the
  image layer).
- `.swipe-card__body` and `.swipe-card__actions` are **absolutely positioned at
  the bottom**, above a `linear-gradient` scrim (transparent → dark), with a high
  `z-index` so they stay tappable over the photo.
- Overlay shows **title · brand · size/condition**; the **price** keeps its
  existing badge on the image; the **description and seller are hidden** on the
  card (full info stays on the piece's detail view). Body text + chips restyled
  light/translucent for legibility over the photo.
- The three round swipe buttons (**✕ ⭐ 🛒**) render over the gradient (their
  existing handlers/animation untouched).

### Floating controls (translucent, over the image, mobile-deck only)
A new overlay element is added to the `/shop` stage in `App.tsx`, shown only at
≤600px on the deck (CSS), wired to the **existing** handlers/state:
- **Top-right:** `favoris` (⭐, badge = `favCount`, `onClick=setFavOpen(true)`)
  and `cart` (🛒, badge = `cartCount`, `onClick=setCartOpen(true)`).
- **Top-left:** `Filtrer` (badge = `filterCount`, `onClick=setFilterOpen(true)`)
  and, below it, **Reviens** (undo) — `onClick=handleUndo`, rendered only when
  `historyCount > 0`.
- Buttons are round, translucent (frosted) so they read over any photo.
- The inline `.shop-toolbar` (Reviens/Filtrer) and `<QuickFilters>` chips are
  **hidden on the mobile deck** (their function moves to the floating buttons +
  the filter drawer). The deck-rail wrappers (`.stage__rail`/`.stage__main`)
  stay `display: contents` at ≤600px, so this is additive.

### Reduced-motion / safe areas
- Honour `env(safe-area-inset-*)` for the floating controls and bottom overlay so
  they clear the notch / home indicator on phones (PWA full-screen).

## B. Desktop image fix (≥1100px rail)

In the ≥1100px block the card image (`.swipe-card__image`) collapses to 0
height because the deck's height isn't resolvable through the grid→flex chain for
`height: 100%`. Fix: give the deck an **explicit viewport-relative height**
instead of flex-filling, so the card has a definite height and the image
flex-fills it:
- `.deck { flex: 0 0 auto; height: min(700px, calc(100dvh - 140px)); max-height: none; }`
  (the `140px` covers the header + stage padding). The card `height: 100%` then
  resolves and `.swipe-card__image { flex: 1 1 auto }` fills it.
- Verify the photo shows at ≥1100px; 601–1099px is unchanged (already works).

## Edge cases

- **Empty state** on the mobile deck: the floating controls + hidden header still
  apply; the empty/`EmptyState` block shows centered (it's in `.stage__main`,
  `display: contents` on mobile).
- **Detail / cart / account pages** keep the header (only `.app:has(.stage)`
  hides it, i.e. the deck route).
- **Language:** no toggle on the deck; it remains reachable on other pages'
  headers. (If this proves annoying, adding it to the filter drawer is a small
  follow-up — out of scope here.)
- **Tablet 601–1099px:** unchanged (current centered column).

## Testing

Layout/markup only — swipe/fav/cart/filter/undo logic is untouched, so the
existing suite is the regression guard. Plus manual eyeball:
- **Mobile (≤600px):** full-screen photo, bottom overlay with title/price/size,
  floating ⭐/🛒 (top-right) + Filtrer/Reviens (top-left), no header, no top chips.
  Swipe, tap-to-cycle-angles, the action buttons, fav/cart drawers, and the
  filter drawer all work.
- **Desktop (≥1100px):** rail layout with the **photo visible** again.
- **Tablet (~800px):** unchanged.

## Out of scope / future

- Language toggle on the deck.
- Applying the immersive style to desktop.
- Linking the deck card to its full detail view (the overlay shows essentials only).
