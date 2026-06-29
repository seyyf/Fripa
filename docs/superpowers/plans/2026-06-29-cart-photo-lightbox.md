# Cart Photo Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap a cart thumbnail to open a full-screen photo lightbox and flip through all of a piece's angles before paying, using one shared `Lightbox` component (also adopted by the product detail page).

**Architecture:** Extract the detail page's inline lightbox into a standalone `Lightbox` component (own photo index, Esc + arrow keys, reuses existing `.lightbox*` CSS). The detail page and the cart both render it.

**Tech Stack:** React 18 + framer-motion frontend, Vitest + @testing-library/react, existing `t()` i18n.

**Spec:** `docs/superpowers/specs/2026-06-29-cart-photo-lightbox-design.md`

---

## File Structure

- **Create** `frontend/src/components/Lightbox.tsx` — shared full-screen photo viewer.
- **Create** `frontend/src/components/Lightbox.test.tsx` — unit tests.
- **Modify** `frontend/src/components/ProductDetailContent.tsx` — use `Lightbox`.
- **Modify** `frontend/src/components/Cart.tsx` — tappable thumbnail + `Lightbox`.
- **Modify** `frontend/src/i18n/translations.ts` — `cart.zoomAria`.
- **Modify** `frontend/src/App.css` — `.cart-line__zoom`.

---

## Task 1: Shared `Lightbox` component

**Files:**
- Create: `frontend/src/components/Lightbox.tsx`
- Test: `frontend/src/components/Lightbox.test.tsx`

- [ ] **Step 1: Write the failing test** (`frontend/src/components/Lightbox.test.tsx`):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Lightbox } from './Lightbox';

describe('Lightbox', () => {
  it('shows the first image and cycles with the next control', () => {
    const { getByAltText, getByText } = render(
      <Lightbox images={['a.jpg', 'b.jpg']} alt="piece" onClose={() => {}} />,
    );
    expect((getByAltText('piece') as HTMLImageElement).src).toContain('a.jpg');
    fireEvent.click(getByText('›'));
    expect((getByAltText('piece') as HTMLImageElement).src).toContain('b.jpg');
  });

  it('opens on initialIndex', () => {
    const { getByAltText } = render(
      <Lightbox images={['a.jpg', 'b.jpg', 'c.jpg']} alt="p" initialIndex={2} onClose={() => {}} />,
    );
    expect((getByAltText('p') as HTMLImageElement).src).toContain('c.jpg');
  });

  it('hides nav controls for a single image', () => {
    const { queryByText } = render(<Lightbox images={['only.jpg']} alt="x" onClose={() => {}} />);
    expect(queryByText('›')).toBeNull();
    expect(queryByText('‹')).toBeNull();
  });

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<Lightbox images={['a.jpg']} alt="x" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.lightbox')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it (fails — no module).**
Run: `cd frontend && npx vitest run src/components/Lightbox.test.tsx`
Expected: FAIL — cannot find `./Lightbox`.

- [ ] **Step 3: Implement** (`frontend/src/components/Lightbox.tsx`):
```tsx
import { useEffect, useState } from 'react';
import { useT } from '../i18n/LanguageContext';

interface Props {
  images: string[];
  alt: string;
  initialIndex?: number;
  onClose: () => void;
}

// Full-screen photo viewer: tap backdrop / ✕ / Esc to close, ‹ › or arrow keys
// to flip through angles. Shared by the product detail page and the cart.
export function Lightbox({ images, alt, initialIndex = 0, onClose }: Props) {
  const { t } = useT();
  const photos = images.filter(Boolean);
  const many = photos.length > 1;
  const [sel, setSel] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(0, photos.length - 1)),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') setSel((s) => (s - 1 + photos.length) % photos.length);
      else if (many && e.key === 'ArrowRight') setSel((s) => (s + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, photos.length, onClose]);

  if (photos.length === 0) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox__close" aria-label={t('common.close')} onClick={onClose}>
        ✕
      </button>
      {many && (
        <button
          className="lightbox__nav lightbox__nav--prev"
          aria-label={t('pd.prev')}
          onClick={(e) => {
            e.stopPropagation();
            setSel((s) => (s - 1 + photos.length) % photos.length);
          }}
        >
          ‹
        </button>
      )}
      <img
        className="lightbox__img"
        src={photos[sel]}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
      {many && (
        <button
          className="lightbox__nav lightbox__nav--next"
          aria-label={t('pd.next')}
          onClick={(e) => {
            e.stopPropagation();
            setSel((s) => (s + 1) % photos.length);
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it (passes).**
Run: `cd frontend && npx vitest run src/components/Lightbox.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/Lightbox.tsx frontend/src/components/Lightbox.test.tsx
git commit -m "feat(ui): shared Lightbox component (photo viewer, esc/arrow nav)"
```

---

## Task 2: Use `Lightbox` on the product detail page

**Files:**
- Modify: `frontend/src/components/ProductDetailContent.tsx`

- [ ] **Step 1: Import it.** Add near the other imports:
```ts
import { Lightbox } from './Lightbox';
```

- [ ] **Step 2: Replace the inline lightbox.** Replace the whole `{zoom && ( … )}` block (the `<div className="lightbox">…</div>` and its prev/next/img, ending just before the component's final `</div>`) with:
```tsx
      {zoom && (
        <Lightbox
          images={gallery}
          alt={item.title}
          initialIndex={sel}
          onClose={() => setZoom(false)}
        />
      )}
```
(`gallery`, `sel`, `zoom`, `setZoom` already exist. The thumbnail strip still uses `sel`, so no unused vars.)

- [ ] **Step 3: Build + existing tests.**
Run: `cd frontend && npm run build` → no type errors.
Run: `cd frontend && npx vitest run src/components/ProductDetail.test.tsx` → PASS (if that test file exists; otherwise run the whole suite in Task 4).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/ProductDetailContent.tsx
git commit -m "refactor(pd): use the shared Lightbox (adds esc/arrow nav)"
```

---

## Task 3: Tappable cart thumbnail → Lightbox

**Files:**
- Modify: `frontend/src/components/Cart.tsx`
- Modify: `frontend/src/i18n/translations.ts`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add the i18n label.** In `frontend/src/i18n/translations.ts`, add (near other `cart.*` keys):
```ts
  'cart.zoomAria': {
    fr: 'Agrandir les photos de {title}',
    ar: 'تكبير صور {title}',
    en: 'Enlarge photos of {title}',
  },
```

- [ ] **Step 2: Import Lightbox + add state.** In `frontend/src/components/Cart.tsx`, add the import:
```ts
import { Lightbox } from './Lightbox';
```
Near the top of the component body (with the other `useState` calls), add:
```ts
  const [zoomLine, setZoomLine] = useState<CartResponse['lines'][number] | null>(null);
```

- [ ] **Step 3: Make the thumbnail tappable.** Replace the cart line image (`Cart.tsx:91`):
```tsx
              <img src={line.imageUrl} alt={line.title} loading="lazy" decoding="async" />
```
with:
```tsx
              <button
                type="button"
                className="cart-line__zoom"
                onClick={() => setZoomLine(line)}
                aria-label={t('cart.zoomAria', { title: line.title })}
              >
                <img src={line.imageUrl} alt={line.title} loading="lazy" decoding="async" />
                <span className="cart-line__zoom-hint" aria-hidden="true">⤢</span>
              </button>
```

- [ ] **Step 4: Render the lightbox.** Just before the cart `</aside>` closes (after the lines list / footer, anywhere inside the drawer root), add:
```tsx
        {zoomLine && (
          <Lightbox
            images={[zoomLine.imageUrl, ...(zoomLine.images ?? [])]}
            alt={zoomLine.title}
            onClose={() => setZoomLine(null)}
          />
        )}
```

- [ ] **Step 5: Add styles** — append to `frontend/src/App.css`:
```css
/* Tappable cart thumbnail → photo lightbox */
.cart-line__zoom {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  border-radius: 12px;
  overflow: hidden;
  line-height: 0;
}
.cart-line__zoom img {
  display: block;
}
.cart-line__zoom-hint {
  position: absolute;
  right: 4px;
  bottom: 4px;
  background: rgba(20, 16, 10, 0.7);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  padding: 3px 5px;
  border-radius: 6px;
  pointer-events: none;
}
```

- [ ] **Step 6: Build.**
Run: `cd frontend && npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/components/Cart.tsx frontend/src/i18n/translations.ts frontend/src/App.css
git commit -m "feat(cart): tap a thumbnail to open the photo lightbox"
```

---

## Task 4: Full suite + manual verification

**Files:** none.

- [ ] **Step 1: Full frontend suite.**
Run: `cd frontend && npx vitest run`
Expected: all PASS (incl. the new Lightbox tests).

- [ ] **Step 2: Manual check.** `npm run dev`, open the shop, add a couple of pieces to the cart, open the cart:
  1. Tap a thumbnail → full-screen lightbox opens on that piece's cover.
  2. For a piece with multiple photos, ‹ › (and ← →) cycle the angles.
  3. ✕, backdrop tap, and Esc all close it and return to the cart.
  4. On the product detail page, the enlarge still works (now with Esc/arrows too).

- [ ] **Step 3: Commit (any fixups).**
```bash
git add -A && git commit -m "test(cart): lightbox verification fixups"
```
(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** shared `Lightbox` with own index + Esc/arrows + reused CSS (T1); detail page adopts it via `initialIndex={sel}` (T2); cart thumbnail tappable + `zoomLine` + Lightbox with all angles (T3); `cart.zoomAria` i18n (T3 Step 1); `.cart-line__zoom` CSS (T3 Step 5); one-image edge case handled in the component (`many` guard, T1); tests (T1, T4). Covered.
- **Type consistency:** `Lightbox` props `{ images, alt, initialIndex?, onClose }` identical across T1/T2/T3; cart line type `CartResponse['lines'][number]` matches the existing `line` element; reused i18n keys `common.close`/`pd.prev`/`pd.next` already exist (used by the current inline lightbox).
- **Behaviour-preserving:** the detail refactor renders the same `.lightbox` DOM, so existing detail tests/visuals are unaffected (plus Esc/arrow nav).
