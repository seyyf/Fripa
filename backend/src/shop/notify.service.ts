import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from './settings.service';

// Sends the admin a WhatsApp message when an order lands, via the free
// CallMeBot gateway (configured in the admin settings page). Failures are
// logged, never surfaced to the shopper — an alert must not break a checkout.
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(private readonly settings: SettingsService) {}

  // Fire-and-forget: callers don't await delivery.
  orderPlaced(order: {
    ref: string;
    total: number;
    deliveryFee: number;
    customerName: string;
    customerPhone: string;
    governorate: string;
    lineCount: number;
  }): void {
    const text =
      `🛍 Nouvelle commande ${order.ref} — ${order.lineCount} pièce${order.lineCount > 1 ? 's' : ''}, ` +
      `${order.total} TND (livraison ${order.deliveryFee} TND). ` +
      `${order.customerName}, ${order.governorate || '?'} — ${order.customerPhone}`;
    void this.sendWhatsApp(text).catch((e) =>
      this.logger.warn(`Alerte WhatsApp non envoyée: ${e instanceof Error ? e.message : e}`),
    );
  }

  // Send a WhatsApp message to the configured admin number. Returns false when
  // alerts are not configured. Used by orderPlaced and the settings test button.
  async sendWhatsApp(text: string): Promise<boolean> {
    const c = await this.settings.get();
    const phone = c.whatsappAlertPhone.replace(/\D/g, '');
    if (!phone || !c.whatsappAlertApiKey) return false;
    const url =
      `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(c.whatsappAlertApiKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CallMeBot HTTP ${res.status}`);
    return true;
  }
}
