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

  @Get('items/next')
  next(@Query('userId') userId: string) {
    return this.shop.getNext(userId || 'anon');
  }

  @Post('swipes/pass')
  pass(@Body() body: { userId: string; itemId: string }) {
    return this.shop.pass(body.userId || 'anon', body.itemId);
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

  @Post('session/:userId/reset')
  reset(@Param('userId') userId: string) {
    return this.shop.reset(userId);
  }
}
