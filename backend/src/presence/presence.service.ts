import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../shop/prisma.service';
import { ITEMS } from '../shop/items.data';
import { resolveGovernorate } from './geoip';
import {
  ONLINE_WINDOW_MS,
  SWIPE_RATE_WINDOW_MS,
  PRESENCE_MAX_ENTRIES,
  SAMPLE_INTERVAL_MS,
  ROLLUP_INTERVAL_MS,
} from './presence.constants';
import type { PresenceEntry, PingContext, PresenceSnapshot } from './presence.types';

type Clock = () => number;
type Geo = (ip: string | undefined) => string;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly entries = new Map<string, PresenceEntry>();
  // Trailing buffer of swipe timestamps (ms) for the rate calc.
  private swipeTimes: number[] = [];
  // Online counts sampled once a minute; flushed into one hourly row.
  private samples: number[] = [];
  private sampleTimer?: ReturnType<typeof setInterval>;
  private rollupTimer?: ReturnType<typeof setInterval>;
  // Mutable so a test can shrink it; defaults to the constant.
  maxEntries = PRESENCE_MAX_ENTRIES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly now: Clock = () => Date.now(),
    private readonly geo: Geo = resolveGovernorate,
  ) {}

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
