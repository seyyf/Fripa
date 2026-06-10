import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';

// How often the background sweep promotes due drafts.
const CHECK_INTERVAL_MS = 30_000;
// Pieces published within an hour of the first one count as the same "drop"
// for the public teaser.
const DROP_WINDOW_MS = 60 * 60 * 1000;

// Drop scheduling: a draft with a `publishAt` goes active automatically at
// that time. A background sweep covers idle periods; `next()` also activates
// lazily so the drop lands the moment a shopper's countdown asks for it.
@Injectable()
export class DropsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DropsService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
  ) {}

  onModuleInit(): void {
    void this.activateDue();
    this.timer = setInterval(() => void this.activateDue(), CHECK_INTERVAL_MS);
    this.timer.unref?.(); // never keep the process alive just for the sweep
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // Promote every draft whose publish time has passed, then refresh the live
  // catalogue once. Returns how many pieces just dropped.
  async activateDue(): Promise<number> {
    try {
      const { count } = await this.prisma.item.updateMany({
        where: { status: 'draft', publishAt: { lte: new Date() } },
        data: { status: 'active' },
      });
      if (count > 0) {
        await this.loader.reload();
        this.logger.log(`Drop : ${count} pièce(s) publiée(s) automatiquement.`);
      }
      return count;
    } catch (e) {
      this.logger.warn(`Activation des drops échouée: ${e instanceof Error ? e.message : e}`);
      return 0;
    }
  }

  // Public teaser: when the next drop lands and how many pieces it brings.
  async next(): Promise<{ at: Date | null; count: number }> {
    await this.activateDue();
    const first = await this.prisma.item.findFirst({
      where: { status: 'draft', publishAt: { gt: new Date() } },
      orderBy: { publishAt: 'asc' },
      select: { publishAt: true },
    });
    if (!first?.publishAt) return { at: null, count: 0 };
    const end = new Date(first.publishAt.getTime() + DROP_WINDOW_MS);
    const count = await this.prisma.item.count({
      where: { status: 'draft', publishAt: { gte: first.publishAt, lt: end } },
    });
    return { at: first.publishAt, count };
  }
}
