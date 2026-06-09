import { BadRequestException, Injectable } from '@nestjs/common';
import type { PromoCode } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface PromoResult {
  promo: PromoCode;
  discount: number;
}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  // Discount this code yields on `cartTotal`, capped to the total and >= 0.
  computeDiscount(promo: { type: string; value: number }, cartTotal: number): number {
    const raw =
      promo.type === 'percent' ? Math.floor((cartTotal * promo.value) / 100) : promo.value;
    return Math.max(0, Math.min(raw, cartTotal));
  }

  // Validate a code against a cart total. Throws BadRequest (user-facing message)
  // if invalid; returns the promo + computed discount otherwise.
  async validateForTotal(rawCode: string, cartTotal: number): Promise<PromoResult> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Code promo manquant.');
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.active) throw new BadRequestException('Code promo invalide.');
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Code promo expiré.');
    }
    if (promo.maxUses != null && promo.uses >= promo.maxUses) {
      throw new BadRequestException('Code promo épuisé.');
    }
    if (promo.minOrder != null && cartTotal < promo.minOrder) {
      throw new BadRequestException(`Minimum ${promo.minOrder} TND pour ce code.`);
    }
    const discount = this.computeDiscount(promo, cartTotal);
    if (discount <= 0) throw new BadRequestException('Code promo sans effet sur ce panier.');
    return { promo, discount };
  }
}
