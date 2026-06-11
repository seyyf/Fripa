import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

export interface LoyaltyStatus {
  enabled: boolean;
  threshold: number;
  delivered: number; // delivered orders for this phone
  progress: number; // delivered % threshold (stamps toward the next reward)
  available: number; // free-delivery rewards ready to redeem
}

export interface ReferralStatus {
  enabled: boolean;
  referrals: number; // delivered orders placed with this shopper's code
  available: number; // free-delivery credits ready to redeem
}

export interface ReferralCheck {
  ok: boolean;
  message?: string;
  code?: string;
  discount?: number;
}

// Loyalty (stamp card) + referral (parrainage) maths. Both reward "free
// delivery"; the referee also gets a one-off discount. Availability is keyed by
// PHONE so it works for guests, not just logged-in accounts. Reads are taken
// before checkout's transaction — a concurrent double-order by the same phone
// could in theory double-spend one credit; negligible at this scale.
@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // Orders belonging to a phone (free-text column → normalise + filter in JS).
  private async ordersForPhone(phone: string) {
    const d = digits(phone);
    if (!d) return [];
    const all = await this.prisma.order.findMany({
      select: {
        customerPhone: true,
        status: true,
        loyaltyApplied: true,
        referrerRewardApplied: true,
      },
    });
    return all.filter((o) => digits(o.customerPhone) === d);
  }

  async loyaltyStatus(phone: string): Promise<LoyaltyStatus> {
    const c = await this.settings.get();
    const threshold = c.loyaltyThreshold;
    if (!c.loyaltyEnabled) {
      return { enabled: false, threshold, delivered: 0, progress: 0, available: 0 };
    }
    const orders = await this.ordersForPhone(phone);
    const delivered = orders.filter((o) => o.status === 'Livrée').length;
    const consumed = orders.filter((o) => o.loyaltyApplied).length;
    const earned = Math.floor(delivered / threshold);
    return {
      enabled: true,
      threshold,
      delivered,
      progress: delivered % threshold,
      available: Math.max(0, earned - consumed),
    };
  }

  async referrerStatus(phone: string): Promise<ReferralStatus> {
    const c = await this.settings.get();
    if (!c.referralEnabled) return { enabled: false, referrals: 0, available: 0 };
    const user = await this.prisma.user.findUnique({ where: { phone: digits(phone) } });
    if (!user?.referralCode) return { enabled: true, referrals: 0, available: 0 };
    const [referrals, orders] = await Promise.all([
      this.prisma.order.count({ where: { referredByCode: user.referralCode, status: 'Livrée' } }),
      this.ordersForPhone(phone),
    ]);
    const consumed = orders.filter((o) => o.referrerRewardApplied).length;
    return { enabled: true, referrals, available: Math.max(0, referrals - consumed) };
  }

  // Ensure a logged-in account has a personal referral code (idempotent).
  async ensureReferralCode(userId: string, phone: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.referralCode) return user.referralCode;
    // Short, readable, phone-seeded so it's stable-ish but collision-checked.
    const base = digits(phone).slice(-4) || '0000';
    for (let i = 0; i < 8; i++) {
      const suffix = Math.floor(Math.random() * 36 ** 3)
        .toString(36)
        .toUpperCase()
        .padStart(3, '0');
      const code = `FR${base}${suffix}`;
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch {
        // unique clash → try another suffix
      }
    }
    return user?.referralCode ?? '';
  }

  // Can `code` be used by the buyer at `phone`? Referee must be a first-time
  // buyer and not the code's owner.
  async validateReferral(codeRaw: string, phone: string): Promise<ReferralCheck> {
    const c = await this.settings.get();
    if (!c.referralEnabled) return { ok: false, message: 'Le parrainage n’est pas actif.' };
    const code = (codeRaw ?? '').trim().toUpperCase();
    if (!code) return { ok: false, message: 'Code de parrainage vide.' };
    const owner = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!owner) return { ok: false, message: 'Code de parrainage inconnu.' };
    if (digits(owner.phone) === digits(phone)) {
      return { ok: false, message: 'Tu ne peux pas utiliser ton propre code.' };
    }
    const prior = await this.ordersForPhone(phone);
    if (prior.length > 0) {
      return { ok: false, message: 'Le parrainage est réservé à ta première commande.' };
    }
    return { ok: true, code, discount: c.referralRefereeDiscount };
  }
}
