import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';
import { useT } from '../i18n/LanguageContext';
import { CheckoutForm } from './CheckoutForm';
import { WhatsAppConfirm } from './WhatsAppConfirm';

interface Props {
  cart: CartResponse;
  onPlaceOrder: (
    customer: CustomerInfo,
    promoCode?: string,
    referralCode?: string,
  ) => Promise<CheckoutResult>;
}

export function CheckoutPage({ cart, onPlaceOrder }: Props) {
  const { t } = useT();
  const [done, setDone] = useState<CheckoutResult | null>(null);

  // Order placed — confirmation.
  if (done) {
    return (
      <main className="checkout checkout--done">
        <div className="confirmation__icon">✓</div>
        <h1>{t('checkout.doneTitle')}</h1>
        <p className="checkout__ref">{t('checkout.doneRef', { ref: done.ref ?? '' })}</p>
        <p className="checkout__done-text">{done.message}</p>
        <p className="muted">{t('checkout.doneCod')}</p>
        <WhatsAppConfirm orderRef={done.ref} name={done.customer?.name} />
        <Link to="/catalogue" className="btn btn--add btn--wide">
          {t('cart.continue')}
        </Link>
      </main>
    );
  }

  // Empty cart.
  if (cart.lines.length === 0) {
    return (
      <main className="checkout checkout--empty">
        <div className="empty__emoji">🛒</div>
        <h1>{t('checkout.emptyTitle')}</h1>
        <p className="muted">{t('checkout.emptyText')}</p>
        <Link to="/catalogue" className="btn btn--add btn--wide">
          {t('checkout.seeRack')}
        </Link>
      </main>
    );
  }

  return (
    <main className="checkout">
      <Link to="/" className="pd__back">
        {t('checkout.continueShopping')}
      </Link>
      <h1 className="checkout__title">{t('checkout.title')}</h1>

      <div className="checkout__layout">
        <CheckoutForm cart={cart} onPlaceOrder={onPlaceOrder} onSuccess={setDone} />

        <aside className="checkout__summary">
          <h2 className="checkout__section">{t('checkout.yourOrder')}</h2>
          <ul className="checkout__lines">
            {cart.lines.map((line) => (
              <li key={line.id} className="checkout__line">
                <img src={line.imageUrl} alt={line.title} loading="lazy" decoding="async" />
                <div className="checkout__line-info">
                  <strong>{line.title}</strong>
                  <span className="muted">
                    {line.size} · {line.condition}
                  </span>
                </div>
                <span className="checkout__line-price">{line.price} TND</span>
              </li>
            ))}
          </ul>
          <div className="checkout__total">
            <span>{t('cart.total')}</span>
            <strong>{cart.total} TND</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}
