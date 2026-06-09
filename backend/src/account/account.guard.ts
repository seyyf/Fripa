import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Authenticates a shopper by their account JWT and attaches `userId` to the request.
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers?.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(token);
      req.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
