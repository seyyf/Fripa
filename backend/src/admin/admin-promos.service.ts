import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PromoCode } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { AuditService } from './audit.service';

export const PROMO_TYPES = ['percent', 'fixed'] as const;

export interface PromoInput {
  code: string;
  type: string;
  value: number;
  minOrder?: number | null;
  maxUses?: number | null;
  active?: boolean;
  expiresAt?: string | null;
}

@Injectable()
export class AdminPromosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<PromoCode[]> {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: PromoInput): Promise<PromoCode> {
    const data = this.validate(input, { partial: false });
    try {
      const promo = await this.prisma.promoCode.create({ data: data as Prisma.PromoCodeUncheckedCreateInput });
      this.audit.log('promo.create', promo.code, `${promo.value}${promo.type === 'percent' ? '%' : ' TND'}`);
      return promo;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Ce code existe déjà.');
      }
      throw e;
    }
  }

  async update(id: string, input: Partial<PromoInput>): Promise<PromoCode> {
    await this.getOrThrow(id);
    const data = this.validate(input, { partial: true });
    const promo = await this.prisma.promoCode.update({ where: { id }, data: data as Prisma.PromoCodeUncheckedUpdateInput });
    this.audit.log('promo.update', promo.code, Object.keys(data).join(', '));
    return promo;
  }

  async remove(id: string): Promise<{ ok: true }> {
    const promo = await this.getOrThrow(id);
    await this.prisma.promoCode.delete({ where: { id } });
    this.audit.log('promo.delete', promo.code);
    return { ok: true };
  }

  private async getOrThrow(id: string) {
    const p = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Code ${id} introuvable.`);
    return p;
  }

  private validate(input: Partial<PromoInput>, { partial }: { partial: boolean }) {
    const out: Record<string, unknown> = {};
    if (input.code !== undefined || !partial) {
      const code = String(input.code ?? '').trim().toUpperCase();
      if (!code) throw new BadRequestException('Le code est obligatoire.');
      out.code = code;
    }
    if (input.type !== undefined || !partial) {
      if (!PROMO_TYPES.includes(input.type as (typeof PROMO_TYPES)[number])) {
        throw new BadRequestException(`Type invalide (${PROMO_TYPES.join(', ')}).`);
      }
      out.type = input.type;
    }
    if (input.value !== undefined || !partial) {
      const v = input.value;
      if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
        throw new BadRequestException('La valeur doit être un entier positif.');
      }
      if (input.type === 'percent' && v > 100) {
        throw new BadRequestException('Le pourcentage ne peut dépasser 100.');
      }
      out.value = v;
    }
    for (const k of ['minOrder', 'maxUses'] as const) {
      if (input[k] !== undefined) {
        const v = input[k];
        if (v === null || v === ('' as unknown)) out[k] = null;
        else if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
          throw new BadRequestException(`« ${k} » doit être un entier positif ou vide.`);
        } else out[k] = v;
      }
    }
    if (input.active !== undefined) out.active = !!input.active;
    if (input.expiresAt !== undefined) {
      out.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }
    return out;
  }
}
