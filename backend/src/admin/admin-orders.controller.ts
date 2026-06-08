import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminOrdersService, OrderPatch } from './admin-orders.service';

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list() {
    return this.orders.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: OrderPatch) {
    return this.orders.update(id, body);
  }

  @Post(':id/return')
  returnOrder(@Param('id') id: string) {
    return this.orders.returnOrder(id);
  }
}
