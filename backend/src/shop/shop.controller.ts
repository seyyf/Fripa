import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ShopService } from './shop.service';
import { CheckoutService } from './checkout.service';
import { PromoService } from './promo.service';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';
import { DropsService } from './drops.service';

@Controller()
export class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly checkoutService: CheckoutService,
    private readonly promo: PromoService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly drops: DropsService,
  ) {}

  // Public shop configuration: delivery zones/fees, the free-delivery rule and
  // the shop's WhatsApp number (no admin credentials).
  @Get('shop-config')
  shopConfig() {
    return this.settings.getPublic();
  }

  // Public drop teaser: when the next scheduled drop lands and its size.
  @Get('drops/next')
  nextDrop() {
    return this.drops.next();
  }

  // Public order tracking: look up by ref + phone (phone acts as the secret).
  @Get('orders/track')
  async track(@Query('ref') ref?: string, @Query('phone') phone?: string) {
    const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
    const order = await this.prisma.order.findUnique({
      where: { ref: (ref ?? '').trim().toUpperCase() },
      include: { lines: true },
    });
    if (!order || !digits(phone) || digits(order.customerPhone) !== digits(phone)) {
      throw new NotFoundException('Commande introuvable. Vérifie la référence et le téléphone.');
    }
    return {
      ref: order.ref,
      status: order.status,
      paid: order.paid,
      createdAt: order.createdAt,
      total: order.total,
      customerName: order.customerName,
      lines: order.lines.map((l) => ({
        title: l.title,
        brand: l.brand,
        size: l.size,
        price: l.price,
        imageUrl: l.imageUrl,
      })),
    };
  }

  private parseFilters(
    q?: string,
    sizes?: string,
    conditions?: string,
    maxPrice?: string,
    category?: string,
  ) {
    const csv = (v?: string) =>
      v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    const price = maxPrice ? parseInt(maxPrice, 10) : undefined;
    return {
      q: q?.trim() || undefined,
      sizes: csv(sizes) as any,
      conditions: csv(conditions) as any,
      maxPrice: price != null && !Number.isNaN(price) ? price : undefined,
      category: (category?.trim() || undefined) as any,
    };
  }

  @Get('categories')
  categories() {
    return this.shop.getCategories();
  }

  @Get('items/field')
  field(
    @Query('userId') userId: string,
    @Query('count') count?: string,
    @Query('q') q?: string,
    @Query('sizes') sizes?: string,
    @Query('conditions') conditions?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('category') category?: string,
  ) {
    const n = Math.min(Math.max(parseInt(count ?? '12', 10) || 12, 1), 60);
    return this.shop.getField(
      userId || 'anon',
      n,
      this.parseFilters(q, sizes, conditions, maxPrice, category),
    );
  }

  @Get('catalogue')
  catalogue(
    @Query('userId') userId: string,
    @Query('q') q?: string,
    @Query('sizes') sizes?: string,
    @Query('conditions') conditions?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('category') category?: string,
  ) {
    return this.shop.getCatalog(
      userId || 'anon',
      this.parseFilters(q, sizes, conditions, maxPrice, category),
    );
  }

  @Get('piece/:id')
  piece(@Param('id') id: string, @Query('userId') userId: string) {
    return this.shop.getOne(userId || 'anon', id);
  }

  @Post('swipes/pass')
  pass(@Body() body: { userId: string; itemId: string }) {
    return this.shop.pass(body.userId || 'anon', body.itemId);
  }

  @Post('swipes/undo')
  undo(@Body() body: { userId: string }) {
    return this.shop.undo(body.userId || 'anon');
  }

  // A phantom shopper grabs a piece off the catalogue floor.
  @Post('crowd/snatch')
  snatch(@Body() body: { userId: string; itemId: string }) {
    return this.shop.snatch(body.userId || 'anon', body.itemId);
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

  // Preview a promo against the user's current cart total.
  @Post('cart/:userId/promo')
  async applyPromo(@Param('userId') userId: string, @Body() body: { code: string }) {
    const cart = this.shop.getCart(userId);
    const { promo, discount } = await this.promo.validateForTotal(body?.code ?? '', cart.total);
    return {
      ok: true,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount,
      total: cart.total - discount,
    };
  }

  @Post('cart/:userId/checkout')
  checkout(
    @Param('userId') userId: string,
    @Body()
    body: {
      name: string;
      email: string;
      address: string;
      phone: string;
      governorate: string;
      promoCode?: string;
      referralCode?: string;
    },
  ) {
    return this.checkoutService.checkout(userId, body, body.promoCode, body.referralCode);
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
