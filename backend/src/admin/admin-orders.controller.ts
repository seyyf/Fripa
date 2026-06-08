import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminOrdersService } from './admin-orders.service';

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list() {
    return this.orders.list();
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.orders.updateStatus(id, body?.status);
  }
}
