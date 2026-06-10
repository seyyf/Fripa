import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type SwipeLogAction = 'pass' | 'keep' | 'favorite' | 'cart_expired';

// Persists shopper interactions for the admin "Analyses" page. Fire-and-forget
// on purpose: the swipe loop is synchronous and hot, and losing an analytics
// row must never break (or slow) a swipe.
@Injectable()
export class SwipeLogService {
  private readonly logger = new Logger(SwipeLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(userId: string, itemId: string, action: SwipeLogAction): void {
    void this.prisma.swipeEvent
      .create({ data: { userId, itemId, action } })
      .catch((e) =>
        this.logger.warn(`SwipeEvent perdu (${action}): ${e instanceof Error ? e.message : e}`),
      );
  }
}
