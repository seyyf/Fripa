import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

// Constant-time comparison that doesn't leak length (both sides are hashed to a
// fixed-size digest first, so timingSafeEqual never throws on length mismatch).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Single-admin auth: validate a password against ADMIN_PASSWORD and mint a short
// JWT. No user table yet — see the admin-dashboard plan.
@Injectable()
export class AdminService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  login(password: string): { token: string } {
    const expected = this.config.get<string>('ADMIN_PASSWORD') ?? '';
    if (!expected || !safeEqual(password ?? '', expected)) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }
    return { token: this.jwt.sign({ role: 'admin' }) };
  }
}
