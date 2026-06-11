import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuditService } from './audit.service';

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.audit.list(limit ? parseInt(limit, 10) || 200 : 200);
  }
}
