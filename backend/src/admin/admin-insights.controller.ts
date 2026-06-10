import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminInsightsService } from './admin-insights.service';

@Controller('admin/insights')
@UseGuards(AdminGuard)
export class AdminInsightsController {
  constructor(private readonly insights: AdminInsightsService) {}

  @Get()
  summary() {
    return this.insights.summary();
  }
}
