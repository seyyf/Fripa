import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ShopService } from './shop.service';

@Controller()
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('items/field')
  field(
    @Query('userId') userId: string,
    @Query('count') count?: string,
    @Query('q') q?: string,
    @Query('sizes') sizes?: string,
    @Query('conditions') conditions?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    const n = Math.min(Math.max(parseInt(count ?? '12', 10) || 12, 1), 60);
    const csv = (v?: string) =>
      v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    const price = maxPrice ? parseInt(maxPrice, 10) : undefined;
    return this.shop.getField(userId || 'anon', n, {
      q: q?.trim() || undefined,
      sizes: csv(sizes) as any,
      conditions: csv(conditions) as any,
      maxPrice: price != null && !Number.isNaN(price) ? price : undefined,
    });
  }

  @Post('swipes/pass')
  pass(@Body() body: { userId: string; itemId: string }) {
    return this.shop.pass(body.userId || 'anon', body.itemId);
  }

  @Post('swipes/undo')
  undo(@Body() body: { userId: string }) {
    return this.shop.undo(body.userId || 'anon');
  }

  @Post('cart')
  add(@Body() body: { userId: string; itemId: string }) {
    return this.shop.addToCart(body.userId || 'anon', body.itemId);
  }

  @Get('cart/:userId')
  cart(@Param('userId') userId: string) {
    return this.shop.getCart(userId);
  }

  @Delete('cart/:userId/:itemId')
  remove(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.shop.removeFromCart(userId, itemId);
  }

  @Post('cart/:userId/checkout')
  checkout(@Param('userId') userId: string) {
    return this.shop.checkout(userId);
  }

  @Post('favorites')
  addFavorite(@Body() body: { userId: string; itemId: string }) {
    return this.shop.addFavorite(body.userId || 'anon', body.itemId);
  }

  @Get('favorites/:userId')
  favorites(@Param('userId') userId: string) {
    return this.shop.getFavorites(userId);
  }

  @Delete('favorites/:userId/:itemId')
  removeFavorite(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.shop.removeFavorite(userId, itemId);
  }

  @Post('favorites/:userId/:itemId/to-cart')
  moveFavoriteToCart(
    @Param('userId') userId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.shop.moveFavoriteToCart(userId, itemId);
  }

  @Post('session/:userId/reset')
  reset(@Param('userId') userId: string) {
    return this.shop.reset(userId);
  }

  @Post('session/:userId/reset-swipes')
  resetSwipes(@Param('userId') userId: string) {
    return this.shop.resetSwipes(userId);
  }
}
