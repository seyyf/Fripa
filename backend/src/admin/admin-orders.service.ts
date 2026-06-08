import { BadRequestException, Injectable } from '@nestjs/common';
import type { Order, OrderLine } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';

export type OrderWithLines = Order & { lines: OrderLine[] };

export const ORDER_STATUSES = [
  'Nouvelle',
  'Confirmée',
  'Expédiée',
  'Livrée',
  'Annulée',
] as const;

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

  async updateStatus(id: string, status: string): Promise<Order> {
    if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
      throw new BadRequestException(`Statut invalide. Valeurs : ${ORDER_STATUSES.join(', ')}.`);
    }
    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
