import { describe, it, expect, vi } from 'vitest';
import { AdminPromosService } from './admin-promos.service';
import type { PrismaService } from '../shop/prisma.service';

function makeService() {
  const create = vi.fn(async ({ data }: any) => ({ id: 'p1', uses: 0, active: true, ...data }));
  const prisma = {
    promoCode: { create, findUnique: vi.fn(async () => ({ id: 'p1' })), update: vi.fn(), delete: vi.fn() },
  } as unknown as PrismaService;
  return { svc: new AdminPromosService(prisma), create };
}

describe('AdminPromosService.create', () => {
  it('uppercases the code and stores a valid percent promo', async () => {
    const { svc, create } = makeService();
    const promo = await svc.create({ code: 'fripa10', type: 'percent', value: 10, maxUses: 100 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'FRIPA10', type: 'percent', value: 10 }) }),
    );
    expect(promo.code).toBe('FRIPA10');
  });

  it.each([
    ['bad type', { code: 'A', type: 'bogo', value: 10 }],
    ['percent over 100', { code: 'A', type: 'percent', value: 150 }],
    ['non-positive value', { code: 'A', type: 'fixed', value: 0 }],
    ['empty code', { code: '  ', type: 'fixed', value: 5 }],
  ])('rejects %s', async (_l, input) => {
    const { svc } = makeService();
    await expect(svc.create(input as any)).rejects.toThrow();
  });
});
