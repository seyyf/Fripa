import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { ShopService } from './shop.service';
import { PromoService } from './promo.service';
import { GOVERNORATES, SettingsService } from './settings.service';
import { NotifyService } from './notify.service';
import { CustomerInfo, effectivePrice } from './types';

export interface CheckoutResult {
  ok: boolean;
  message: string;
  ref?: string;
  orderTotal?: number;
  deliveryFee?: number;
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
    private readonly settings: SettingsService,
    private readonly notify: NotifyService,
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
    const governorate = customer.governorate?.trim() ?? '';
    if (!(GOVERNORATES as readonly string[]).includes(governorate)) {
      return { ok: false, message: 'Choisis ton gouvernorat pour la livraison.' };
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
    // Delivery: per-governorate fee, waived by the bundle rule (N+ pieces
    // and/or a minimum items total — see the admin settings).
    const itemsTotal = cart.total - discount;
    const freeDelivery = await this.settings.qualifiesFreeDelivery(cart.lines.length, itemsTotal);
    const deliveryFee = freeDelivery ? 0 : await this.settings.feeFor(governorate);
    const finalTotal = itemsTotal + deliveryFee;
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
            governorate,
            total: finalTotal,
            deliveryFee,
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

      // Ping the admin's WhatsApp (fire-and-forget — never blocks the shopper).
      this.notify.orderPlaced({
        ref: order.ref,
        total: finalTotal,
        deliveryFee,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        governorate,
        lineCount: cart.lines.length,
      });

      const savedNote = discount > 0 ? ` (−${discount} TND avec ${promoCodeUpper})` : '';
      const deliveryNote = freeDelivery
        ? ', livraison offerte 🚚'
        : `, dont ${deliveryFee} TND de livraison`;
      return {
        ok: true,
        ref: order.ref,
        message: `Commande ${order.ref} confirmée — ${finalTotal} TND${savedNote}${deliveryNote}. On te contacte pour la livraison !`,
        orderTotal: finalTotal,
        deliveryFee,
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
