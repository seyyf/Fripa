import { Injectable } from '@nestjs/common';
import type { Order, OrderLine } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';

export type OrderWithLines = Order & { lines: OrderLine[] };

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Persisted orders, newest first, with their snapshotted line items.
  list(): Promise<OrderWithLines[]> {
    return this.prisma.order.findMany({
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
