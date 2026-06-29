# Desktop Filter Rail — Design Spec

**Date:** 2026-06-29
**Status:** Approved, ready for implementation plan

## Goal

On wide screens, move the deck's controls (Reviens + Filtrer + category/size
quick-chips) out of the row above the card and into a **left rail** in the
otherwise-empty margin, so the swipe card reclaims that vertical space and the
picture gets bigger. Phones and tablets are unchanged.

## Decisions (locked during brainstorming)

1. **Rail contents:** all controls — the **Reviens** + **Filtrer** toolbar AND
   the **category/size quick-chips** — move into the left rail on desktop.
2. **Breakpoint:** the rail appears at **≥1100px** (room for ~220px rail +
   ~440px deck + margins). 601–1099px keeps the current single centered column;
   ≤600px keeps the current mobile layout.
3. **Zero-risk to existing layouts:** achieved with `display: contents`
   wrappers (below), so nothing changes below 1100px.

## Approach: `display: contents` wrappers

Two wrapper divs are added around the existing `/shop` children, but made
**invisible to layout by default** so current phone/tablet rendering is byte-for-
byte unchanged; a desktop media query "turns them on" as a two-column layout.

### Markup (`App.tsx`, `/shop` route)

```
<main className="stage">
  <div className="stage__rail">
    <div className="shop-toolbar"> …Reviens / Filtrer… </div>
    <QuickFilters … />
  </div>
  <div className="stage__main">
    <SizePrompt />
    {showEmpty ? <empty/EmptyState> : <SwipeDeck … />}
    {!showEmpty && <p className="hint">…</p>}
  </div>
</main>
```

No logic changes — only the two wrapper `<div>`s are added around the existing
elements (same order, same props).

### CSS (`App.css`)

- **Base:** `.stage__rail, .stage__main { display: contents; }` — the wrappers
  vanish; their children participate directly in `.stage` exactly as today. So
  the existing `@media (max-width: 600px)` mobile-fit block and the existing
  `@media (min-width: 601px)` centered-desktop block keep working untouched.

- **New `@media (min-width: 1100px)` block** (after the existing desktop block,
  so it wins the cascade):
  - `.stage { flex-direction: row; justify-content: center; align-items: stretch; gap: 36px; }`
  - `.stage__rail { display: flex; flex-direction: column; gap: 14px; width: 220px; flex: 0 0 220px; align-self: center; }`
  - `.stage__rail .shop-toolbar { flex-direction: column; gap: 8px; max-width: none; }`
  - `.quickfilters__chips { flex-direction: column; align-items: flex-start; flex-wrap: wrap; overflow: visible; }`
    (and re-show the size separator: `.quickfilters__sep { display: none; }` since
    a horizontal divider is meaningless in a vertical list).
  - `.stage__main { display: flex; flex-direction: column; justify-content: center; flex: 0 1 460px; min-width: 0; min-height: 0; }`
  - `.deck { flex: 1 1 auto; min-height: 0; max-height: 700px; width: min(440px, 100%); }`
    (the deck flex-fills `.stage__main`; same card-fit technique, now scoped here).
  - Keep the deck/card fit rules that already exist for desktop (peeks hidden,
    `.swipe-card` flex column height 100%, `.swipe-card__image` flex-fill) — they
    apply via the existing ≥601 block and continue to hold.

## Edge cases

- **Empty state** (`.empty` / `EmptyState`) lives in `.stage__main`, so it
  centers in the deck column on desktop and stacks normally on mobile.
- **`SizePrompt`** (conditional) lives in `.stage__main`; harmless when absent.
- **601–1099px**: `.stage__rail`/`.stage__main` stay `display: contents`, so the
  layout is the current centered single column — no half-built rail.
- **Filter drawer** (the full `Filtrer` modal) is unchanged; only the inline
  quick-chips relocate.

## Testing

Pure markup/CSS, no behavior change:
- `npm run build` clean; existing suite stays green (no logic touched).
- Manual eyeball at three widths: **≥1100px** (rail on the left, taller card),
  **~800px** (current centered column, no rail), **≤600px** (unchanged mobile
  top bar + fitted card).

## Out of scope / future

- A right-hand rail (recently-viewed / favorites) — the "Option C" idea.
- Moving the language switcher / cart into the rail (they stay in the header).
