import { Injectable, Logger } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';

// Append-only record of admin actions. Writes are fire-and-forget so logging
// can never break (or slow) the action it describes. `actor` is a fixed role
// for now — ready for named admin accounts later.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(action: string, target?: string, detail?: string, actor = 'admin'): void {
    void this.prisma.auditLog
      .create({ data: { actor, action, target, detail } })
      .catch((e) => this.logger.warn(`Audit non écrit (${action}): ${e instanceof Error ? e.message : e}`));
  }

  list(limit = 200): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
