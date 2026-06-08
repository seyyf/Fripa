import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PrismaService } from './prisma.service';
import { CatalogueLoader } from './catalogue.loader';
import { CheckoutService } from './checkout.service';

@Module({
  controllers: [ShopController],
  providers: [ShopService, PrismaService, CatalogueLoader, CheckoutService],
  // Exported so a future admin module can reuse the DB connection and trigger a
  // catalogue reload after mutating items.
  exports: [PrismaService, CatalogueLoader],
})
export class ShopModule {}
