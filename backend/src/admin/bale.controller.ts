import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { BaleService, BaleInput } from './bale.service';

@Controller('admin/bales')
@UseGuards(AdminGuard)
export class BaleController {
  constructor(private readonly bales: BaleService) {}

  @Get()
  list() {
    return this.bales.summaries();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.bales.detail(id);
  }

  @Post()
  create(@Body() body: BaleInput) {
    return this.bales.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<BaleInput>) {
    return this.bales.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bales.remove(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: { itemIds: string[] }) {
    return this.bales.assign(id, body?.itemIds);
  }
}
