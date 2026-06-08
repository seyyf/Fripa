import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminStatsService } from './admin-stats.service';

@Controller('admin/stats')
@UseGuards(AdminGuard)
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  summary() {
    return this.stats.summary();
  }
}
