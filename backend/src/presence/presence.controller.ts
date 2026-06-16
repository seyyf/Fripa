import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PresenceService } from './presence.service';
import type { PingContext } from './presence.types';

interface PingBody extends PingContext {
  userId: string;
}

@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  // Public, best-effort heartbeat from the shopper app.
  @Post('ping')
  ping(@Body() body: PingBody, @Req() req: Request): { ok: true } {
    if (body?.userId) {
      this.presence.ping(body.userId, req.ip, {
        page: body.page ?? 'home',
        pieceId: body.pieceId,
        hasCart: !!body.hasCart,
        swipesSincePing: Number(body.swipesSincePing) || 0,
      });
    }
    return { ok: true };
  }
}
