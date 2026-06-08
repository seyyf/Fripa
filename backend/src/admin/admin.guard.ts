import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Protects admin routes: requires a valid `Authorization: Bearer <jwt>` whose
// payload carries the admin role.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(token);
      if (payload?.role !== 'admin') throw new UnauthorizedException();
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
