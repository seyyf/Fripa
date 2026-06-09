import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { toTShirt } from '../shop/catalogue.loader';
import type { TShirt } from '../shop/types';

const OTP_TTL_MS = 5 * 60 * 1000;
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');

// Phone-OTP shopper accounts. No password; the SMS code is the secret. The SMS
// gateway is stubbed — in dev the code is returned in the response.
@Injectable()
export class AccountService {
  private readonly otps = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  requestOtp(phoneRaw: string) {
    const phone = digits(phoneRaw);
    if (phone.length < 8) throw new BadRequestException('Numéro de téléphone invalide.');
    const code = String(Math.floor(1000 + Math.random() * 9000));
    this.otps.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
    // TODO: send `code` via a Tunisian SMS gateway. Dev: hand it back.
    const dev = process.env.NODE_ENV !== 'production';
    return { ok: true, ...(dev ? { devCode: code } : {}) };
  }

  async verifyOtp(phoneRaw: string, codeRaw: string) {
    const phone = digits(phoneRaw);
    const rec = this.otps.get(phone);
    if (!rec || rec.expiresAt < Date.now() || rec.code !== String(codeRaw ?? '').trim()) {
      throw new UnauthorizedException('Code invalide ou expiré.');
    }
    this.otps.delete(phone);
    const user = await this.prisma.user.upsert({ where: { phone }, update: {}, create: { phone } });
    const token = this.jwt.sign({ sub: user.id, phone: user.phone });
    return { token, user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  async updateMe(userId: string, body: { name?: string; address?: string; email?: string }) {
    const data: Record<string, string | null> = {};
    for (const k of ['name', 'address', 'email'] as const) {
      if (body[k] !== undefined) data[k] = String(body[k]).trim() || null;
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.publicUser(user);
  }

  // Order history: orders whose phone matches the account's (no accounts on
  // existing orders, so we match by normalized phone).
  async orders(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const phone = digits(user?.phone);
    const all = await this.prisma.order.findMany({
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
    return all
      .filter((o) => digits(o.customerPhone) === phone)
      .map((o) => ({
        ref: o.ref,
        status: o.status,
        paid: o.paid,
        total: o.total,
        discount: o.discount,
        createdAt: o.createdAt,
        lines: o.lines.map((l) => ({ title: l.title, brand: l.brand, size: l.size, price: l.price, imageUrl: l.imageUrl })),
      }));
  }

  // --- Favorites (DB-backed, synced across devices) ---
  async favorites(userId: string): Promise<{ lines: TShirt[] }> {
    const favs = await this.prisma.favoriteItem.findMany({ where: { userId } });
    const ids = favs.map((f) => f.itemId);
    if (ids.length === 0) return { lines: [] };
    const items = await this.prisma.item.findMany({ where: { id: { in: ids }, status: 'active' } });
    return { lines: items.map(toTShirt) };
  }

  async addFavorite(userId: string, itemId: string) {
    if (itemId) {
      await this.prisma.favoriteItem.upsert({
        where: { userId_itemId: { userId, itemId } },
        update: {},
        create: { userId, itemId },
      });
    }
    return this.favorites(userId);
  }

  async removeFavorite(userId: string, itemId: string) {
    await this.prisma.favoriteItem.deleteMany({ where: { userId, itemId } });
    return this.favorites(userId);
  }

  // Merge anonymous (localStorage) favorites into the account on login.
  async syncFavorites(userId: string, itemIds: string[]) {
    for (const itemId of itemIds ?? []) {
      if (!itemId) continue;
      await this.prisma.favoriteItem
        .upsert({ where: { userId_itemId: { userId, itemId } }, update: {}, create: { userId, itemId } })
        .catch(() => undefined);
    }
    return this.favorites(userId);
  }

  private publicUser(u: User) {
    return { id: u.id, phone: u.phone, name: u.name, address: u.address, email: u.email };
  }
}
