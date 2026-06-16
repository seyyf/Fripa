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
