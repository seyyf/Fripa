# Desktop Filter Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On screens ≥1100px, move the deck's controls (Reviens + Filtrer + category/size chips) into a left rail so the swipe card gets more height; phones/tablets unchanged.

**Architecture:** Wrap the `/shop` controls and deck in two `display: contents` wrappers (invisible to layout by default, so ≤1099px is untouched). A `@media (min-width: 1100px)` block turns the wrappers into a two-column row: a left rail + a centered, viewport-filling deck column.

**Tech Stack:** React (markup only) + CSS, Vitest for the unchanged suite.

**Spec:** `docs/superpowers/specs/2026-06-29-desktop-filter-rail-design.md`

---

## File Structure

- **Modify** `frontend/src/App.tsx` — wrap the `/shop` children in `.stage__rail` + `.stage__main`.
- **Modify** `frontend/src/App.css` — `display: contents` base + the `≥1100px` two-column block.

---

## Task 1: Wrap the `/shop` stage in rail + main

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Open the rail wrapper.** Replace:
```tsx
            <main className="stage">
              <div className="shop-toolbar">
```
with:
```tsx
            <main className="stage">
              <div className="stage__rail">
              <div className="shop-toolbar">
```

- [ ] **Step 2: Close the rail, open main.** Replace:
```tsx
              <QuickFilters filters={filters} onApply={applyFilters} />
              <SizePrompt />
```
with:
```tsx
              <QuickFilters filters={filters} onApply={applyFilters} />
              </div>
              <div className="stage__main">
              <SizePrompt />
```

- [ ] **Step 3: Close main.** Replace:
```tsx
              {!showEmpty && (
                <p className="hint">{t('deck.hint')}</p>
              )}
            </main>
```
with:
```tsx
              {!showEmpty && (
                <p className="hint">{t('deck.hint')}</p>
              )}
              </div>
            </main>
```

- [ ] **Step 4: Build (markup must still compile; layout unchanged until CSS).**
Run: `cd frontend && npm run build`
Expected: no errors. (Visually identical so far — the wrappers have no CSS yet, but JSX divs default to `display: block`, which would briefly change layout; the next task adds `display: contents`. Commit both together in Task 2 to avoid an intermediate broken layout.)

*(Do not commit yet — Task 2 makes the wrappers layout-neutral.)*

---

## Task 2: CSS — neutral wrappers + the desktop rail

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Make the wrappers layout-neutral by default.** Add near the `.stage` rule (e.g. right after the `.stage { … }` block):
```css
/* Wrappers for the desktop two-column rail. Invisible to layout by default so
   phones/tablets render exactly as before; the ≥1100px block turns them on. */
.stage__rail,
.stage__main {
  display: contents;
}
```

- [ ] **Step 2: Add the desktop two-column block.** Append to `frontend/src/App.css` (it comes after the existing `@media (min-width: 601px)` block, so it wins the cascade at ≥1100px):
```css
/* ≥1100px: a left control rail in the empty margin, deck centred and taller. */
@media (min-width: 1100px) {
  .app:has(.stage) {
    height: 100dvh;
    overflow: hidden;
  }
  .stage {
    flex-direction: row;
    align-items: stretch;
    justify-content: center;
    gap: 36px;
    padding: 24px;
  }
  /* Turn the wrappers into real flex containers. */
  .stage__rail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 220px;
    flex: 0 0 220px;
    align-self: center;
  }
  .stage__main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 0 1 460px;
    min-width: 0;
    min-height: 0;
  }
  /* Rail: stack the toolbar buttons and the quick-chips vertically. */
  .stage__rail .shop-toolbar {
    flex-direction: column;
    gap: 8px;
    max-width: none;
  }
  .stage__rail .toolbar-btn {
    width: 100%;
  }
  .quickfilters__chips {
    flex-direction: column;
    align-items: flex-start;
    flex-wrap: wrap;
    overflow: visible;
  }
  .quickfilters__sep {
    display: none; /* a horizontal divider is meaningless in a vertical list */
  }
  /* Deck fills the main column's height (capped), card fills the deck. */
  .deck {
    flex: 1 1 auto;
    min-height: 0;
    max-height: 700px;
    width: min(440px, 100%);
  }
  .deck__peek {
    display: none;
  }
  .swipe-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .swipe-card__image {
    aspect-ratio: auto;
    flex: 1 1 auto;
    min-height: 0;
  }
}
```

- [ ] **Step 3: Build + full suite (no logic touched).**
Run: `cd frontend && npm run build` → no errors.
Run: `cd frontend && npx vitest run` → all PASS (markup/CSS only; nothing should break).

- [ ] **Step 4: Commit (markup + CSS together, so there's no intermediate broken layout).**
```bash
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat(shopper): desktop filter rail — controls to a left column, bigger card"
```

---

## Task 3: Manual verification

**Files:** none.

- [ ] **Step 1: Eyeball three widths.** `cd frontend && npm run dev`, open `/shop`, and resize the window:
  1. **≥1100px** — Reviens + Filtrer + category/size chips sit in a left rail; the card/image is taller; the page doesn't scroll.
  2. **~800px** — current centered single column, **no** rail (chips back on top).
  3. **≤600px** — unchanged mobile layout (top toolbar + chips, fitted card).
- [ ] **Step 2: Functional sanity** — at ≥1100px, click a category chip and a size chip in the rail (deck refilters), click Filtrer (drawer opens), click Reviens after a pass (restores). Same handlers, just relocated.

---

## Self-Review Notes

- **Spec coverage:** wrappers added (T1); `display: contents` neutral base (T2 Step 1); ≥1100px rail with toolbar + chips + centered flex-fill deck (T2 Step 2); breakpoint 1100px (T2); ≤600 and 601–1099 untouched (no rules changed there; `display: contents` keeps them flat); manual checks (T3). Covered.
- **No-intermediate-break:** Task 1 explicitly does NOT commit; the wrappers are only layout-neutral once Task 2 Step 1 adds `display: contents`, so T1+T2 commit together (T2 Step 4).
- **No logic change:** same components, same props/handlers; only two wrapper `<div>`s and CSS. The full test suite is the regression guard.
