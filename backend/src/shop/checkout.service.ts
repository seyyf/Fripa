import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { ShopService } from './shop.service';
import { PromoService } from './promo.service';
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
    private readonly promo: PromoService,
  ) {}

  async checkout(
    userId: string,
    customer: CustomerInfo,
    promoCode?: string,
  ): Promise<CheckoutResult> {
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

    // Optional promo: validate up front so a bad code fails cleanly.
    let promoId: string | null = null;
    let promoCodeUpper: string | null = null;
    let promoMaxUses: number | null = null;
    let discount = 0;
    if (promoCode && promoCode.trim()) {
      try {
        const v = await this.promo.validateForTotal(promoCode, cart.total);
        promoId = v.promo.id;
        promoCodeUpper = v.promo.code;
        promoMaxUses = v.promo.maxUses;
        discount = v.discount;
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Code promo invalide.' };
      }
    }
    const finalTotal = cart.total - discount;
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

        // Atomically claim one promo use (guards against concurrent over-use).
        if (promoId) {
          const res = await tx.promoCode.updateMany({
            where: {
              id: promoId,
              active: true,
              ...(promoMaxUses != null ? { uses: { lt: promoMaxUses } } : {}),
            },
            data: { uses: { increment: 1 } },
          });
          if (res.count !== 1) throw new Error('PROMO_UNAVAILABLE');
        }

        const ref = `FR-${1001 + (await tx.order.count())}`;
        return tx.order.create({
          data: {
            ref,
            userId,
            customerName: customer.name.trim(),
            customerEmail: customer.email.trim(),
            customerAddress: customer.address.trim(),
            customerPhone: customer.phone.trim(),
            total: finalTotal,
            promoCode: promoCodeUpper,
            discount,
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

      const savedNote = discount > 0 ? ` (−${discount} TND avec ${promoCodeUpper})` : '';
      return {
        ok: true,
        ref: order.ref,
        message: `Commande ${order.ref} confirmée — ${finalTotal} TND${savedNote}. On te contacte pour la livraison !`,
        orderTotal: finalTotal,
        lines: cart.lines,
        customer,
      };
    } catch (e) {
      await this.loader.reload();
      if (e instanceof Error && e.message === 'PROMO_UNAVAILABLE') {
        return { ok: false, message: 'Code promo épuisé entre-temps. Réessaie sans le code.' };
      }
      // A piece in the cart was bought first by someone else — re-sync.
      return {
        ok: false,
        message: 'Trop tard — une pièce de ton panier vient de partir. Panier mis à jour.',
      };
    }
  }
}
