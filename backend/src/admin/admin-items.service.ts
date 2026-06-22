import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Item } from '@prisma/client';
import { PrismaService } from '../shop/prisma.service';
import { CatalogueLoader } from '../shop/catalogue.loader';
import { CATEGORIES, CONDITIONS, ITEM_STATUSES, SIZES } from '../shop/types';
import { AuditService } from './audit.service';
import { BaleService } from './bale.service';

export interface ItemInput {
  title: string;
  description: string;
  imageUrl: string;
  images?: string[] | null;
  price: number;
  cost?: number; // what the shop paid (souk price); powers margin
  salePrice?: number | null;
  size: string;
  brand: string;
  condition: string;
  color: string;
  seller: string;
  category: string;
  status?: string;
  // Drop scheduling: ISO date for the automatic draft → active promotion
  // (null clears the schedule).
  publishAt?: string | null;
  // The wholesale bale this piece belongs to (null clears it). Setting it
  // re-derives the bale's per-item cost.
  baleId?: string | null;
}

const STRING_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'brand',
  'color',
  'seller',
] as const;

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, commas
// and CRLF/LF line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Admin CRUD over the item catalogue. Every mutation refreshes the in-memory
// catalogue (CatalogueLoader.reload) so the shopper deck reflects changes live.
@Injectable()
export class AdminItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: CatalogueLoader,
    private readonly audit: AuditService,
    private readonly bales: BaleService,
  ) {}

  // All items, every status — the admin sees drafts/archived too.
  list(): Promise<Item[]> {
    return this.prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: ItemInput): Promise<Item> {
    const item = await this.createRaw(input);
    if (item.baleId) await this.bales.recost(item.baleId);
    await this.loader.reload();
    this.audit.log('item.create', item.title, `${item.price} TND · ${item.status}`);
    return item;
  }

  // Validate + persist a single item without reloading the catalogue (so batch
  // imports reload only once at the end).
  private createRaw(input: ItemInput): Promise<Item> {
    const data = this.validate(input, { partial: false });
    return this.prisma.item.create({
      data: { id: this.generateId(), status: 'active', ...data } as Prisma.ItemUncheckedCreateInput,
    });
  }

  // Bulk-create items from a CSV (header row maps columns to fields). Returns a
  // count of created rows and per-row errors; reloads the catalogue once.
  async importCsv(csv: string): Promise<{ created: number; errors: string[] }> {
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new BadRequestException('CSV vide ou sans ligne d’en-tête.');
    const headers = rows[0].map((h) => h.trim());
    const errors: string[] = [];
    let created = 0;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (cells.every((c) => c.trim() === '')) continue; // skip blank lines
      const o: Record<string, string> = {};
      headers.forEach((h, i) => (o[h] = (cells[i] ?? '').trim()));
      const input: ItemInput = {
        title: o.title,
        description: o.description,
        imageUrl: o.imageUrl,
        price: Number(o.price),
        cost: o.cost === '' || o.cost == null ? undefined : Number(o.cost),
        salePrice: o.salePrice === '' || o.salePrice == null ? null : Number(o.salePrice),
        size: o.size,
        brand: o.brand,
        condition: o.condition,
        color: o.color,
        seller: o.seller,
        category: o.category,
        status: o.status || undefined,
      };
      try {
        await this.createRaw(input);
        created++;
      } catch (e) {
        errors.push(`Ligne ${r + 1}: ${e instanceof Error ? e.message : 'invalide'}`);
      }
    }
    await this.loader.reload();
    this.audit.log('items.import', `${created} importée(s)`, errors.length ? `${errors.length} erreur(s)` : undefined);
    return { created, errors };
  }

  async update(id: string, input: Partial<ItemInput>): Promise<Item> {
    const prev = await this.getOrThrow(id);
    const data = this.validate(input, { partial: true });
    const item = await this.prisma.item.update({
      where: { id },
      data: data as Prisma.ItemUncheckedUpdateInput,
    });
    if ('baleId' in data) {
      if (prev.baleId && prev.baleId !== item.baleId) await this.bales.recost(prev.baleId);
      if (item.baleId) await this.bales.recost(item.baleId);
    }
    await this.loader.reload();
    this.audit.log('item.update', item.title, Object.keys(data).join(', '));
    return item;
  }

  async remove(id: string): Promise<{ ok: true }> {
    const item = await this.getOrThrow(id);
    await this.prisma.item.delete({ where: { id } });
    await this.loader.reload();
    this.audit.log('item.delete', item.title);
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
    this.audit.log('item.bulk', `${count} pièce(s)`, action);
    return { ok: true, count };
  }

  // Mark down every dormant piece in one shot: active, not already discounted,
  // in stock for at least `days`. salePrice = price − percent% (rounded, min 1).
  // SQLite has no UPDATE…expression through Prisma updateMany, so this runs
  // per-item inside one transaction, then reloads the catalogue once.
  async markdownDormant(days = 30, percent = 20): Promise<{ ok: true; count: number }> {
    if (!Number.isFinite(days) || days < 0) throw new BadRequestException('« days » invalide.');
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      throw new BadRequestException('« percent » doit être entre 1 et 99.');
    }
    const cutoff = new Date(Date.now() - days * 86400000);
    const dormant = await this.prisma.item.findMany({
      where: { status: 'active', salePrice: null, createdAt: { lte: cutoff } },
      select: { id: true, price: true },
    });
    if (dormant.length > 0) {
      await this.prisma.$transaction(
        dormant.map((i) =>
          this.prisma.item.update({
            where: { id: i.id },
            data: { salePrice: Math.max(1, Math.round(i.price * (1 - percent / 100))) },
          }),
        ),
      );
      await this.loader.reload();
      this.audit.log('items.markdown', `${dormant.length} dormante(s)`, `−${percent}% (+${days}j)`);
    }
    return { ok: true, count: dormant.length };
  }

  private async getOrThrow(id: string): Promise<Item> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} introuvable.`);
    return item;
  }

  private idSeq = 0;
  private generateId(): string {
    return `adm-${Date.now().toString(36)}${(this.idSeq++).toString(36)}${Math.floor(
      Math.random() * 36 ** 3,
    ).toString(36)}`;
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

    // cost: optional (defaults to 0); validated when provided.
    if (input.cost !== undefined) {
      const c = input.cost;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) {
        throw new BadRequestException('Le coût doit être un entier positif ou vide.');
      }
      out.cost = c;
    }

    // images: undefined → leave as-is; array → store as JSON (filtered, trimmed).
    if (input.images !== undefined) {
      if (input.images === null) {
        out.images = null;
      } else if (!Array.isArray(input.images)) {
        throw new BadRequestException('« images » doit être une liste d’URL.');
      } else {
        const urls = input.images.map((u) => String(u).trim()).filter(Boolean);
        out.images = urls.length ? JSON.stringify(urls) : null;
      }
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

    // publishAt: undefined → leave as-is; null → unschedule; string → valid date.
    if (input.publishAt !== undefined) {
      if (input.publishAt === null) {
        out.publishAt = null;
      } else {
        const d = new Date(input.publishAt);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('« publishAt » doit être une date valide.');
        }
        out.publishAt = d;
      }
    }

    // baleId: undefined → leave as-is; null → detach; string → assign.
    if (input.baleId !== undefined) {
      if (input.baleId === null) out.baleId = null;
      else if (typeof input.baleId !== 'string' || !input.baleId.trim()) {
        throw new BadRequestException('« baleId » invalide.');
      } else out.baleId = input.baleId;
    }

    return out;
  }
}
