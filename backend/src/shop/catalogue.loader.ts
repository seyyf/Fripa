import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Item } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { SEED_ITEMS, setItems } from './items.data';
import { TShirt } from './types';

function parseImages(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((u) => typeof u === 'string') : undefined;
  } catch {
    return undefined;
  }
}

// Map a DB row to the `TShirt` shape the shop logic expects. SQLite stores the
// enum-like columns as plain text, so we cast them back to their unions here.
export function toTShirt(row: Item): TShirt {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    images: parseImages(row.images),
    price: row.price,
    salePrice: row.salePrice,
    size: row.size as TShirt['size'],
    brand: row.brand,
    condition: row.condition as TShirt['condition'],
    color: row.color,
    seller: row.seller,
    category: row.category as TShirt['category'],
  };
}

// Keeps the in-memory catalogue (ITEMS) in sync with the database. The shop
// service stays synchronous and DB-agnostic; this loader is the only bridge.
@Injectable()
export class CatalogueLoader implements OnModuleInit {
  private readonly logger = new Logger(CatalogueLoader.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
    await this.reload();
  }

  // First boot against a fresh database: seed it from the bundled defaults so
  // the shop has stock without a manual step.
  private async seedIfEmpty(): Promise<void> {
    const count = await this.prisma.item.count();
    if (count > 0) return;
    this.logger.log(`Empty database — seeding ${SEED_ITEMS.length} bundled items.`);
    await this.prisma.item.createMany({
      data: SEED_ITEMS.map(({ images, ...i }) => ({
        ...i,
        images: images && images.length ? JSON.stringify(images) : null,
        status: 'active',
      })),
    });
  }

  // Refresh the live catalogue from the DB (active items only). Called at boot,
  // and after admin mutations in later slices.
  async reload(): Promise<void> {
    const rows = await this.prisma.item.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    setItems(rows.map(toTShirt));
    this.logger.log(`Loaded ${rows.length} active items from the database.`);
  }
}
