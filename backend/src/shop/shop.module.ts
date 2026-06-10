import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { CheckoutService } from './checkout.service';
import { PromoService } from './promo.service';
import { SettingsService } from './settings.service';
import { NotifyService } from './notify.service';

@Module({
  controllers: [ShopController],
  providers: [
    ShopService,
    PrismaService,
    CatalogueLoader,
    CheckoutService,
    PromoService,
    SettingsService,
    NotifyService,
  ],
  // Exported so a future admin module can reuse the DB connection and trigger a
  // catalogue reload after mutating items.
  exports: [PrismaService, CatalogueLoader, SettingsService, NotifyService],
})
export class ShopModule {}
