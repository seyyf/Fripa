import { Module } from '@nestjs/common';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [ShopModule],
})
export class AppModule {}
