# Immersive Mobile Deck + Desktop Image Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile `/shop` deck a full-screen, app-like swipe experience (no header, full-bleed photo, info + buttons overlaid, floating favoris/cart/filter/undo), and fix the blank card image in the ≥1100px desktop rail.

**Architecture:** Pure CSS/markup, scoped by media queries and `.app:has(.stage)` (the deck route). No swipe/cart/filter logic changes — the floating controls reuse the existing handlers. Desktop fix gives the deck an explicit height so the flex-fill image resolves.

**Tech Stack:** React (markup only) + CSS; existing `t()` i18n; Vitest suite as the regression guard.

**Spec:** `docs/superpowers/specs/2026-06-30-immersive-mobile-deck-design.md`

> **Note on visual tuning:** the exact overlay pixel values (scrim height, price position, control insets) are best-effort and may need one round of on-device nudging — flagged in Task 4. The structure is what matters.

---

## File Structure

- **Modify** `frontend/src/App.tsx` — add the floating deck controls to the `/shop` stage.
- **Modify** `frontend/src/App.css` — desktop image fix; mobile immersive card + chrome-hiding + floating-control styles.

---

## Task 1: Desktop image fix (≥1100px rail)

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Give the deck an explicit height in the ≥1100 block.** In the `@media (min-width: 1100px)` block, replace the `.deck` rule:
```css
  .deck {
    flex: 1 1 auto;
    min-height: 0;
    max-height: 700px;
    width: min(440px, 100%);
  }
```
with:
```css
  /* Explicit height so the card's height:100% resolves through the grid→flex
     chain (otherwise the flex-fill image collapses to 0 and shows blank). */
  .deck {
    flex: 0 0 auto;
    align-self: center;
    height: min(700px, calc(100dvh - 140px));
    width: min(440px, 100%);
  }
```

- [ ] **Step 2: Build + sanity.**
Run: `cd frontend && npm run build`
Expected: no errors. (Visual check is in Task 4 — the photo should show at ≥1100px.)

- [ ] **Step 3: Commit**
```bash
git add frontend/src/App.css
git commit -m "fix(shopper): card image was blank in the desktop rail (give deck a real height)"
```

---

## Task 2: Mobile immersive card (hide chrome + full-bleed overlay)

**Files:**
- Modify: `frontend/src/App.css`

All rules go **inside the existing `@media (max-width: 600px)` block** (the one that already contains `.app:has(.stage)`, `.stage`, `.deck`, `.swipe-card`, etc.). Append them at the end of that block, before its closing `}`.

- [ ] **Step 1: Hide the header, toolbar, and quick-chips on the mobile deck.**
```css
  /* App-like deck: no header / toolbar / inline chips — controls float instead. */
  .app:has(.stage) .app-header {
    display: none;
  }
  .app:has(.stage) .shop-toolbar,
  .app:has(.stage) .quickfilters {
    display: none;
  }
  .app:has(.stage) .stage {
    padding: 0;
    gap: 0;
  }
```

- [ ] **Step 2: Make the photo full-bleed and overlay the info + buttons.**
```css
  /* Photo fills the whole card; info + buttons overlay the bottom. */
  .swipe-card {
    justify-content: flex-end; /* push the in-flow body/actions to the bottom */
    border-radius: 0;
  }
  .swipe-card__image {
    position: absolute;
    inset: 0;
    flex: none;
    border-radius: 0;
  }
  /* The body + actions sit above the photo on a dark scrim, in light text. */
  .swipe-card__body {
    position: relative;
    z-index: 2;
    color: #fff;
    padding: 64px 18px 6px;
    background: linear-gradient(to top, rgba(18, 11, 5, 0.82), rgba(18, 11, 5, 0));
  }
  .swipe-card__actions {
    position: relative;
    z-index: 2;
    background: rgba(18, 11, 5, 0.82);
    border-top: none;
    padding: 6px 16px calc(16px + env(safe-area-inset-bottom));
  }
  .swipe-card__title {
    color: #fff;
  }
  .swipe-card__brand {
    color: rgba(255, 255, 255, 0.82);
  }
  .swipe-card__seller {
    display: none; /* full info lives on the detail view */
  }
  /* Chips read as translucent over the photo. */
  .swipe-card__meta .chip {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    border-color: transparent;
  }
  /* Lift the price chip just above the overlaid title (out of the buttons row).
     Tune the `bottom` value on device if it overlaps the title. */
  .swipe-card__price {
    bottom: 132px;
    right: 16px;
    left: auto;
    top: auto;
  }
```

- [ ] **Step 3: Build.**
Run: `cd frontend && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/App.css
git commit -m "feat(shopper): full-bleed mobile deck card with overlaid info"
```

---

## Task 3: Floating deck controls (favoris / cart / filter / undo)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add the overlay controls to the `/shop` stage.** In `App.tsx`, inside `.stage__main` (right after its opening `<div className="stage__main">`, before `<SizePrompt />`), add:
```tsx
              <div className="deck-overlay" aria-label="Actions">
                <div className="deck-overlay__tl">
                  <button
                    type="button"
                    className={`deck-fab ${filterCount > 0 ? 'deck-fab--active' : ''}`}
                    onClick={() => setFilterOpen(true)}
                    aria-label={t('deck.filter')}
                  >
                    ⚙{filterCount > 0 && <span className="deck-fab__badge">{filterCount}</span>}
                  </button>
                  {historyCount > 0 && (
                    <button
                      type="button"
                      className="deck-fab"
                      onClick={handleUndo}
                      aria-label={t('deck.undo')}
                    >
                      ↩
                    </button>
                  )}
                </div>
                <div className="deck-overlay__tr">
                  <button
                    type="button"
                    className="deck-fab"
                    onClick={() => setFavOpen(true)}
                    aria-label={t('a11y.favorites')}
                  >
                    ⭐{favCount > 0 && <span className="deck-fab__badge">{favCount}</span>}
                  </button>
                  <button
                    type="button"
                    className="deck-fab"
                    onClick={() => setCartOpen(true)}
                    aria-label={t('a11y.cart')}
                  >
                    🛒{cartCount > 0 && <span className="deck-fab__badge">{cartCount}</span>}
                  </button>
                </div>
              </div>
```
(`filterCount`, `historyCount`, `favCount`, `cartCount`, `setFilterOpen`, `handleUndo`, `setFavOpen`, `setCartOpen`, `t` are all already in scope in `App`.)

- [ ] **Step 2: Style the controls — hidden by default, shown only on the mobile deck.** Append to `frontend/src/App.css` (outside any media query):
```css
/* Floating deck controls — only rendered on /shop; shown on the mobile deck. */
.deck-overlay {
  display: none;
}
.deck-overlay__tl,
.deck-overlay__tr {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top));
  z-index: 40;
  display: flex;
  gap: 10px;
}
.deck-overlay__tl {
  left: calc(12px + env(safe-area-inset-left));
}
.deck-overlay__tr {
  right: calc(12px + env(safe-area-inset-right));
}
.deck-fab {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 18px;
  line-height: 1;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  background: rgba(20, 14, 8, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.5);
}
.deck-fab--active {
  background: var(--accent-grad, #e0231a);
}
.deck-fab__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  background: var(--accent, #e0231a);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  border-radius: 999px;
  border: 2px solid var(--paper, #fffdf9);
}
@media (max-width: 600px) {
  .app:has(.stage) .deck-overlay {
    display: block;
  }
}
```

- [ ] **Step 3: Build + full suite.**
Run: `cd frontend && npm run build` → no errors.
Run: `cd frontend && npx vitest run` → all PASS (logic untouched).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat(shopper): floating favoris/cart/filter/undo on the mobile deck"
```

---

## Task 4: Manual verification + tuning

**Files:** none (plus any small CSS nudges).

- [ ] **Step 1: Mobile (≤600px / device or DevTools phone).** On `/shop`:
  - No header, no top chips; the **photo fills the screen**.
  - Bottom overlay shows **title · brand · size/condition** on a dark scrim; the
    **price chip** floats just above it; the **✕ ⭐ 🛒** buttons sit at the bottom.
  - **Top-right:** ⭐ + 🛒 with badges open the favorites / cart drawers.
  - **Top-left:** ⚙ opens the filter drawer; **↩** appears after a pass and undoes.
  - Swipe + tap-to-cycle-angles still work; the action buttons work.
  - *If the price chip overlaps the title*, adjust `.swipe-card__price { bottom }`
    in the mobile block (Task 2 Step 2) and rebuild.
- [ ] **Step 2: Desktop (≥1100px).** The rail layout shows the **photo again** (bug fixed).
- [ ] **Step 3: Tablet (~800px) + other pages (cart, /compte).** Unchanged — header present, normal layout.
- [ ] **Step 4: Commit any tuning.**
```bash
git add -A && git commit -m "style(shopper): tune immersive deck overlay"
```
(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** mobile-only via `@media (max-width:600px)` + `.app:has(.stage)` (T2/T3); header hidden (T2 Step 1); chips/toolbar removed (T2 Step 1); full-bleed photo + bottom overlay with title/brand/size, light text, hidden desc/seller, price kept (T2 Step 2); floating favoris/cart top-right + filter/undo top-left, badges, no language toggle (T3); safe-area insets (T2/T3); desktop image fix (T1); other routes/tablet unchanged (scoping). Covered.
- **No logic change:** floating controls reuse existing state/handlers (`setFavOpen`/`setCartOpen`/`setFilterOpen`/`handleUndo` + counts); the suite guards regressions.
- **Honesty:** flagged that overlay pixel values may need one on-device tuning pass (Task 4) since this can't be eyeballed headlessly.
