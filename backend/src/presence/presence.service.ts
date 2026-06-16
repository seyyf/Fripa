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
