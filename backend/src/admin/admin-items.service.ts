import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Item } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { CatalogueLoader } from '../shop/catalogue.loader';
import { CATEGORIES, CONDITIONS, ITEM_STATUSES, SIZES } from '../shop/types';

export interface ItemInput {
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  salePrice?: number | null;
  size: string;
  brand: string;
  condition: string;
  color: string;
  seller: string;
  category: string;
  status?: string;
}

const STRING_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'brand',
  'color',
  'seller',
] as const;

// Admin CRUD over the item catalogue. Every mutation refreshes the in-memory
// catalogue (CatalogueLoader.reload) so the shopper deck reflects changes live.
@Injectable()
export class AdminItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
  ) {}

  // All items, every status — the admin sees drafts/archived too.
  list(): Promise<Item[]> {
    return this.prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: ItemInput): Promise<Item> {
    const data = this.validate(input, { partial: false });
    const item = await this.prisma.item.create({
      data: { id: this.generateId(), status: 'active', ...data } as Prisma.ItemUncheckedCreateInput,
    });
    await this.loader.reload();
    return item;
  }

  async update(id: string, input: Partial<ItemInput>): Promise<Item> {
    await this.getOrThrow(id);
    const data = this.validate(input, { partial: true });
    const item = await this.prisma.item.update({
      where: { id },
      data: data as Prisma.ItemUncheckedUpdateInput,
    });
    await this.loader.reload();
    return item;
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.getOrThrow(id);
    await this.prisma.item.delete({ where: { id } });
    await this.loader.reload();
    return { ok: true };
  }

  // Apply one action to many items in a single DB call, then reload once.
  // `action` is either 'delete' or one of the lifecycle statuses.
  async bulk(ids: string[], action: string): Promise<{ ok: true; count: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Aucune pièce sélectionnée.');
    }
    let count: number;
    if (action === 'delete') {
      ({ count } = await this.prisma.item.deleteMany({ where: { id: { in: ids } } }));
    } else if ((ITEM_STATUSES as readonly string[]).includes(action)) {
      ({ count } = await this.prisma.item.updateMany({
        where: { id: { in: ids } },
        data: { status: action },
      }));
    } else {
      throw new BadRequestException('Action groupée invalide.');
    }
    await this.loader.reload();
    return { ok: true, count };
  }

  private async getOrThrow(id: string): Promise<Item> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} introuvable.`);
    return item;
  }

  private generateId(): string {
    return `adm-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)
      .toString(36)
      .padStart(3, '0')}`;
  }

  // Validate + trim. With `partial: true` (updates), absent fields are skipped;
  // present fields are still validated. Throws BadRequest on any bad value.
  private validate(
    input: Partial<ItemInput>,
    { partial }: { partial: boolean },
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const key of STRING_FIELDS) {
      const value = input[key];
      if (value == null) {
        if (partial) continue;
        throw new BadRequestException(`Le champ « ${key} » est obligatoire.`);
      }
      if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestException(`Le champ « ${key} » est invalide.`);
      }
      out[key] = value.trim();
    }

    if (input.price != null || !partial) {
      const p = input.price;
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 0) {
        throw new BadRequestException('Le prix doit être un entier positif.');
      }
      out.price = p;
    }

    // salePrice: undefined → leave as-is; null → clear the sale; number → validate.
    if (input.salePrice !== undefined) {
      const sp = input.salePrice;
      if (sp === null) {
        out.salePrice = null;
      } else if (typeof sp !== 'number' || !Number.isInteger(sp) || sp < 0) {
        throw new BadRequestException('Le prix soldé doit être un entier positif ou vide.');
      } else {
        out.salePrice = sp;
      }
    }

    const oneOf = (key: string, value: unknown, allowed: readonly string[]) => {
      if (value == null) {
        if (partial) return;
        throw new BadRequestException(`Le champ « ${key} » est obligatoire.`);
      }
      if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new BadRequestException(`« ${key} » invalide. Valeurs : ${allowed.join(', ')}.`);
      }
      out[key] = value;
    };
    oneOf('size', input.size, SIZES);
    oneOf('condition', input.condition, CONDITIONS);
    oneOf('category', input.category, CATEGORIES);
    if (input.status != null) oneOf('status', input.status, ITEM_STATUSES);

    return out;
  }
}
