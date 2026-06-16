# Live Visitors ("En direct") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Shopify-style live-visitor view to the Fripa admin: how many people are browsing right now, by Tunisian governorate, what they're viewing, active carts, swipe rate, plus a persisted hourly traffic history.

**Architecture:** A heartbeat from the shopper app feeds an in-memory presence map on the backend (a new `presence` module). The admin polls an aggregated snapshot every ~5s. GeoIP (offline `geoip-lite`) maps the visitor IP to a governorate, resolved once per session and isolated behind one function for an easy MaxMind swap later. A per-minute sampler rolls up into an hourly `VisitorSnapshot` table for day-over-day history. No WebSocket/SSE.

**Tech Stack:** NestJS 10 + Prisma (SQLite) backend, React 18 + react-router-dom 7 + Vite frontend, Vitest on both sides, `geoip-lite` for geolocation.

**Spec:** `docs/superpowers/specs/2026-06-16-live-visitors-design.md`

**Tuning constants (single source — `backend/src/presence/presence.constants.ts`):**

| Constant | Value | Meaning |
|---|---|---|
| `ONLINE_WINDOW_MS` | 45_000 | a userId is "online" if seen within this window |
| `SWIPE_RATE_WINDOW_MS` | 60_000 | window for swipes/min |
| `PRESENCE_MAX_ENTRIES` | 5_000 | safety cap on the presence map |
| `SAMPLE_INTERVAL_MS` | 60_000 | per-minute online sampler cadence |
| `ROLLUP_INTERVAL_MS` | 3_600_000 | hourly rollup write cadence |

Frontend constants live next to their hook (`HEARTBEAT_INTERVAL_MS = 15_000`, `ADMIN_POLL_MS = 5_000`).

---

## File Structure

**Backend — new `backend/src/presence/` module:**
- `presence.constants.ts` — tuning constants above.
- `geoip.ts` — `governorateFromRegion(country, region)` (pure mapping) + `resolveGovernorate(ip)` (geoip-lite lookup → mapping). The ONLY place that touches `geoip-lite`.
- `geoip.spec.ts` — mapping tests.
- `presence.types.ts` — `PresenceEntry`, `PingContext`, `PresenceSnapshot`, `VisitorHistoryPoint`.
- `presence.service.ts` — in-memory map, ping/prune/snapshot, swipe buffer, sampler + hourly rollup. Injectable clock + geo fn.
- `presence.service.spec.ts` — unit tests (deterministic clock + stub geo).
- `presence.controller.ts` — public `POST /api/presence/ping`.
- `admin-presence.controller.ts` — guarded `GET /api/admin/presence` + `/api/admin/presence/history`.
- `admin-presence.controller.spec.ts` — guard wiring test.
- `presence.module.ts` — wires the above; imports `ShopModule` (for `PrismaService`).

**Backend — modified:**
- `backend/prisma/schema.prisma` — add `VisitorSnapshot` model.
- `backend/src/app.module.ts` — import `PresenceModule`.
- `backend/src/admin/admin.module.ts` — import `PresenceModule`, register `AdminPresenceController`.
- `backend/src/main.ts` — `app.set('trust proxy', true)` so `req.ip` honours the proxy in prod.

**Frontend — new:**
- `frontend/src/presence/presenceState.ts` — module-level store fed by deck/cart.
- `frontend/src/presence/usePresenceHeartbeat.ts` — the heartbeat hook.
- `frontend/src/admin/AdminLive.tsx` — the live view.

**Frontend — modified:**
- `frontend/src/api.ts` — `presencePing()` (fire-and-forget) reusing `userId()`.
- `frontend/src/App.tsx` — bump swipe counter in deck handlers + mount the hook.
- `frontend/src/admin/adminApi.ts` — `presence()` / `presenceHistory()` + types.
- `frontend/src/admin/AdminApp.tsx` — nav link + route for `/admin/live`.

---

## Task 1: Add the `geoip-lite` dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install**

Run (from `backend/`):
```bash
npm install geoip-lite && npm install -D @types/geoip-lite
```
Expected: both packages added; `geoip-lite` under `dependencies`, `@types/geoip-lite` under `devDependencies`.

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "build(backend): add geoip-lite for visitor geolocation"
```

---

## Task 2: GeoIP → governorate resolver

The pure mapping is tested in isolation; the `geoip-lite` call is a thin wrapper so the whole thing is swappable for MaxMind later.

**Files:**
- Create: `backend/src/presence/geoip.ts`
- Test: `backend/src/presence/geoip.spec.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/presence/geoip.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { governorateFromRegion } from './geoip';

describe('governorateFromRegion', () => {
  it('maps known Tunisian ISO region codes to governorate names', () => {
    expect(governorateFromRegion('TN', '11')).toBe('Tunis');
    expect(governorateFromRegion('TN', '13')).toBe('Ben Arous');
    expect(governorateFromRegion('TN', '61')).toBe('Sfax');
    expect(governorateFromRegion('TN', '83')).toBe('Tataouine');
  });

  it('falls back to "Inconnu" for non-TN countries', () => {
    expect(governorateFromRegion('FR', '11')).toBe('Inconnu');
  });

  it('falls back to "Inconnu" for an unknown TN region code', () => {
    expect(governorateFromRegion('TN', '99')).toBe('Inconnu');
    expect(governorateFromRegion('TN', '')).toBe('Inconnu');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/presence/geoip.spec.ts`
Expected: FAIL — cannot find module `./geoip`.

- [ ] **Step 3: Write the implementation**

`backend/src/presence/geoip.ts`:
```ts
import geoip from 'geoip-lite';

// ISO 3166-2:TN subdivision code -> governorate name (matching the names in
// backend/src/shop/settings.service.ts GOVERNORATES). geoip-lite returns the
// subdivision code without the "TN-" prefix in its `region` field.
const TN_REGION_TO_GOVERNORATE: Record<string, string> = {
  '11': 'Tunis',
  '12': 'Ariana',
  '13': 'Ben Arous',
  '14': 'Manouba',
  '21': 'Nabeul',
  '22': 'Zaghouan',
  '23': 'Bizerte',
  '31': 'Béja',
  '32': 'Jendouba',
  '33': 'Le Kef',
  '34': 'Siliana',
  '41': 'Kairouan',
  '42': 'Kasserine',
  '43': 'Sidi Bouzid',
  '51': 'Sousse',
  '52': 'Monastir',
  '53': 'Mahdia',
  '61': 'Sfax',
  '71': 'Gafsa',
  '72': 'Tozeur',
  '73': 'Kébili',
  '81': 'Gabès',
  '82': 'Médenine',
  '83': 'Tataouine',
};

export const UNKNOWN_GOVERNORATE = 'Inconnu';

// Pure, testable mapping. Anything that isn't a known Tunisian subdivision
// collapses to "Inconnu".
export function governorateFromRegion(country: string, region: string): string {
  if (country !== 'TN') return UNKNOWN_GOVERNORATE;
  return TN_REGION_TO_GOVERNORATE[region] ?? UNKNOWN_GOVERNORATE;
}

// The single place that touches geoip-lite. Swap this body for MaxMind
// GeoLite2-City later without changing PresenceService. Never throws.
export function resolveGovernorate(ip: string | undefined): string {
  if (!ip) return UNKNOWN_GOVERNORATE;
  // Normalise IPv6-mapped IPv4 (e.g. "::ffff:196.x.x.x") that Express may hand us.
  const clean = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(clean);
  if (!geo) return UNKNOWN_GOVERNORATE;
  return governorateFromRegion(geo.country, geo.region);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run src/presence/geoip.spec.ts`
Expected: PASS (3 tests).

> **Implementation note (not a blocker):** geoip-lite's exact `region` codes for Tunisia should be spot-checked against a known Tunisian public IP during manual verification (Task 11). If a code differs from ISO, only the `TN_REGION_TO_GOVERNORATE` table changes. Dev traffic is localhost and correctly returns "Inconnu".

- [ ] **Step 5: Commit**

```bash
git add backend/src/presence/geoip.ts backend/src/presence/geoip.spec.ts
git commit -m "feat(presence): GeoIP -> Tunisian governorate resolver"
```

---

## Task 3: Presence types

**Files:**
- Create: `backend/src/presence/presence.types.ts`

- [ ] **Step 1: Write the file** (no test — type-only)

`backend/src/presence/presence.types.ts`:
```ts
// One tracked visitor session (keyed by the shopper's anonymous userId).
export interface PresenceEntry {
  lastSeen: number; // ms epoch of the last heartbeat
  governorate: string; // resolved once, then cached
  page: string; // e.g. "home" | "catalogue" | "piece" | "cart"
  pieceId?: string; // set when page === "piece"
  hasCart: boolean;
}

// Payload sent by the shopper heartbeat.
export interface PingContext {
  page: string;
  pieceId?: string;
  hasCart: boolean;
  swipesSincePing: number;
}

export interface GovernorateCount {
  name: string;
  count: number;
}

export interface TopPiece {
  pieceId: string;
  title: string;
  count: number;
}

// What the admin live panel renders.
export interface PresenceSnapshot {
  online: number;
  byGovernorate: GovernorateCount[];
  topPieces: TopPiece[];
  activeCarts: number;
  swipeRatePerMin: number;
}

export interface VisitorHistoryPoint {
  hour: string; // ISO
  peakOnline: number;
  avgOnline: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/presence/presence.types.ts
git commit -m "feat(presence): shared presence types"
```

---

## Task 4: Constants

**Files:**
- Create: `backend/src/presence/presence.constants.ts`

- [ ] **Step 1: Write the file**

`backend/src/presence/presence.constants.ts`:
```ts
// A session counts as "online" if its last heartbeat is within this window.
export const ONLINE_WINDOW_MS = 45_000;
// Swipe rate is computed over this trailing window.
export const SWIPE_RATE_WINDOW_MS = 60_000;
// Hard cap on tracked sessions (memory safety).
export const PRESENCE_MAX_ENTRIES = 5_000;
// How often the online count is sampled for the hourly rollup.
export const SAMPLE_INTERVAL_MS = 60_000;
// How often the hourly VisitorSnapshot row is written.
export const ROLLUP_INTERVAL_MS = 3_600_000;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/presence/presence.constants.ts
git commit -m "feat(presence): tuning constants"
```

---

## Task 5: `VisitorSnapshot` Prisma model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (append model)
- Create: `backend/prisma/migrations/20260616120000_visitor_snapshot/migration.sql`

- [ ] **Step 1: Add the model**

Append to `backend/prisma/schema.prisma`:
```prisma
// Hourly rollup of live-visitor presence, for day-over-day traffic charts.
// `governorates` holds the peak-hour breakdown as JSON [{ name, count }].
model VisitorSnapshot {
  id           String   @id @default(cuid())
  hour         DateTime @unique
  peakOnline   Int
  avgOnline    Int
  governorates String   @default("[]") // JSON string (SQLite has no JSON type)
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 2: Stop the backend dev server**

If `npm run start:dev` is running in `backend/`, stop it. On Windows the running query engine locks the Prisma DLL and `prisma generate` will fail otherwise.

- [ ] **Step 3: Generate the migration SQL via diff** (NOT `migrate dev` — it fails non-interactively here)

Run (from `backend/`):
```bash
mkdir -p prisma/migrations/20260616120000_visitor_snapshot
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260616120000_visitor_snapshot/migration.sql
```
Expected: `migration.sql` contains a `CREATE TABLE "VisitorSnapshot" (...)` with a unique index on `hour`.

- [ ] **Step 4: Apply + regenerate the client**

Run (from `backend/`):
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected: migration applied; client regenerated with the `visitorSnapshot` delegate.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260616120000_visitor_snapshot/migration.sql
git commit -m "feat(presence): VisitorSnapshot model + migration"
```

---

## Task 6: `PresenceService` — ping, prune, snapshot, swipe rate

The service takes a `now()` clock and a `geo(ip)` function so tests are deterministic and DB-free. Timers and the rollup are added in Task 7.

**Files:**
- Create: `backend/src/presence/presence.service.ts`
- Test: `backend/src/presence/presence.service.spec.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/presence/presence.service.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PresenceService } from './presence.service';

// A controllable clock + a geo stub that echoes the ip as the governorate.
function make() {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const prisma = { visitorSnapshot: { upsert: async () => undefined, findMany: async () => [] } } as any;
  const svc = new PresenceService(prisma, () => clock.now(), (ip?: string) => ip ?? 'Inconnu');
  return { svc, clock };
}

const ctx = (over: Partial<{ page: string; pieceId?: string; hasCart: boolean; swipesSincePing: number }> = {}) => ({
  page: 'home',
  hasCart: false,
  swipesSincePing: 0,
  ...over,
});

describe('PresenceService', () => {
  it('counts a session as online after a ping', () => {
    const { svc } = make();
    svc.ping('u1', 'Tunis', ctx());
    expect(svc.snapshot().online).toBe(1);
  });

  it('drops sessions older than the online window', () => {
    const { svc, clock } = make();
    svc.ping('u1', 'Tunis', ctx());
    clock.advance(46_000);
    expect(svc.snapshot().online).toBe(0);
  });

  it('aggregates by governorate (resolved once, cached)', () => {
    const { svc } = make();
    svc.ping('u1', 'Tunis', ctx());
    svc.ping('u2', 'Sfax', ctx());
    svc.ping('u1', 'Sfax', ctx()); // same session re-pings; governorate stays Tunis
    const gov = svc.snapshot().byGovernorate;
    expect(gov.find((g) => g.name === 'Tunis')?.count).toBe(1);
    expect(gov.find((g) => g.name === 'Sfax')?.count).toBe(1);
  });

  it('counts active carts and top viewed pieces', () => {
    const { svc } = make();
    svc.ping('u1', 'Tunis', ctx({ hasCart: true, page: 'piece', pieceId: 'p1' }));
    svc.ping('u2', 'Sfax', ctx({ page: 'piece', pieceId: 'p1' }));
    const s = svc.snapshot();
    expect(s.activeCarts).toBe(1);
    expect(s.topPieces[0]).toMatchObject({ pieceId: 'p1', count: 2 });
  });

  it('computes swipes per minute over the trailing window', () => {
    const { svc, clock } = make();
    svc.ping('u1', 'Tunis', ctx({ swipesSincePing: 3 }));
    clock.advance(10_000);
    svc.ping('u1', 'Tunis', ctx({ swipesSincePing: 2 }));
    expect(svc.snapshot().swipeRatePerMin).toBe(5);
    clock.advance(61_000); // both swipe batches now outside the 60s window
    svc.ping('u1', 'Tunis', ctx({ swipesSincePing: 0 }));
    expect(svc.snapshot().swipeRatePerMin).toBe(0);
  });

  it('enforces the max-entries cap by evicting the stalest session', () => {
    const { svc, clock } = make();
    for (let i = 0; i < 5; i++) {
      svc.ping(`u${i}`, 'Tunis', ctx());
      clock.advance(1);
    }
    // @ts-expect-error reach into the cap for the test
    svc.maxEntries = 3;
    svc.ping('u-new', 'Tunis', ctx());
    const online = svc.snapshot().online;
    expect(online).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/presence/presence.service.spec.ts`
Expected: FAIL — cannot find module `./presence.service`.

- [ ] **Step 3: Write the implementation**

`backend/src/presence/presence.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shop/prisma.service';
import { ITEMS } from '../shop/items.data';
import { resolveGovernorate } from './geoip';
import {
  ONLINE_WINDOW_MS,
  SWIPE_RATE_WINDOW_MS,
  PRESENCE_MAX_ENTRIES,
} from './presence.constants';
import type { PresenceEntry, PingContext, PresenceSnapshot } from './presence.types';

type Clock = () => number;
type Geo = (ip: string | undefined) => string;

@Injectable()
export class PresenceService {
  private readonly entries = new Map<string, PresenceEntry>();
  // Trailing buffer of swipe timestamps (ms) for the rate calc.
  private swipeTimes: number[] = [];
  // Mutable so a test can shrink it; defaults to the constant.
  maxEntries = PRESENCE_MAX_ENTRIES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly now: Clock = () => Date.now(),
    private readonly geo: Geo = resolveGovernorate,
  ) {}

  // Record a heartbeat. `ip` is used transiently for geo on first sight only;
  // it is never stored — only the resolved governorate is kept.
  ping(userId: string, ip: string | undefined, ctx: PingContext): void {
    const t = this.now();
    const existing = this.entries.get(userId);
    const governorate = existing?.governorate ?? this.geo(ip);
    this.entries.set(userId, {
      lastSeen: t,
      governorate,
      page: ctx.page,
      pieceId: ctx.pieceId,
      hasCart: ctx.hasCart,
    });
    for (let i = 0; i < ctx.swipesSincePing; i++) this.swipeTimes.push(t);
    this.enforceCap();
  }

  // Online sessions = those seen within the window. Also prunes stale entries.
  private liveEntries(): PresenceEntry[] {
    const cutoff = this.now() - ONLINE_WINDOW_MS;
    const live: PresenceEntry[] = [];
    for (const [id, e] of this.entries) {
      if (e.lastSeen >= cutoff) live.push(e);
      else this.entries.delete(id);
    }
    return live;
  }

  onlineCount(): number {
    return this.liveEntries().length;
  }

  snapshot(): PresenceSnapshot {
    const live = this.liveEntries();

    const govMap = new Map<string, number>();
    const pieceMap = new Map<string, number>();
    let activeCarts = 0;
    for (const e of live) {
      govMap.set(e.governorate, (govMap.get(e.governorate) ?? 0) + 1);
      if (e.hasCart) activeCarts++;
      if (e.page === 'piece' && e.pieceId) {
        pieceMap.set(e.pieceId, (pieceMap.get(e.pieceId) ?? 0) + 1);
      }
    }

    const byGovernorate = [...govMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topPieces = [...pieceMap.entries()]
      .map(([pieceId, count]) => ({ pieceId, count, title: this.titleFor(pieceId) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      online: live.length,
      byGovernorate,
      topPieces,
      activeCarts,
      swipeRatePerMin: this.swipeRatePerMin(),
    };
  }

  private swipeRatePerMin(): number {
    const cutoff = this.now() - SWIPE_RATE_WINDOW_MS;
    this.swipeTimes = this.swipeTimes.filter((t) => t >= cutoff);
    // Window is exactly one minute, so the count IS the per-minute rate.
    return this.swipeTimes.length;
  }

  private titleFor(pieceId: string): string {
    return ITEMS.find((i) => i.id === pieceId)?.title ?? pieceId;
  }

  // When over the cap, evict the stalest sessions first.
  private enforceCap(): void {
    if (this.entries.size <= this.maxEntries) return;
    const sorted = [...this.entries.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toDrop = this.entries.size - this.maxEntries;
    for (let i = 0; i < toDrop; i++) this.entries.delete(sorted[i][0]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run src/presence/presence.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/presence/presence.service.ts backend/src/presence/presence.service.spec.ts
git commit -m "feat(presence): in-memory presence service (ping, snapshot, swipe rate)"
```

---

## Task 7: Sampler + hourly rollup to `VisitorSnapshot`

Adds the minute sampler, the hourly flush, and the lifecycle timers (the `DropsService` pattern: `OnModuleInit`/`OnModuleDestroy`, `setInterval().unref()`).

**Files:**
- Modify: `backend/src/presence/presence.service.ts`
- Test: `backend/src/presence/presence.service.spec.ts` (add a describe block)

- [ ] **Step 1: Write the failing test** (append to the existing spec file)

```ts
describe('PresenceService rollup', () => {
  it('writes peak + avg from the minute samples for the current hour', async () => {
    let t = new Date('2026-06-16T10:00:00Z').getTime();
    const writes: any[] = [];
    const prisma = {
      visitorSnapshot: {
        upsert: async (arg: any) => { writes.push(arg); },
        findMany: async () => [],
      },
    } as any;
    const svc = new PresenceService(prisma, () => t, (ip?: string) => ip ?? 'Inconnu');

    svc.ping('u1', 'Tunis', { page: 'home', hasCart: false, swipesSincePing: 0 });
    svc.sampleNow(); // sample = 1
    svc.ping('u2', 'Sfax', { page: 'home', hasCart: false, swipesSincePing: 0 });
    svc.sampleNow(); // sample = 2

    await svc.flushHour();

    expect(writes).toHaveLength(1);
    const data = writes[0].create;
    expect(data.peakOnline).toBe(2);
    expect(data.avgOnline).toBe(2); // round((1+2)/2) = 2
    expect(new Date(data.hour).toISOString()).toBe('2026-06-16T10:00:00.000Z');
    // samples reset after a flush
    expect(svc.pendingSampleCount()).toBe(0);
  });

  it('skips the write when no samples were collected', async () => {
    const writes: any[] = [];
    const prisma = { visitorSnapshot: { upsert: async (a: any) => { writes.push(a); }, findMany: async () => [] } } as any;
    const svc = new PresenceService(prisma, () => 0, () => 'Inconnu');
    await svc.flushHour();
    expect(writes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/presence/presence.service.spec.ts`
Expected: FAIL — `svc.sampleNow is not a function`.

- [ ] **Step 3: Implement** — edit `presence.service.ts`.

Change the class declaration to add lifecycle hooks:
```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
```
```ts
import {
  ONLINE_WINDOW_MS,
  SWIPE_RATE_WINDOW_MS,
  PRESENCE_MAX_ENTRIES,
  SAMPLE_INTERVAL_MS,
  ROLLUP_INTERVAL_MS,
} from './presence.constants';
```
```ts
export class PresenceService implements OnModuleInit, OnModuleDestroy {
```

Add these fields next to `swipeTimes`:
```ts
  // Online counts sampled once a minute; flushed into one hourly row.
  private samples: number[] = [];
  private sampleTimer?: ReturnType<typeof setInterval>;
  private rollupTimer?: ReturnType<typeof setInterval>;
```

Add these methods to the class:
```ts
  onModuleInit(): void {
    this.sampleTimer = setInterval(() => this.sampleNow(), SAMPLE_INTERVAL_MS);
    this.sampleTimer.unref?.();
    this.rollupTimer = setInterval(() => void this.flushHour(), ROLLUP_INTERVAL_MS);
    this.rollupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.rollupTimer) clearInterval(this.rollupTimer);
  }

  // Record the current online count for the rollup. Called every minute.
  sampleNow(): void {
    this.samples.push(this.onlineCount());
  }

  pendingSampleCount(): number {
    return this.samples.length;
  }

  // Roll the collected minute-samples into one row for the current hour, then
  // reset. Best-effort: never throws into the timer.
  async flushHour(): Promise<void> {
    const samples = this.samples;
    this.samples = [];
    if (samples.length === 0) return;
    const peakOnline = Math.max(...samples);
    const avgOnline = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const hour = new Date(this.now());
    hour.setMinutes(0, 0, 0);
    const governorates = JSON.stringify(this.snapshot().byGovernorate);
    try {
      await this.prisma.visitorSnapshot.upsert({
        where: { hour },
        create: { hour, peakOnline, avgOnline, governorates },
        update: { peakOnline, avgOnline, governorates },
      });
    } catch {
      /* best-effort rollup; a failed write must not crash the timer */
    }
  }

  // Recent hourly history for the admin traffic chart (oldest -> newest).
  async history(hours = 48): Promise<{ hour: string; peakOnline: number; avgOnline: number }[]> {
    const rows = await this.prisma.visitorSnapshot.findMany({
      orderBy: { hour: 'desc' },
      take: hours,
    });
    return rows
      .reverse()
      .map((r) => ({ hour: r.hour.toISOString(), peakOnline: r.peakOnline, avgOnline: r.avgOnline }));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run src/presence/presence.service.spec.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/presence/presence.service.ts backend/src/presence/presence.service.spec.ts
git commit -m "feat(presence): minute sampler + hourly VisitorSnapshot rollup"
```

---

## Task 8: Public ping controller

**Files:**
- Create: `backend/src/presence/presence.controller.ts`

- [ ] **Step 1: Write the implementation** (thin controller; covered by the e2e/manual check + the guard test in Task 9)

`backend/src/presence/presence.controller.ts`:
```ts
import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PresenceService } from './presence.service';
import type { PingContext } from './presence.types';

interface PingBody extends PingContext {
  userId: string;
}

@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  // Public, best-effort heartbeat from the shopper app.
  @Post('ping')
  ping(@Body() body: PingBody, @Req() req: Request): { ok: true } {
    if (body?.userId) {
      this.presence.ping(body.userId, req.ip, {
        page: body.page ?? 'home',
        pieceId: body.pieceId,
        hasCart: !!body.hasCart,
        swipesSincePing: Number(body.swipesSincePing) || 0,
      });
    }
    return { ok: true };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/presence/presence.controller.ts
git commit -m "feat(presence): public heartbeat endpoint"
```

---

## Task 9: Guarded admin presence controller + module

**Files:**
- Create: `backend/src/presence/admin-presence.controller.ts`
- Create: `backend/src/presence/presence.module.ts`
- Create: `backend/src/presence/admin-presence.controller.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/admin/admin.module.ts`

- [ ] **Step 1: Write the admin controller**

`backend/src/presence/admin-presence.controller.ts`:
```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { PresenceService } from './presence.service';

@Controller('admin/presence')
@UseGuards(AdminGuard)
export class AdminPresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  snapshot() {
    return this.presence.snapshot();
  }

  @Get('history')
  history(@Query('hours') hours?: string) {
    return this.presence.history(hours ? Number(hours) : 48);
  }
}
```

- [ ] **Step 2: Write the module**

`backend/src/presence/presence.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

// Provides PresenceService + the public ping endpoint. The guarded admin read
// controller lives in AdminModule (it needs AdminGuard); it consumes the
// PresenceService exported here.
@Module({
  imports: [ShopModule], // for PrismaService
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
```

- [ ] **Step 3: Write the guard test**

`backend/src/presence/admin-presence.controller.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AdminPresenceController } from './admin-presence.controller';
import { AdminGuard } from '../admin/admin.guard';

describe('AdminPresenceController', () => {
  it('is protected by the AdminGuard', () => {
    const guards = new Reflector().get<any[]>('__guards__', AdminPresenceController) ?? [];
    expect(guards).toContain(AdminGuard);
  });

  it('returns the live snapshot from the service', () => {
    const snap = { online: 3, byGovernorate: [], topPieces: [], activeCarts: 0, swipeRatePerMin: 0 };
    const ctrl = new AdminPresenceController({ snapshot: () => snap } as any);
    expect(ctrl.snapshot()).toBe(snap);
  });
});
```

- [ ] **Step 4: Wire the modules.**

In `backend/src/app.module.ts`, add the import and list it:
```ts
import { PresenceModule } from './presence/presence.module';
```
```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ShopModule,
    AdminModule,
    AccountModule,
    PresenceModule,
  ],
```

In `backend/src/admin/admin.module.ts`, import `PresenceModule` and register the controller:
```ts
import { PresenceModule } from '../presence/presence.module';
import { AdminPresenceController } from '../presence/admin-presence.controller';
```
Add `PresenceModule` to `imports`, and `AdminPresenceController` to `controllers`:
```ts
  imports: [
    ShopModule,
    PresenceModule,
    JwtModule.registerAsync({ /* unchanged */ }),
  ],
```
```ts
  controllers: [
    AdminController,
    AdminItemsController,
    AdminOrdersController,
    AdminUploadController,
    AdminStatsController,
    AdminCustomersController,
    AdminPromosController,
    AdminSettingsController,
    AdminInsightsController,
    AuditController,
    AdminPresenceController,
  ],
```

- [ ] **Step 5: Run the controller test + full backend suite**

Run (from `backend/`): `npx vitest run src/presence/admin-presence.controller.spec.ts`
Expected: PASS (2 tests).

Then run the whole suite to confirm nothing else broke:
Run (from `backend/`): `npm test`
Expected: all suites PASS (including the existing admin/shop specs).

- [ ] **Step 6: Commit**

```bash
git add backend/src/presence/admin-presence.controller.ts backend/src/presence/presence.module.ts backend/src/presence/admin-presence.controller.spec.ts backend/src/app.module.ts backend/src/admin/admin.module.ts
git commit -m "feat(presence): guarded admin snapshot/history endpoints + module wiring"
```

---

## Task 10: Trust the proxy for real client IPs

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Add the setting** — after `app.setGlobalPrefix('api');` in `backend/src/main.ts`:
```ts
  // Behind a reverse proxy in prod, honour X-Forwarded-For so req.ip is the
  // real client (geoip needs it). Harmless in dev (localhost -> "Inconnu").
  app.set('trust proxy', true);
```

- [ ] **Step 2: Smoke-build**

Run (from `backend/`): `npm run build`
Expected: `nest build` completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main.ts
git commit -m "feat(presence): trust proxy so geoip sees the real client IP"
```

---

## Task 11: Shopper presence state + heartbeat API

**Files:**
- Create: `frontend/src/presence/presenceState.ts`
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/presence/presenceState.test.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/presence/presenceState.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { bumpSwipe, setHasCart, takeSwipes, getHasCart } from './presenceState';

describe('presenceState', () => {
  beforeEach(() => {
    takeSwipes(); // drain
    setHasCart(false);
  });

  it('accumulates swipes and drains them on take', () => {
    bumpSwipe();
    bumpSwipe();
    expect(takeSwipes()).toBe(2);
    expect(takeSwipes()).toBe(0); // drained
  });

  it('tracks cart presence', () => {
    expect(getHasCart()).toBe(false);
    setHasCart(true);
    expect(getHasCart()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/presence/presenceState.test.ts`
Expected: FAIL — cannot find module `./presenceState`.

- [ ] **Step 3: Implement**

`frontend/src/presence/presenceState.ts`:
```ts
// Tiny module-level store so the deck/cart can feed the heartbeat without
// prop-drilling. The heartbeat reads (and resets) the swipe counter each tick.
let swipesSincePing = 0;
let hasCart = false;

export function bumpSwipe(): void {
  swipesSincePing++;
}

// Read and reset the accumulated swipe count.
export function takeSwipes(): number {
  const n = swipesSincePing;
  swipesSincePing = 0;
  return n;
}

export function setHasCart(value: boolean): void {
  hasCart = value;
}

export function getHasCart(): boolean {
  return hasCart;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `frontend/`): `npx vitest run src/presence/presenceState.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the ping function to `frontend/src/api.ts`.**

Inside the `api` object (after `reset`/`resetSwipes` near the end), add a fire-and-forget heartbeat. It must NOT throw and must NOT go through `http` (which throws on non-2xx):
```ts
  presencePing: (ctx: {
    page: string;
    pieceId?: string;
    hasCart: boolean;
    swipesSincePing: number;
  }): void => {
    const payload = JSON.stringify({ userId: userId(), ...ctx });
    try {
      // sendBeacon survives page unload; fall back to a best-effort fetch.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presence/ping', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/presence/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* best-effort — never disturb the shopper */
    }
  },
```
(`userId` is the existing module function at the top of `api.ts`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/presence/presenceState.ts frontend/src/presence/presenceState.test.ts frontend/src/api.ts
git commit -m "feat(presence): shopper presence state + heartbeat ping"
```

---

## Task 12: Heartbeat hook + wiring into the shopper app

**Files:**
- Create: `frontend/src/presence/usePresenceHeartbeat.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the hook**

`frontend/src/presence/usePresenceHeartbeat.ts`:
```ts
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { takeSwipes, setHasCart } from './presenceState';

const HEARTBEAT_INTERVAL_MS = 15_000;

// Derive a coarse page label + pieceId from the current path.
function pageFromPath(pathname: string): { page: string; pieceId?: string } {
  const piece = pathname.match(/^\/piece\/(.+)$/);
  if (piece) return { page: 'piece', pieceId: piece[1] };
  if (pathname.startsWith('/catalogue')) return { page: 'catalogue' };
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) return { page: 'cart' };
  if (pathname.startsWith('/compte')) return { page: 'account' };
  if (pathname === '/' || pathname === '') return { page: 'home' };
  return { page: pathname.replace(/^\//, '').split('/')[0] || 'home' };
}

// Mounted once at the shopper app root. Sends a heartbeat every 15s while the
// tab is visible, plus a final beacon on pagehide. `hasCart` comes from the
// app's live cart state.
export function usePresenceHeartbeat(hasCart: boolean): void {
  const location = useLocation();
  // Keep the latest context in a ref so the interval always reads fresh values.
  const ctxRef = useRef({ pathname: location.pathname, hasCart });
  ctxRef.current = { pathname: location.pathname, hasCart };

  useEffect(() => {
    setHasCart(hasCart);
  }, [hasCart]);

  useEffect(() => {
    const send = () => {
      if (document.hidden) return;
      const { pathname, hasCart } = ctxRef.current;
      const { page, pieceId } = pageFromPath(pathname);
      api.presencePing({ page, pieceId, hasCart, swipesSincePing: takeSwipes() });
    };

    send(); // immediate first beat
    const timer = window.setInterval(send, HEARTBEAT_INTERVAL_MS);

    const onHide = () => {
      const { pathname, hasCart } = ctxRef.current;
      const { page, pieceId } = pageFromPath(pathname);
      api.presencePing({ page, pieceId, hasCart, swipesSincePing: takeSwipes() });
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.tsx`.**

Add the imports near the other local imports:
```ts
import { usePresenceHeartbeat } from './presence/usePresenceHeartbeat';
import { bumpSwipe } from './presence/presenceState';
```

Inside the `App` component body (after `const [cart, setCart] = useState(...)` is in scope), call the hook:
```ts
  usePresenceHeartbeat(cart.lines.length > 0);
```

Add `bumpSwipe();` at the start of each deck swipe handler — `handlePass`, `handleFavorite`, and the keep handler (the one that ends in `void topUp();` around line 195). For example in `handlePass`:
```ts
  async function handlePass(item: FieldItem) {
    bumpSwipe();
    dropTop(item.id);
    try {
      await api.pass(item.id);
```
Do the same first-line `bumpSwipe();` in the keep handler and in `handleFavorite`. Do NOT add it to `addFavorite` (that's the catalogue-detail favourite, not a deck swipe).

- [ ] **Step 3: Verify the app still builds + tests pass**

Run (from `frontend/`): `npx vitest run`
Expected: existing tests still PASS.
Run (from `frontend/`): `npm run build`
Expected: `tsc -b && vite build` completes with no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/presence/usePresenceHeartbeat.ts frontend/src/App.tsx
git commit -m "feat(presence): shopper heartbeat hook + swipe counting"
```

---

## Task 13: Admin API client methods

**Files:**
- Modify: `frontend/src/admin/adminApi.ts`

- [ ] **Step 1: Add the types** (near the other admin interfaces):
```ts
export interface LivePresence {
  online: number;
  byGovernorate: { name: string; count: number }[];
  topPieces: { pieceId: string; title: string; count: number }[];
  activeCarts: number;
  swipeRatePerMin: number;
}

export interface VisitorHistoryPoint {
  hour: string;
  peakOnline: number;
  avgOnline: number;
}
```

- [ ] **Step 2: Add the methods** to the `adminApi` object (after `audit`):
```ts
  presence: () => http<LivePresence>('/admin/presence'),
  presenceHistory: (hours = 48) =>
    http<VisitorHistoryPoint[]>(`/admin/presence/history?hours=${hours}`),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/admin/adminApi.ts
git commit -m "feat(presence): admin API client for live presence + history"
```

---

## Task 14: Admin "En direct" view + nav

**Files:**
- Create: `frontend/src/admin/AdminLive.tsx`
- Modify: `frontend/src/admin/AdminApp.tsx`

- [ ] **Step 1: Write the view**

`frontend/src/admin/AdminLive.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type LivePresence, type VisitorHistoryPoint } from './adminApi';

const ADMIN_POLL_MS = 5_000;

interface Props {
  onAuthError: () => void;
}

export function AdminLive({ onAuthError }: Props) {
  const [live, setLive] = useState<LivePresence | null>(null);
  const [history, setHistory] = useState<VisitorHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const snap = await adminApi.presence();
        if (alive) setLive(snap);
      } catch (e) {
        if (e instanceof AdminAuthError) return onAuthError();
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      }
    };
    tick();
    const timer = window.setInterval(tick, ADMIN_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [onAuthError]);

  useEffect(() => {
    let alive = true;
    adminApi
      .presenceHistory(48)
      .then((h) => alive && setHistory(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="admin__error">{error}</div>;
  if (!live) return <div className="admin-boot">Chargement…</div>;

  const maxGov = Math.max(1, ...live.byGovernorate.map((g) => g.count));
  const maxHist = Math.max(1, ...history.map((h) => h.peakOnline));

  return (
    <div className="admin-live">
      <div className="admin-live__hero">
        <div className="admin-live__online">
          <span className="admin-live__dot" aria-hidden />
          <strong>{live.online}</strong>
          <span>en ligne maintenant</span>
        </div>
        <div className="admin-live__kpis">
          <div className="admin-live__kpi">
            <strong>{live.activeCarts}</strong>
            <span>paniers actifs</span>
          </div>
          <div className="admin-live__kpi">
            <strong>{live.swipeRatePerMin}</strong>
            <span>swipes / min</span>
          </div>
        </div>
      </div>

      <div className="admin-live__cols">
        <section className="admin-card">
          <h3>Par gouvernorat</h3>
          {live.byGovernorate.length === 0 && <p className="admin-muted">Aucun visiteur.</p>}
          <ul className="admin-live__bars">
            {live.byGovernorate.map((g) => (
              <li key={g.name}>
                <span className="admin-live__bar-label">{g.name}</span>
                <span className="admin-live__bar-track">
                  <span className="admin-live__bar-fill" style={{ width: `${(g.count / maxGov) * 100}%` }} />
                </span>
                <span className="admin-live__bar-val">{g.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-card">
          <h3>Pièces regardées</h3>
          {live.topPieces.length === 0 && <p className="admin-muted">Personne sur une pièce.</p>}
          <ul className="admin-live__pieces">
            {live.topPieces.map((p) => (
              <li key={p.pieceId}>
                <span>{p.title}</span>
                <span className="admin-live__count">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-card">
        <h3>Trafic (48 h)</h3>
        {history.length === 0 && <p className="admin-muted">Pas encore d'historique.</p>}
        <div className="admin-live__hist">
          {history.map((h) => (
            <span
              key={h.hour}
              className="admin-live__hist-bar"
              style={{ height: `${(h.peakOnline / maxHist) * 100}%` }}
              title={`${new Date(h.hour).toLocaleString('fr-FR')} — pic ${h.peakOnline}, moy ${h.avgOnline}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add styles** — append to `frontend/src/admin/admin.css` (uses the warm `--a-*` tokens):
```css
.admin-live { display: grid; gap: 1rem; }
.admin-live__hero {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 1.25rem 1.5rem;
  background: var(--a-surface); border: 1px solid var(--a-line);
  border-radius: 14px; box-shadow: var(--a-shadow);
}
.admin-live__online { display: flex; align-items: baseline; gap: .5rem; color: var(--a-ink); }
.admin-live__online strong { font-size: 2.4rem; line-height: 1; }
.admin-live__dot {
  width: 10px; height: 10px; border-radius: 50%; background: #22c55e;
  align-self: center; box-shadow: 0 0 0 0 rgba(34,197,94,.6);
  animation: admin-live-pulse 1.6s infinite;
}
@keyframes admin-live-pulse {
  70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
.admin-live__kpis { display: flex; gap: 1.5rem; }
.admin-live__kpi { display: flex; flex-direction: column; align-items: flex-end; }
.admin-live__kpi strong { font-size: 1.5rem; }
.admin-live__kpi span { font-size: .8rem; color: var(--a-ink); opacity: .65; }
.admin-live__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 760px) { .admin-live__cols { grid-template-columns: 1fr; } }
.admin-live__bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
.admin-live__bars li { display: grid; grid-template-columns: 7rem 1fr 2rem; align-items: center; gap: .5rem; }
.admin-live__bar-label { font-size: .85rem; color: var(--a-ink); }
.admin-live__bar-track { background: var(--a-canvas); border-radius: 6px; height: 10px; overflow: hidden; }
.admin-live__bar-fill { display: block; height: 100%; background: var(--a-ink); opacity: .8; }
.admin-live__bar-val { text-align: right; font-variant-numeric: tabular-nums; }
.admin-live__pieces { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; }
.admin-live__pieces li { display: flex; justify-content: space-between; gap: .5rem; font-size: .9rem; }
.admin-live__count { font-variant-numeric: tabular-nums; opacity: .7; }
.admin-live__hist { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
.admin-live__hist-bar { flex: 1; min-height: 2px; background: var(--a-ink); opacity: .55; border-radius: 2px 2px 0 0; }
.admin-muted { color: var(--a-ink); opacity: .6; font-size: .9rem; }
```

- [ ] **Step 3: Add the nav link + route in `frontend/src/admin/AdminApp.tsx`.**

Import:
```ts
import { AdminLive } from './AdminLive';
```
Add a nav link (after the "Tableau de bord" link is natural — it's the live view):
```tsx
          <NavLink to="/admin/live" className={navClass}>
            En direct
          </NavLink>
```
Add the route inside `<Routes>`:
```tsx
          <Route path="live" element={<AdminLive onAuthError={logout} />} />
```

- [ ] **Step 4: Build**

Run (from `frontend/`): `npm run build`
Expected: completes with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/admin/AdminLive.tsx frontend/src/admin/admin.css frontend/src/admin/AdminApp.tsx
git commit -m "feat(presence): admin 'En direct' live visitors view"
```

---

## Task 15: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start both servers**

Backend (from `backend/`): `npm run start:dev`
Frontend (from `frontend/`): `npm run dev` (ports 5174/5175 per project notes).

- [ ] **Step 2: Generate shopper traffic**

Open the shop in 2–3 browser tabs/windows. Browse the deck, open a piece (`/piece/:id`), add something to the cart, do a few swipes.

- [ ] **Step 3: Check the live view**

Log into `/admin`, open **En direct**. Within ~15–20s expect:
- **online** ≥ number of open shopper tabs,
- the open piece under **Pièces regardées**,
- **paniers actifs** ≥ 1 once a tab has a cart,
- **swipes / min** > 0 right after swiping (decays to 0 after a minute idle),
- governorate shows **Inconnu** in local dev (localhost has no geo) — this is expected.

- [ ] **Step 4: Confirm pruning**

Close the shopper tabs; within ~45s the **online** count drops toward 0.

- [ ] **Step 5: (Optional) Verify governorate mapping with a real IP**

To sanity-check the `geoip-lite` region codes, temporarily call `resolveGovernorate('<a known Tunisian public IP>')` in a scratch test or REPL and confirm it returns a real governorate. If the code→name mapping is off, adjust `TN_REGION_TO_GOVERNORATE` only.

- [ ] **Step 6: Final full-suite check**

Run (from `backend/`): `npm test`  → all PASS.
Run (from `frontend/`): `npx vitest run` → all PASS.

---

## Self-Review Notes

- **Spec coverage:** governorate granularity (Task 2), all live signals — online/governorates/viewing/carts/swipe rate (Tasks 6, 14), persisted hourly history (Tasks 5, 7, 14), polling transport (Tasks 8, 11, 12, 14), GeoIP isolated for MaxMind swap (Task 2), injected clock for tests (Task 6), `PRESENCE_MAX_ENTRIES` cap (Task 6), privacy/IP-not-stored (Task 6 `ping`), admin-not-counted (heartbeat only in shopper `App.tsx`, Task 12), French-only UI (Task 14). All covered.
- **Type consistency:** `LivePresence` (frontend) mirrors `PresenceSnapshot` (backend) field-for-field; `presencePing` payload matches `PingBody`/`PingContext`; `takeSwipes()`/`bumpSwipe()`/`setHasCart()` names are consistent across Tasks 11–12.
- **Migration:** uses the `migrate diff → deploy` path (not `migrate dev`) per the environment constraint; dev server must be stopped first (Windows DLL lock).
