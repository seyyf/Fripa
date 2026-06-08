import { describe, it, expect, vi } from 'vitest';
import { AdminItemsService, ItemInput } from './admin-items.service';
import type { PrismaService } from '../shop/prisma.service';
import type { CatalogueLoader } from '../shop/catalogue.loader';

const VALID: ItemInput = {
  title: 'Vintage Tee',
  description: 'Coton épais',
  imageUrl: 'https://example.test/x.jpg',
  price: 25,
  size: 'M',
  brand: 'Nike',
  condition: 'Bon état',
  color: 'Noir',
  seller: 'Tunis',
  category: 'T-shirts',
};

function makeService(seed: Array<{ id: string }> = []) {
  const store: any[] = seed.map((s) => ({ ...s }));
  const prisma = {
    item: {
      findMany: vi.fn(async () => store),
      findUnique: vi.fn(async ({ where }: any) => store.find((i) => i.id === where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        store.push(data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = store.find((i) => i.id === where.id);
        Object.assign(item, data);
        return item;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = store.findIndex((i) => i.id === where.id);
        return store.splice(idx, 1)[0];
      }),
    },
  } as unknown as PrismaService;
  const loader = { reload: vi.fn(async () => {}) } as unknown as CatalogueLoader;
  return { svc: new AdminItemsService(prisma, loader), prisma, loader, store };
}

describe('AdminItemsService.create', () => {
  it('creates a valid item with a generated id, default active status, and reloads', async () => {
    const { svc, loader, store } = makeService();
    const item = await svc.create(VALID);
    expect(item.id).toMatch(/^adm-/);
    expect(item.status).toBe('active');
    expect(item.title).toBe('Vintage Tee');
    expect(store).toHaveLength(1);
    expect(loader.reload).toHaveBeenCalledOnce();
  });

  it('honours an explicit status', async () => {
    const { svc } = makeService();
    const item = await svc.create({ ...VALID, status: 'draft' });
    expect(item.status).toBe('draft');
  });

  it.each([
    ['bad category', { ...VALID, category: 'Chaussures' }],
    ['bad size', { ...VALID, size: 'XXXL' }],
    ['bad condition', { ...VALID, condition: 'Neuf' }],
    ['negative price', { ...VALID, price: -5 }],
    ['non-integer price', { ...VALID, price: 9.9 }],
    ['empty title', { ...VALID, title: '  ' }],
    ['bad status', { ...VALID, status: 'live' }],
  ])('rejects %s and does not reload', async (_label, input) => {
    const { svc, loader, store } = makeService();
    await expect(svc.create(input as ItemInput)).rejects.toThrow();
    expect(store).toHaveLength(0);
    expect(loader.reload).not.toHaveBeenCalled();
  });
});

describe('AdminItemsService.update', () => {
  it('updates an existing item and reloads', async () => {
    const { svc, loader } = makeService([{ id: 'adm-1', ...VALID } as any]);
    const item = await svc.update('adm-1', { price: 99, status: 'sold' });
    expect(item.price).toBe(99);
    expect(item.status).toBe('sold');
    expect(loader.reload).toHaveBeenCalledOnce();
  });

  it('throws NotFound for an unknown id', async () => {
    const { svc, loader } = makeService();
    await expect(svc.update('nope', { price: 10 })).rejects.toThrow();
    expect(loader.reload).not.toHaveBeenCalled();
  });

  it('rejects an invalid value on update', async () => {
    const { svc } = makeService([{ id: 'adm-1', ...VALID } as any]);
    await expect(svc.update('adm-1', { category: 'Chaussures' })).rejects.toThrow();
  });
});

describe('AdminItemsService.remove', () => {
  it('deletes an existing item and reloads', async () => {
    const { svc, loader, store } = makeService([{ id: 'adm-1', ...VALID } as any]);
    const res = await svc.remove('adm-1');
    expect(res).toEqual({ ok: true });
    expect(store).toHaveLength(0);
    expect(loader.reload).toHaveBeenCalledOnce();
  });

  it('throws NotFound for an unknown id', async () => {
    const { svc } = makeService();
    await expect(svc.remove('nope')).rejects.toThrow();
  });
});

describe('AdminItemsService.list', () => {
  it('returns every item regardless of status', async () => {
    const { svc } = makeService([
      { id: 'a', status: 'active' } as any,
      { id: 'b', status: 'archived' } as any,
    ]);
    const items = await svc.list();
    expect(items).toHaveLength(2);
  });
});
