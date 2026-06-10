import { useShopConfig } from '../hooks/useShopConfig';

interface Props {
  orderRef?: string;
  name?: string;
}

// "Confirmer sur WhatsApp" deep link shown on the order confirmation screens,
// prefilled with the order ref. Hidden when the shop has no WhatsApp number
// configured (admin → Réglages).
export function WhatsAppConfirm({ orderRef, name }: Props) {
  const config = useShopConfig();
  const phone = config?.whatsappShop.replace(/\D/g, '') ?? '';
  if (!phone || !orderRef) return null;
  const text = `Salam ! Je confirme ma commande ${orderRef}${name ? ` — ${name}` : ''}.`;
  return (
    <a
      className="btn btn--whatsapp btn--full"
      href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
    >
      💬 Confirmer sur WhatsApp
    </a>
  );
}
