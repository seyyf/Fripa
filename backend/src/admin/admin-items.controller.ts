import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminItemsService, ItemInput } from './admin-items.service';

// All routes here require a valid admin JWT.
@Controller('admin/items')
@UseGuards(AdminGuard)
export class AdminItemsController {
  constructor(private readonly items: AdminItemsService) {}

  @Get()
  list() {
    return this.items.list();
  }

  @Post()
  create(@Body() body: ItemInput) {
    return this.items.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ItemInput>) {
    return this.items.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.items.remove(id);
  }
}
