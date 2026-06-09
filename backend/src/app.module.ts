import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShopModule } from './shop/shop.module';
import { AdminModule } from './admin/admin.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    // Loads .env into process.env / ConfigService for the whole app.
    ConfigModule.forRoot({ isGlobal: true }),
    ShopModule,
    AdminModule,
    AccountModule,
  ],
})
export class AppModule {}
