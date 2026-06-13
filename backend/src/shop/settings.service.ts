import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// The 24 Tunisian governorates — the delivery zones offered at checkout.
export const GOVERNORATES = [
  'Tunis',
  'Ariana',
  'Ben Arous',
  'Manouba',
  'Nabeul',
  'Zaghouan',
  'Bizerte',
  'Béja',
  'Jendouba',
  'Le Kef',
  'Siliana',
  'Sousse',
  'Monastir',
  'Mahdia',
  'Sfax',
  'Kairouan',
  'Kasserine',
  'Sidi Bouzid',
  'Gabès',
  'Médenine',
  'Tataouine',
  'Gafsa',
  'Tozeur',
  'Kébili',
] as const;

export interface ShopConfig {
  // Default delivery fee (TND), applied when the governorate has no override.
  deliveryFee: number;
  // Per-governorate fee overrides (TND). Absent governorate → default fee.
  deliveryFees: Record<string, number>;
  // Bundle incentive: free delivery from this many pieces (null = disabled).
  freeDeliveryMinItems: number | null;
  // Free delivery when the items total (after discount) reaches this (null = disabled).
  freeDeliveryMinTotal: number | null;
  // The shop's public WhatsApp number — powers the shopper "confirm on WhatsApp"
  // link after checkout. International digits, e.g. "21620123456". Empty = hidden.
  whatsappShop: string;
  // CallMeBot new-order alerts: the admin's WhatsApp number + API key
  // (free setup: https://www.callmebot.com/blog/free-api-whatsapp-messages/).
  // Both empty = alerts disabled.
  whatsappAlertPhone: string;
  whatsappAlertApiKey: string;
  // Loyalty stamp card: after `loyaltyThreshold` delivered orders, the shopper
  // earns one free-delivery reward (auto-applied on their next paid-fee order).
  loyaltyEnabled: boolean;
  loyaltyThreshold: number;
  // Referral (parrainage): the new buyer's first order gets `referralRefereeDiscount`
  // TND off; the referrer earns one free-delivery credit per delivered referral.
  referralEnabled: boolean;
  referralRefereeDiscount: number;
  // Show the "Code promo" field at checkout. Off hides the field everywhere
  // (existing codes still validate if one is somehow submitted).
  promoEnabled: boolean;
}

export const DEFAULT_CONFIG: ShopConfig = {
  deliveryFee: 7,
  deliveryFees: {},
  freeDeliveryMinItems: 3,
  freeDeliveryMinTotal: null,
  whatsappShop: '',
  whatsappAlertPhone: '',
  whatsappAlertApiKey: '',
  loyaltyEnabled: false,
  loyaltyThreshold: 5,
  referralEnabled: false,
  referralRefereeDiscount: 5,
  promoEnabled: true, // promos have always been on; default preserves that
};

const CONFIG_KEY = 'shop-config';

// What anonymous shoppers may see (no alert credentials).
export interface PublicShopConfig {
  governorates: readonly string[];
  deliveryFee: number;
  deliveryFees: Record<string, number>;
  freeDeliveryMinItems: number | null;
  freeDeliveryMinTotal: number | null;
  whatsappShop: string;
  loyaltyEnabled: boolean;
  loyaltyThreshold: number;
  referralEnabled: boolean;
  referralRefereeDiscount: number;
  promoEnabled: boolean;
}

// Shop configuration persisted in the Setting table (one JSON row), cached in
// memory. Admin edits go through update(); shoppers read the public subset.
@Injectable()
export class SettingsService {
  private cache: ShopConfig | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShopConfig> {
    if (this.cache) return this.cache;
    const row = await this.prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
    let stored: Partial<ShopConfig> = {};
    if (row) {
      try {
        stored = JSON.parse(row.value);
      } catch {
        /* corrupt row → fall back to defaults */
      }
    }
    this.cache = { ...DEFAULT_CONFIG, ...stored };
    return this.cache;
  }

  async getPublic(): Promise<PublicShopConfig> {
    const c = await this.get();
    return {
      governorates: GOVERNORATES,
      deliveryFee: c.deliveryFee,
      deliveryFees: c.deliveryFees,
      freeDeliveryMinItems: c.freeDeliveryMinItems,
      freeDeliveryMinTotal: c.freeDeliveryMinTotal,
      whatsappShop: c.whatsappShop,
      loyaltyEnabled: c.loyaltyEnabled,
      loyaltyThreshold: c.loyaltyThreshold,
      referralEnabled: c.referralEnabled,
      referralRefereeDiscount: c.referralRefereeDiscount,
      promoEnabled: c.promoEnabled,
    };
  }

  async update(patch: Partial<ShopConfig>): Promise<ShopConfig> {
    const next = { ...(await this.get()), ...this.validate(patch) };
    await this.prisma.setting.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    });
    this.cache = next;
    return next;
  }

  // The delivery fee for a governorate (override, else default).
  async feeFor(governorate: string): Promise<number> {
    const c = await this.get();
    return c.deliveryFees[governorate] ?? c.deliveryFee;
  }

  // Does this cart qualify for free delivery? `itemsTotal` is after discount.
  async qualifiesFreeDelivery(itemCount: number, itemsTotal: number): Promise<boolean> {
    const c = await this.get();
    if (c.freeDeliveryMinItems != null && itemCount >= c.freeDeliveryMinItems) return true;
    if (c.freeDeliveryMinTotal != null && itemsTotal >= c.freeDeliveryMinTotal) return true;
    return false;
  }

  private validate(patch: Partial<ShopConfig>): Partial<ShopConfig> {
    const out: Partial<ShopConfig> = {};
    const intOrNull = (label: string, v: unknown, nullable: boolean): number | null => {
      if (v == null) {
        if (!nullable) throw new BadRequestException(`« ${label} » est obligatoire.`);
        return null;
      }
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        throw new BadRequestException(`« ${label} » doit être un entier positif.`);
      }
      return v;
    };
    if (patch.deliveryFee !== undefined) {
      out.deliveryFee = intOrNull('deliveryFee', patch.deliveryFee, false) as number;
    }
    if (patch.deliveryFees !== undefined) {
      if (typeof patch.deliveryFees !== 'object' || patch.deliveryFees === null) {
        throw new BadRequestException('« deliveryFees » doit être un objet gouvernorat → TND.');
      }
      const fees: Record<string, number> = {};
      for (const [gov, fee] of Object.entries(patch.deliveryFees)) {
        if (!(GOVERNORATES as readonly string[]).includes(gov)) {
          throw new BadRequestException(`Gouvernorat inconnu : ${gov}.`);
        }
        fees[gov] = intOrNull(`deliveryFees.${gov}`, fee, false) as number;
      }
      out.deliveryFees = fees;
    }
    if (patch.freeDeliveryMinItems !== undefined) {
      out.freeDeliveryMinItems = intOrNull('freeDeliveryMinItems', patch.freeDeliveryMinItems, true);
    }
    if (patch.freeDeliveryMinTotal !== undefined) {
      out.freeDeliveryMinTotal = intOrNull('freeDeliveryMinTotal', patch.freeDeliveryMinTotal, true);
    }
    for (const key of ['whatsappShop', 'whatsappAlertPhone', 'whatsappAlertApiKey'] as const) {
      const v = patch[key];
      if (v !== undefined) {
        if (typeof v !== 'string') throw new BadRequestException(`« ${key} » doit être un texte.`);
        out[key] = v.trim();
      }
    }
    for (const key of ['loyaltyEnabled', 'referralEnabled', 'promoEnabled'] as const) {
      if (patch[key] !== undefined) out[key] = !!patch[key];
    }
    if (patch.loyaltyThreshold !== undefined) {
      const v = patch.loyaltyThreshold;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
        throw new BadRequestException('« loyaltyThreshold » doit être un entier ≥ 1.');
      }
      out.loyaltyThreshold = v;
    }
    if (patch.referralRefereeDiscount !== undefined) {
      out.referralRefereeDiscount = intOrNull('referralRefereeDiscount', patch.referralRefereeDiscount, false) as number;
    }
    return out;
  }
}
