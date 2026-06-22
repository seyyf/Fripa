import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ShopModule } from '../shop/shop.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminItemsController } from './admin-items.controller';
import { AdminItemsService } from './admin-items.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminUploadController } from './admin-upload.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminPromosController } from './admin-promos.controller';
import { AdminPromosService } from './admin-promos.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminInsightsController } from './admin-insights.controller';
import { AdminInsightsService } from './admin-insights.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { BaleController } from './bale.controller';
import { BaleService } from './bale.service';
import { PresenceModule } from '../presence/presence.module';
import { AdminPresenceController } from '../presence/admin-presence.controller';

@Module({
  imports: [
    // Reuse the shop's Prisma connection + catalogue loader for item CRUD.
    ShopModule,
    // Provides PresenceService for the guarded live-visitors endpoints below.
    PresenceModule,
    // Secret is resolved at init time from config, so .env is already loaded.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('ADMIN_JWT_SECRET') || 'dev-fripa-jwt-secret-change-in-prod',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [
    AdminController,
    AdminItemsController,
    AdminOrdersController,
    AdminUploadController,
    AdminStatsController,
    AdminCustomersController,
    AdminPromosController,
    AdminSettingsController,
    AdminInsightsController,
    AuditController,
    BaleController,
    AdminPresenceController,
  ],
  providers: [
    AdminService,
    AdminGuard,
    AdminItemsService,
    AdminOrdersService,
    AdminStatsService,
    AdminCustomersService,
    AdminPromosService,
    AdminInsightsService,
    AuditService,
    BaleService,
  ],
  // Exported so later admin feature modules can reuse the guard.
  exports: [AdminGuard, JwtModule],
})
export class AdminModule {}
