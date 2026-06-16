import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { PresenceService } from './presence.service';

@Controller('admin/presence')
@UseGuards(AdminGuard)
export class AdminPresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  snapshot() {
    return this.presence.snapshot();
  }

  @Get('history')
  history(@Query('hours') hours?: string) {
    return this.presence.history(hours ? Number(hours) : 48);
  }
}
