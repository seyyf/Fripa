import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

// Provides PresenceService + the public ping endpoint. The guarded admin read
// controller lives in AdminModule (it needs AdminGuard); it consumes the
// PresenceService exported here.
@Module({
  imports: [ShopModule], // for PrismaService
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
