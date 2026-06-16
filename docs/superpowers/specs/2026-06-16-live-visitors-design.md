# Live Visitors ("En direct") — Design Spec

**Date:** 2026-06-16
**Status:** Approved, ready for implementation plan

## Goal

A Shopify-style live-visitor view in the Fripa admin dashboard: see how many
people are browsing the shop **right now**, where they are (Tunisian
governorate), what they're doing (viewing which pieces, swiping, carting), plus
a day-over-day traffic history that survives restarts.

## Decisions (locked during brainstorming)

1. **Region granularity:** Tunisian governorates (the 24 already modelled for
   delivery). IPs that don't resolve to a governorate fall into an "Inconnu"
   bucket. Governorate-level GeoIP is approximate — this is accepted.
2. **Live signals:** online count + governorate breakdown + what's being viewed
   + active carts + swipe rate. (All of them.)
3. **History:** live (ephemeral, in-memory) **plus** a persisted hourly rollup
   table for day-over-day traffic charts.
4. **Transport:** polling heartbeat (Approach A). Shopper POSTs a heartbeat every
   ~15s; admin polls a snapshot every ~5s. No WebSocket/SSE. The admin read-side
   can be upgraded to SSE later without touching the shopper or data model.

## Tuning constants

| Constant | Value | Meaning |
|---|---|---|
| `HEARTBEAT_INTERVAL_MS` | 15_000 | shopper ping cadence |
| `ONLINE_WINDOW_MS` | 45_000 | a userId is "online" if seen within this window |
| `ADMIN_POLL_MS` | 5_000 | admin snapshot refresh |
| `SWIPE_RATE_WINDOW_MS` | 60_000 | window for swipes/min |
| `SAMPLE_INTERVAL_MS` | 60_000 | per-minute online sampler feeding the hourly rollup |
| `PRESENCE_MAX_ENTRIES` | 5_000 | safety cap on the presence map |

## Architecture

### Backend — new `presence` module (`backend/src/presence/`)

**`PresenceService`** — in-memory state, no persistence for the live view.

- `Map<userId, PresenceEntry>` where
  `PresenceEntry = { lastSeen: number, govCode: string, page: string, pieceId?: string, hasCart: boolean }`.
- GeoIP resolved **once per userId** and cached as `govCode` on the entry. The
  raw IP is used transiently for the lookup and **never stored**.
- Swipe rate: a ring/array buffer of recent swipe timestamps; rate = count within
  `SWIPE_RATE_WINDOW_MS`.
- Per-minute sampler: records the current online count into a 60-slot ring used
  by the hourly rollup.
- **Injectable clock**: the service takes a `now: () => number` (default
  `Date.now`) so unit tests drive time deterministically instead of depending on
  wall-clock.
- `ping(userId, ip, ctx)` — upsert entry, set `lastSeen = now()`, resolve geo if
  not yet cached, add `ctx.swipesSincePing` timestamps to the swipe buffer.
- `prune()` — drop entries older than `ONLINE_WINDOW_MS`; enforce
  `PRESENCE_MAX_ENTRIES`.
- `snapshot()` — prune, then aggregate:
  `{ online, byGovernorate: [{name, count}], topPieces: [{pieceId, title, count}], activeCarts, swipeRatePerMin }`.
- Background timer follows the `DropsService` pattern: `OnModuleInit` starts a
  `setInterval` (with `.unref()`), `OnModuleDestroy` clears it. Two cadences:
  the per-minute sampler and the hourly rollup write.

**GeoIP** — `geoip-lite` (offline, bundled DB, no API key). A mapping table
converts its ISO `TN-xx` region codes to the governorate names already defined in
`backend/src/shop/settings.service.ts`. Unknown/non-TN → `"Inconnu"`.

**Controllers**

- `PresenceController` — **public** `POST /api/presence/ping`, body
  `{ userId, page, pieceId?, hasCart, swipesSincePing }`. Best-effort; resolves
  client IP from the request (respecting any proxy header already trusted by the
  app). Returns `204`/`{ ok: true }`.
- `AdminPresenceController` — behind `AdminGuard`:
  - `GET /api/admin/presence` → `snapshot()`
  - `GET /api/admin/presence/history` → recent `VisitorSnapshot` rows for the
    traffic chart.

`topPieces` resolves `pieceId → title` via the existing `CatalogueLoader`/catalogue.

### Prisma — new model

```prisma
model VisitorSnapshot {
  id           String   @id @default(cuid())
  hour         DateTime @unique   // truncated to the hour
  peakOnline   Int
  avgOnline    Int
  governorates Json               // [{ name, count }] peak-hour breakdown
}
```

Hourly job computes peak + avg from the last 60 minute-samples and upserts the
row for the current hour. Migration is created via the
`prisma migrate diff --script` → `prisma migrate deploy` + `prisma generate`
method (because `prisma migrate dev` fails non-interactively in this
environment; stop the backend dev server first to free the query-engine DLL on
Windows).

### Frontend — shopper

- **`presenceState` module** (`frontend/src/presence/presenceState.ts`): a tiny
  module-level store the deck and cart push into — current `pieceId`,
  `hasCart`, and an accumulating `swipeCount` — so feeding the heartbeat doesn't
  tightly couple components. `SwipeDeck` increments `swipeCount` on each
  keep/pass/favorite; cart code sets `hasCart`.
- **`usePresenceHeartbeat()` hook**, mounted **once** at the app root. Every
  `HEARTBEAT_INTERVAL_MS` it POSTs `/api/presence/ping` with `userId()`, the
  current route-derived `page`/`pieceId`, `hasCart`, and `swipesSincePing` (read
  and reset from `presenceState`). It **pauses while `document.hidden`** and
  fires a final `navigator.sendBeacon` on `pagehide`. Failures are swallowed.
- The **admin app never mounts this hook**, so admin browsing is not counted.

### Frontend — admin

- New **`AdminLive`** view + an "En direct" entry in the `/admin` nav.
- Polls `adminApi.presence()` every `ADMIN_POLL_MS`; renders the big online
  count, governorate bars, top-viewed pieces, active-cart count, and swipe rate.
- A traffic chart reads `adminApi.presenceHistory()` (day-over-day from
  `VisitorSnapshot`).
- Styled with the warm admin tokens (`--a-canvas/-surface/-line/-ink/-shadow`).

## Error handling & edge cases

- **GeoIP miss / non-TN IP** → `"Inconnu"` bucket; never throws.
- **Heartbeat failure** (offline, 4xx/5xx) → silently ignored on the shopper.
- **Server restart** → live map and the in-progress partial hour are lost
  (acceptable); persisted `VisitorSnapshot` history survives.
- **Memory safety** → pruning + `PRESENCE_MAX_ENTRIES` cap bound the map.
- **Privacy** → IP is used only transiently for geolocation; only the
  governorate code is retained.
- **Localisation** → admin is French-only today; this view ships French. (Not in
  the i18n scope.)

## Testing

`*.service.spec.ts` style, matching existing admin/shop specs:

- `PresenceService` via the injected clock: ping upsert; 45s prune; governorate
  aggregation; swipe-rate window boundary; `snapshot()` shape; max-entries cap.
- GeoIP mapping: `TN-xx` code → governorate name table, including unknown →
  `"Inconnu"`.
- `AdminPresenceController` is behind `AdminGuard` (guard test, like other admin
  endpoints).
- Hourly rollup: peak/avg computed correctly from a sample buffer.

## Dependencies

- `geoip-lite` + `@types/geoip-lite` (offline bundled GeoIP DB; adds a few MB to
  the backend bundle, no API key, no network at runtime).

## Out of scope / future

- SSE/WebSocket upgrade of the admin read-side (intentionally deferred).
- Persisting live presence to the DB (it is ephemeral by design).
- i18n of the new admin view.
