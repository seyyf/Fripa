import { describe, it, expect, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AccountService } from './account.service';
import type { PrismaService } from '../shop/prisma.service';

function makeService(
  user = { id: 'u1', phone: '22000000', name: null, address: null, email: null, referralCode: 'FR0000ABC' },
) {
  const prisma = {
    user: { upsert: vi.fn(async () => user), findUnique: vi.fn(async () => user) },
  } as unknown as PrismaService;
  const jwt = new JwtService({ secret: 'test', signOptions: { expiresIn: '30d' } });
  const rewards = {
    ensureReferralCode: vi.fn(async () => user.referralCode ?? 'FR0000ABC'),
    loyaltyStatus: vi.fn(async () => ({ available: 0 })),
    referrerStatus: vi.fn(async () => ({ available: 0 })),
  } as any;
  return { svc: new AccountService(prisma, jwt, rewards), jwt };
}

describe('AccountService OTP', () => {
  it('requests a code (dev returns it) then verifies it → token + user', async () => {
    const { svc, jwt } = makeService();
    const { devCode } = svc.requestOtp('22 000 000') as { devCode: string };
    expect(devCode).toMatch(/^\d{4}$/);
    const res = await svc.verifyOtp('22000000', devCode);
    expect(res.user.phone).toBe('22000000');
    expect(jwt.verify(res.token).sub).toBe('u1');
  });

  it('rejects a wrong code', async () => {
    const { svc } = makeService();
    svc.requestOtp('22000000');
    await expect(svc.verifyOtp('22000000', '0000')).rejects.toThrow();
  });

  it('rejects a too-short phone', () => {
    const { svc } = makeService();
    expect(() => svc.requestOtp('123')).toThrow();
  });
});
