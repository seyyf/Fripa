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
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const item of store) {
          if (where.id.in.includes(item.id)) {
            Object.assign(item, data);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.length;
        for (let i = store.length - 1; i >= 0; i--) {
          if (where.id.in.includes(store[i].id)) store.splice(i, 1);
        }
        return { count: before - store.length };
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

  it('accepts a valid sale price and rejects a negative one', async () => {
    const { svc } = makeService();
    const item = await svc.create({ ...VALID, salePrice: 15 });
    expect(item.salePrice).toBe(15);
    await expect(svc.create({ ...VALID, salePrice: -1 })).rejects.toThrow();
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

describe('AdminItemsService.bulk', () => {
  const seed = () => [
    { id: 'a', status: 'active' } as any,
    { id: 'b', status: 'active' } as any,
    { id: 'c', status: 'active' } as any,
  ];

  it('bulk-updates the status of the selected items and reloads', async () => {
    const { svc, loader, store } = makeService(seed());
    const res = await svc.bulk(['a', 'b'], 'archived');
    expect(res).toEqual({ ok: true, count: 2 });
    expect(store.find((i) => i.id === 'a').status).toBe('archived');
    expect(store.find((i) => i.id === 'c').status).toBe('active'); // untouched
    expect(loader.reload).toHaveBeenCalledOnce();
  });

  it('bulk-deletes the selected items', async () => {
    const { svc, store } = makeService(seed());
    const res = await svc.bulk(['a', 'c'], 'delete');
    expect(res.count).toBe(2);
    expect(store.map((i) => i.id)).toEqual(['b']);
  });

  it('rejects an empty selection or an invalid action', async () => {
    const { svc, loader } = makeService(seed());
    await expect(svc.bulk([], 'archived')).rejects.toThrow();
    await expect(svc.bulk(['a'], 'frobnicate')).rejects.toThrow();
    expect(loader.reload).not.toHaveBeenCalled();
  });
});
