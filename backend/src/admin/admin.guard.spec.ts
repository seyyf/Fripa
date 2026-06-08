import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from './admin.guard';

const SECRET = 'test-secret';
const jwt = new JwtService({ secret: SECRET });
const guard = new AdminGuard(jwt);

function ctx(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('allows a valid admin bearer token', () => {
    const token = jwt.sign({ role: 'admin' });
    expect(guard.canActivate(ctx(`Bearer ${token}`))).toBe(true);
  });

  it('rejects a missing Authorization header', () => {
    expect(() => guard.canActivate(ctx())).toThrow();
  });

  it('rejects a non-Bearer scheme', () => {
    const token = jwt.sign({ role: 'admin' });
    expect(() => guard.canActivate(ctx(`Basic ${token}`))).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const forged = new JwtService({ secret: 'other-secret' }).sign({ role: 'admin' });
    expect(() => guard.canActivate(ctx(`Bearer ${forged}`))).toThrow();
  });

  it('rejects a valid token without the admin role', () => {
    const token = jwt.sign({ role: 'user' });
    expect(() => guard.canActivate(ctx(`Bearer ${token}`))).toThrow();
  });
});
