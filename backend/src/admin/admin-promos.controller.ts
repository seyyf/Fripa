import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminPromosService, PromoInput } from './admin-promos.service';

@Controller('admin/promos')
@UseGuards(AdminGuard)
export class AdminPromosController {
  constructor(private readonly promos: AdminPromosService) {}

  @Get()
  list() {
    return this.promos.list();
  }

  @Post()
  create(@Body() body: PromoInput) {
    return this.promos.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<PromoInput>) {
    return this.promos.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promos.remove(id);
  }
}
