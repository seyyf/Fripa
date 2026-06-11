import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { ShopService } from './shop.service';
import { PromoService } from './promo.service';
import { GOVERNORATES, SettingsService } from './settings.service';
import { NotifyService } from './notify.service';
import { RewardsService } from './rewards.service';
import { CustomerInfo, effectivePrice } from './types';

export interface CheckoutResult {
  ok: boolean;
  message: string;
  ref?: string;
  orderTotal?: number;
  deliveryFee?: number;
  referralDiscount?: number;
  loyaltyApplied?: boolean;
  referrerRewardApplied?: boolean;
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
    private readonly rewards: RewardsService,
  ) {}

  async checkout(
    userId: string,
    customer: CustomerInfo,
    promoCode?: string,
    referralCode?: string,
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
    const phone = customer.phone.trim();

    // Referral (parrainage): a first-time buyer using a valid code gets a one-off
    // discount. A typed-but-invalid code fails cleanly (like a bad promo).
    let referredByCode: string | null = null;
    let referralDiscount = 0;
    if (referralCode && referralCode.trim()) {
      const v = await this.rewards.validateReferral(referralCode, phone);
      if (!v.ok) return { ok: false, message: v.message ?? 'Code de parrainage invalide.' };
      referredByCode = v.code ?? null;
      referralDiscount = Math.max(0, Math.min(v.discount ?? 0, cart.total - discount));
    }

    // Delivery: per-governorate fee, waived by (in priority) the bundle rule, a
    // loyalty stamp reward, or a referrer credit. A free-delivery reward is only
    // consumed when it actually waives a non-zero fee.
    const itemsTotal = cart.total - discount - referralDiscount;
    const bundleFree = await this.settings.qualifiesFreeDelivery(cart.lines.length, itemsTotal);
    let deliveryFee = bundleFree ? 0 : await this.settings.feeFor(governorate);
    let loyaltyApplied = false;
    let referrerRewardApplied = false;
    if (deliveryFee > 0) {
      const loy = await this.rewards.loyaltyStatus(phone);
      if (loy.available > 0) {
        deliveryFee = 0;
        loyaltyApplied = true;
      } else {
        const ref = await this.rewards.referrerStatus(phone);
        if (ref.available > 0) {
          deliveryFee = 0;
          referrerRewardApplied = true;
        }
      }
    }
    const freeDelivery = deliveryFee === 0;
    const finalTotal = itemsTotal + deliveryFee;
    const ids = cart.lines.map((l) => l.id);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Re-check availability inside the transaction: every piece must still
        // be active. If any was just sold by someone else, abort.
        const stillActive = await tx.item.findMany({
          where: { id: { in: ids }, status: 'active' },
          select: { id: true, cost: true },
        });
        if (stillActive.length !== ids.length) {
          throw new Error('ITEM_UNAVAILABLE');
        }
        // Snapshot each piece's cost so realized margin survives later edits.
        const costById = new Map(stillActive.map((i) => [i.id, i.cost]));
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
            loyaltyApplied,
            referredByCode,
            referralDiscount,
            referrerRewardApplied,
            lines: {
              create: cart.lines.map((l) => ({
                itemId: l.id,
                title: l.title,
                brand: l.brand,
                price: effectivePrice(l), // snapshot the price actually paid
                cost: costById.get(l.id) ?? 0, // snapshot cost for realized margin
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
      const refNote = referralDiscount > 0 ? `, −${referralDiscount} TND parrainage` : '';
      const freeReason = loyaltyApplied
        ? ' (fidélité 🎁)'
        : referrerRewardApplied
          ? ' (parrainage 🤝)'
          : '';
      const deliveryNote = freeDelivery
        ? `, livraison offerte 🚚${freeReason}`
        : `, dont ${deliveryFee} TND de livraison`;
      return {
        ok: true,
        ref: order.ref,
        message: `Commande ${order.ref} confirmée — ${finalTotal} TND${savedNote}${refNote}${deliveryNote}. On te contacte pour la livraison !`,
        orderTotal: finalTotal,
        deliveryFee,
        referralDiscount,
        loyaltyApplied,
        referrerRewardApplied,
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
