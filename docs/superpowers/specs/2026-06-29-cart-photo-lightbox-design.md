# Cart Photo Lightbox — Design Spec

**Date:** 2026-06-29
**Status:** Approved, ready for implementation plan

## Goal

Let a shopper tap a piece's thumbnail in the cart to open a full-screen photo
lightbox and flip through **all its angles** before paying — re-inspecting
condition/details at the highest-stakes moment (the cart/checkout) to reduce
last-second abandonment on unseen second-hand pieces.

## Rationale

The survey's top two hesitations were *"qualité réelle"* and *"tailles
incertaines"* (~64% each). The cart thumbnails are currently static and
non-interactive ([Cart.tsx](frontend/src/components/Cart.tsx)). The product
detail page already has a working lightbox (close + ‹ › + full image) — this
reuses it.

## Design

**Extract a shared `Lightbox` component, reuse it in the detail page and cart.**

- **New `frontend/src/components/Lightbox.tsx`**
  - Props: `{ images: string[]; alt: string; initialIndex?: number; onClose: () => void }`.
  - Manages its own current-photo index (seeded from `initialIndex ?? 0`).
  - Renders the existing `.lightbox` markup (backdrop click closes, `.lightbox__close`,
    `.lightbox__nav--prev/--next` when `images.length > 1`, `.lightbox__img`) — so it
    reuses the **existing `.lightbox*` CSS**; no new styles.
  - Adds **Esc to close** and **← / → to navigate** via a `keydown` listener
    (added on mount, removed on unmount). Arrows are no-ops when there's one image.
  - Empty/one-image input is handled (no nav arrows; still closable).
  - Labels via `t('common.close')`, `t('pd.prev')`, `t('pd.next')`.

- **`ProductDetailContent.tsx`** — replace the inline `{zoom && (<div className="lightbox">…)}`
  block with `<Lightbox images={gallery} alt={item.title} initialIndex={sel} onClose={() => setZoom(false)} />`.
  The thumbnail-strip `sel` still drives `initialIndex` so it opens on the viewed angle.
  Remove the now-dead inline lightbox markup. Behaviour is unchanged (plus Esc/arrows).

- **`Cart.tsx`**
  - Add `const [zoomLine, setZoomLine] = useState<CartLine | null>(null)`.
  - Wrap each line thumbnail `<img>` in a `<button className="cart-line__zoom">` that
    sets `zoomLine`, with `aria-label={t('cart.zoomAria', { title: line.title })}` and a
    small `⤢` zoom affordance.
  - Render `{zoomLine && <Lightbox images={[zoomLine.imageUrl, ...(zoomLine.images ?? [])]} alt={zoomLine.title} onClose={() => setZoomLine(null)} />}`.
  - `CartLine extends TShirt`, so `imageUrl` + optional `images` are already present.

- **i18n** (`translations.ts`): add `cart.zoomAria` `{title}` (FR/AR/EN). Reuse
  `common.close` / `pd.prev` / `pd.next`.

- **CSS** (`App.css`): a tiny `.cart-line__zoom` (reset button styling, position the
  `⤢` hint, `cursor: zoom-in`). The `.lightbox*` styles are reused as-is.

## Edge cases

- **One photo** (no `images`): lightbox opens on the cover, no ‹ › arrows, closes
  on tap/✕/Esc.
- The lightbox renders above the cart drawer (`z-index` of `.lightbox` already sits
  above the drawer); closing returns to the cart.
- Lazy-loaded thumbnail stays; the lightbox loads the full-size image on open.

## Testing

- **`Lightbox.test.tsx`**: renders the first image; ‹/› cycle through images (and
  wrap); a single image shows no nav arrows; `onClose` fires on Esc and on backdrop
  click.
- Build + existing suites stay green (the detail page refactor is behaviour-
  preserving; existing detail/cart tests cover it).

## Out of scope / future

- Pinch-to-zoom / pan inside the lightbox image (current lightbox is tap-to-enlarge
  + angle switching only).
- Measurements in cm on each piece (separate, larger confidence feature).
