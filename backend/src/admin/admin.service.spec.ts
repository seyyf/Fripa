import { describe, it, expect } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';

const SECRET = 'test-secret';

function makeService(password: string) {
  const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '12h' } });
  const env: Record<string, string> = { ADMIN_PASSWORD: password, ADMIN_JWT_SECRET: SECRET };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return { svc: new AdminService(jwt, config), jwt };
}

describe('AdminService.login', () => {
  it('issues an admin JWT for the correct password', () => {
    const { svc, jwt } = makeService('s3cret');
    const { token } = svc.login('s3cret');
    expect(typeof token).toBe('string');
    const payload = jwt.verify(token) as { role: string };
    expect(payload.role).toBe('admin');
  });

  it('rejects a wrong password', () => {
    const { svc } = makeService('s3cret');
    expect(() => svc.login('nope')).toThrow();
  });

  it('rejects when no admin password is configured', () => {
    const { svc } = makeService('');
    expect(() => svc.login('anything')).toThrow();
  });
});
