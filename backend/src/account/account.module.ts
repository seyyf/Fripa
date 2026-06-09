import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ShopModule } from '../shop/shop.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountGuard } from './account.guard';

@Module({
  imports: [
    ShopModule, // PrismaService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('SHOPPER_JWT_SECRET') || 'dev-fripa-shopper-secret-change-me',
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [AccountController],
  providers: [AccountService, AccountGuard],
})
export class AccountModule {}
