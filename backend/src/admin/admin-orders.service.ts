import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Order, OrderLine } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { CatalogueLoader } from '../shop/catalogue.loader';
import { AuditService } from './audit.service';

export type OrderWithLines = Order & { lines: OrderLine[] };

export const ORDER_STATUSES = [
  'Nouvelle',
  'Confirmée',
  'Expédiée',
  'Livrée',
  'Retournée',
  'Annulée',
] as const;

export interface OrderPatch {
  status?: string;
  paid?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
    private readonly audit: AuditService,
  ) {}

  // Persisted orders, newest first, with their snapshotted line items.
  list(): Promise<OrderWithLines[]> {
    return this.prisma.order.findMany({
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Update status / paid flag / customer contact details.
  async update(id: string, patch: OrderPatch): Promise<Order> {
    const data: OrderPatch = {};
    if (patch.status !== undefined) {
      if (!ORDER_STATUSES.includes(patch.status as (typeof ORDER_STATUSES)[number])) {
        throw new BadRequestException(`Statut invalide. Valeurs : ${ORDER_STATUSES.join(', ')}.`);
      }
      data.status = patch.status;
    }
    if (patch.paid !== undefined) data.paid = !!patch.paid;
    for (const k of ['customerName', 'customerEmail', 'customerAddress', 'customerPhone'] as const) {
      if (patch[k] !== undefined) {
        const v = String(patch[k]).trim();
        if (!v) throw new BadRequestException(`« ${k} » ne peut pas être vide.`);
        data[k] = v;
      }
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Rien à mettre à jour.');
    const order = await this.prisma.order.update({ where: { id }, data });
    this.audit.log('order.update', order.ref, Object.keys(data).join(', '));
    return order;
  }

  // Mark an order returned and put its (still-sold) one-off pieces back on the
  // floor — then refresh the live catalogue.
  async returnOrder(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { lines: true } });
    if (!order) throw new NotFoundException(`Commande ${id} introuvable.`);
    const itemIds = order.lines.map((l) => l.itemId);
    await this.prisma.$transaction([
      this.prisma.item.updateMany({
        where: { id: { in: itemIds }, status: 'sold' },
        data: { status: 'active' },
      }),
      this.prisma.order.update({ where: { id }, data: { status: 'Retournée' } }),
    ]);
    await this.loader.reload();
    this.audit.log('order.return', order.ref, `${itemIds.length} pièce(s) remise(s) en stock`);
    return this.prisma.order.findUniqueOrThrow({ where: { id } });
  }
}
