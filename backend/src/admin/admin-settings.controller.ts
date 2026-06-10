import { BadRequestException, Body, Controller, Get, Put, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { GOVERNORATES, SettingsService, ShopConfig } from '../shop/settings.service';
import { NotifyService } from '../shop/notify.service';

@Controller('admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly notify: NotifyService,
  ) {}

  @Get()
  async get() {
    return { governorates: GOVERNORATES, config: await this.settings.get() };
  }

  @Put()
  async update(@Body() body: Partial<ShopConfig>) {
    return { governorates: GOVERNORATES, config: await this.settings.update(body ?? {}) };
  }

  // Send a test message to the configured alert number, so the admin can check
  // the CallMeBot setup without placing a real order.
  @Post('test-whatsapp')
  async testWhatsApp() {
    const sent = await this.notify
      .sendWhatsApp('✅ Test Fripa — les alertes de commande WhatsApp fonctionnent.')
      .catch((e) => {
        throw new BadRequestException(
          `Échec de l'envoi : ${e instanceof Error ? e.message : 'erreur inconnue'}.`,
        );
      });
    if (!sent) {
      throw new BadRequestException(
        'Renseigne le numéro et la clé API CallMeBot, puis enregistre, avant de tester.',
      );
    }
    return { ok: true };
  }
}
