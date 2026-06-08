import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { ShopService } from './shop.service';
import { CustomerInfo, effectivePrice } from './types';

export interface CheckoutResult {
  ok: boolean;
  message: string;
  ref?: string;
  orderTotal?: number;
  lines?: unknown[];
  customer?: CustomerInfo;
}

// Places an order: persists it, marks the bought pieces sold GLOBALLY (so they
// leave every shopper's deck), and empties the buyer's cart. A transaction with
// an availability re-check prevents two shoppers buying the same one-off piece.
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
    private readonly shop: ShopService,
  ) {}

  async checkout(userId: string, customer: CustomerInfo): Promise<CheckoutResult> {
    const cart = this.shop.getCart(userId);
    if (cart.lines.length === 0) {
      return { ok: false, message: 'Panier vide.' };
    }
    if (
      !customer?.name?.trim() ||
      !customer?.email?.trim() ||
      !customer?.address?.trim() ||
      !customer?.phone?.trim()
    ) {
      return { ok: false, message: 'Informations de livraison manquantes.' };
    }

    const ids = cart.lines.map((l) => l.id);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Re-check availability inside the transaction: every piece must still
        // be active. If any was just sold by someone else, abort.
        const stillActive = await tx.item.findMany({
          where: { id: { in: ids }, status: 'active' },
          select: { id: true },
        });
        if (stillActive.length !== ids.length) {
          throw new Error('ITEM_UNAVAILABLE');
        }
        await tx.item.updateMany({ where: { id: { in: ids } }, data: { status: 'sold' } });

        const ref = `FR-${1001 + (await tx.order.count())}`;
        return tx.order.create({
          data: {
            ref,
            userId,
            customerName: customer.name.trim(),
            customerEmail: customer.email.trim(),
            customerAddress: customer.address.trim(),
            customerPhone: customer.phone.trim(),
            total: cart.total,
            lines: {
              create: cart.lines.map((l) => ({
                itemId: l.id,
                title: l.title,
                brand: l.brand,
                price: effectivePrice(l), // snapshot the price actually paid
                size: l.size,
                imageUrl: l.imageUrl,
              })),
            },
          },
        });
      });

      // The sold pieces leave the live catalogue for everyone; empty this cart.
      await this.loader.reload();
      this.shop.clearCart(userId);

      return {
        ok: true,
        ref: order.ref,
        message: `Commande ${order.ref} confirmée — ${cart.total} TND. On te contacte pour la livraison !`,
        orderTotal: cart.total,
        lines: cart.lines,
        customer,
      };
    } catch {
      // A piece in the cart was bought first by someone else — re-sync the
      // catalogue so the now-sold piece drops out of this user's cart.
      await this.loader.reload();
      return {
        ok: false,
        message: 'Trop tard — une pièce de ton panier vient de partir. Panier mis à jour.',
      };
    }
  }
}
