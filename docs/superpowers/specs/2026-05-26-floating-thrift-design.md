# Fripa — La fripa flottante

**Date:** 2026-05-26
**Status:** Approved design, ready for implementation planning

## Summary

Replace Fripa's one-card-at-a-time swipe selection with a full-screen field of
blurry, rounded clothing boxes that drift slowly over warm kraft paper. Tapping
(or hovering) a box sharpens it to reveal the piece; tapping *Ajouter* grabs it.
A simulated crowd of phantom shoppers periodically snatches un-grabbed boxes —
that snatch reuses the existing 90%-gone dice, and snatched pieces keep their
10% chance to drift back glowing as *Dernière chance*.

The redesign is **mobile-first**. Tap is the primary interaction; hover is a
desktop bonus. The signature scarcity business logic, the French/Tunisian voice,
and the existing palette are preserved.

## Decisions locked during brainstorming

| Question | Decision |
|---|---|
| "People picking before each other" | **Simulated crowd** (phantom shoppers), not real multiplayer. Stays on the single-player in-memory backend. |
| "Infinite clothes pictures" | **Expand the catalog** to ~60 items so the recycling field has real variety. |
| Grab vs. pass | **Hover/tap reveals, click grabs; the crowd snatches the rest.** Snatching IS the new "pass" and drives the 90/10 dice. |
| Platform | **Mobile-first**; must feel great on phones. Hover degrades to tap-to-reveal. |
| Rendering architecture | **Hybrid**: DOM `<img>` boxes animated by framer-motion, with Three.js as a downgradable ambient depth layer behind them. |
| Visual mood | **Friperie douce** — warm kraft paper, soft shadows, calm slow drift. |

## What changes / what stays

**Replaces:** the swipe stage. `SwipeCard.tsx` retires.

**New:** the floating field, the reveal/grab interaction, the phantom-crowd
snatch loop, a Three.js ambient layer, and a batch field endpoint.

**Stays untouched:** `Header` (cart count, reset), `Cart` drawer, `EmptyState`,
the scarcity logic in `shop.service.ts` (`LAST_CHANCE_PROBABILITY = 0.1`,
`LAST_CHANCE_SURFACE_RATE = 0.2`, the per-user `passed` / `lastChancePool` /
`shownLastChance` / `cart` sets), and the design tokens (`#E2231A` flag red,
`#D4A017` gold, `#fff8f1` kraft paper) and French copy.

## The floating field (Friperie douce)

- Warm kraft background. Boxes are rounded (~20px radius) clothing photos with
  soft shadows.
- **Idle box:** blurred (~5–7px), slightly faded, small, drifting on a gentle
  continuous sine path via framer-motion. Calm, never frantic.
- **Three.js ambient layer** behind the boxes: faint warm dust motes / soft
  bokeh with subtle parallax. Decorative only.
- **Responsive density:** ~8–10 boxes visible on mobile, ~16–20 on desktop,
  drawn from the larger pool.

## Interaction model (mobile-first)

Tap is primary; hover (desktop) triggers the same reveal.

- **Reveal:** tap/hover a box → blur animates to 0, the box scales up (~1.4×),
  rises above the others, drift pauses, the rest of the field dims slightly. A
  compact panel shows **title · brand · price · size/condition/color chips ·
  seller** and a large **🛒 Ajouter** button. (Same fields as today's card,
  compacted.)
- **Grab:** tap *Ajouter* → `add(itemId)` → "into the basket" animation → a
  replacement drifts in. Toast: *Ajouté au panier*.
- **Dismiss:** tap elsewhere / tap-again (mobile) / mouse-leave (desktop) →
  the box blurs and rejoins the drift.
- A box currently being focused is **safe** from snatching.

## The phantom crowd = the scarcity mechanic

- A timer snatches a random *un-focused* box every few seconds (tunable
  `SNATCH_MIN_INTERVAL` / `SNATCH_MAX_INTERVAL`, default 4–8s, scaling with
  field size). Pacing is a named constant so it can be tuned.
- Snatch animation (douce-style): gentle slide-up + soft fade ("poof"), no
  aggressive trails. The client then calls the **existing** `pass(itemId)`,
  which rolls the existing 90/10 dice. Occasional soft toast:
  *Quelqu'un l'a pris… 👀*.
- The ~10% that land in `lastChancePool` drift back later with a **gold pulse
  glow + "Dernière chance"** ribbon (reusing existing last-chance styling).
  Grab it or lose it forever.
- Net effect: the "turn around and it's gone" feeling of a real fripa, now
  *visible* as other shoppers beating you to the piece.

## Architecture (Hybrid)

Frontend units, each with one clear job:

- **`App.tsx`** — orchestrator; holds `boxes: FieldItem[]` (replacing the single
  `current`), cart, toasts; wires field ↔ cart ↔ crowd.
- **`FloatingField.tsx`** — the stage: lays out boxes, hosts the ambient layer,
  runs the phantom-crowd timer, tops the field up as items leave.
- **`FloatingBox.tsx`** — one box: idle drift, reveal, grab, snatch-exit,
  last-chance glow.
- **`AmbientLayer.tsx`** — the Three.js canvas. Use raw `three` (kept lean for
  mobile); `@react-three/fiber` is a noted alternative if React integration
  friction outweighs bundle cost.
- **`usePhantomCrowd.ts`** — snatch-timer hook with injectable RNG/clock for
  deterministic testing.
- **`useFieldLayout.ts`** — box placement + drift-path helpers.
- Retire **`SwipeCard.tsx`**. Keep `Header`, `Cart`, `EmptyState` with minor
  tweaks.

New types: `FieldItem = TShirt & { lastChance: boolean; key: string }` (a `key`
distinguishes recycled instances of the same item in the field).

## Catalog & backend

- **Catalog:** grow `backend/src/shop/items.data.ts` from 16 → ~60
  Tunisian-flavored entries, using `picsum.photos` placeholder seeds (real
  photos swapped in later). Variety so the recycling field rarely repeats
  on screen.
- **New endpoint** `GET /api/items/field?userId=X&count=N` → returns up to N
  currently-available items (excludes `passed`, in-`cart`, and
  `shownLastChance`), occasionally mixing in a `lastChance` reprise from
  `lastChancePool`. It is the batch sibling of today's `getNext`, reusing the
  same `UserState`. `getNext` / `GET /api/items/next` is removed.
- `pass`, `cart` (add/get/remove), `checkout`, `reset` endpoints unchanged.
- Front-end `api.ts`: replace `next()` with `field(count)`; keep the rest.

## Performance & accessibility (mobile-first budgets)

- Field photos request a small size (~300×400), `loading="lazy"`,
  `decoding="async"`; full-res only fetched on reveal.
- Three.js: `pixelRatio` capped (≤1.5 on mobile), modest particle count
  (~80–150), render paused on `visibilitychange` (tab hidden), disabled under
  `prefers-reduced-motion`, plus a manual perf/"calm mode" toggle.
- Boxes are real focusable `<button>`s → keyboard reveal (focus) and grab
  (Enter/Space); `alt`/labels from the item title; the field is exposed to
  screen readers as a list. `prefers-reduced-motion` → drift and particles off,
  falling back to a calm near-static grid.

## Out of scope (YAGNI)

Real multiplayer, auth, payments, DB persistence, real product photos, sound
effects, gyroscope parallax. Each is a future hook; none is built now.

## Testing (proportional — no test setup exists today)

- **Backend:** unit-test `getField` (exclusions, count cap, reprise surfacing)
  and confirm the `pass` 90/10 dice still behave. Adds a minimal test runner to
  the Nest app.
- **Frontend:** test `usePhantomCrowd` deterministically (injected RNG/timers)
  and `FloatingBox` reveal/grab/snatch state transitions. Light touch, matching
  the project's current scale.

## Open tunables (sensible defaults, adjust during build)

- Snatch pacing: 4–8s per snatch.
- Catalog size: ~60 items.
- Visible box counts: ~8–10 mobile / ~16–20 desktop.
