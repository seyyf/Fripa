import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';
import { effectivePrice, isOnSale } from '../types';
import { holdState, formatHold } from '../cart/holdTimer';
import { useShopConfig } from '../hooks/useShopConfig';
import { useT } from '../i18n/LanguageContext';
import { CheckoutForm } from './CheckoutForm';
import { WhatsAppConfirm } from './WhatsAppConfirm';

interface Props {
  open: boolean;
  onClose: () => void;
  cart: CartResponse;
  onRemove: (itemId: string) => void;
  onPlaceOrder: (
    customer: CustomerInfo,
    promoCode?: string,
    referralCode?: string,
  ) => Promise<CheckoutResult>;
}

export function Cart({ open, onClose, cart, onRemove, onPlaceOrder }: Props) {
  const reduce = useReducedMotion();
  const config = useShopConfig();
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  // Two-step flow inside the one drawer: review the cart, then fill the form.
  const [step, setStep] = useState<'cart' | 'pay'>('cart');
  const [done, setDone] = useState<CheckoutResult | null>(null);

  // Tick once a second while open so the hold countdowns update.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  // Reset to the review step whenever the drawer is closed, so reopening always
  // starts fresh (and clears a previous confirmation).
  useEffect(() => {
    if (!open) {
      setStep('cart');
      setDone(null);
    }
  }, [open]);

  // If the cart empties while paying (last item removed), fall back to review.
  useEffect(() => {
    if (step === 'pay' && cart.lines.length === 0) setStep('cart');
  }, [step, cart.lines.length]);

  if (!open) return null;

  const empty = cart.lines.length === 0;

  // Bundle nudge: with COD the delivery cost is per-order, so we push toward
  // the free-delivery threshold (admin → Réglages).
  const minItems = config?.freeDeliveryMinItems ?? null;
  const missingForFree = minItems != null ? minItems - cart.lines.length : null;
  const bundleNote =
    empty || missingForFree == null ? null : missingForFree > 0 ? (
      <p className="cart-free-note">
        {t(missingForFree > 1 ? 'cart.freeMany' : 'cart.freeOne', { n: missingForFree })}
      </p>
    ) : (
      <p className="cart-free-note cart-free-note--on">{t('cart.freeOn')}</p>
    );

  const itemList = (
    <ul className="cart-list">
      <AnimatePresence initial={false}>
        {cart.lines.map((line) => {
          const { remainingMs, phase } = holdState(line.expiresAt, now);
          return (
            <motion.li
              key={line.id}
              className="cart-line"
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, x: 80, height: 0, marginTop: 0, marginBottom: 0 }
              }
              transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 460, damping: 38 }}
            >
              <img src={line.imageUrl} alt={line.title} loading="lazy" decoding="async" />
              <div className="cart-line__info">
                <strong>{line.title}</strong>
                <span className="muted">{line.size} · {line.condition}</span>
                <span className="cart-line__price">
                  {isOnSale(line) && <span className="price-old">{line.price}</span>}
                  {effectivePrice(line)} TND
                </span>
                <span
                  className={`cart-line__hold ${phase === 'warning' ? 'cart-line__hold--warn' : ''}`}
                >
                  {t('cart.reserved', { time: formatHold(remainingMs) })}
                </span>
              </div>
              <button className="icon-btn" onClick={() => onRemove(line.id)} aria-label={t('common.remove')}>
                🗑
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );

  return (
    <div className="drawer-backdrop drawer-backdrop--side" onClick={onClose}>
      <aside className="drawer drawer--side" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          {step === 'pay' && !done ? (
            <button className="icon-btn" onClick={() => setStep('cart')} aria-label={t('cart.title')}>
              ←
            </button>
          ) : (
            <span />
          )}
          <h2>{done ? t('cart.confirmed') : step === 'pay' ? t('cart.finalize') : t('cart.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </header>

        {done ? (
          <div className="drawer__confirmation">
            <div className="confirmation__icon">✓</div>
            <h3>{t('cart.thanks')}</h3>
            <p className="checkout__ref">{t('cart.ref', { ref: done.ref ?? '' })}</p>
            <p className="muted">{done.message}</p>
            <p className="muted">{t('cart.codNote')}</p>
            <WhatsAppConfirm orderRef={done.ref} name={done.customer?.name} />
            <Link
              to={`/suivi?ref=${done.ref}`}
              className="drawer__track-link"
              onClick={onClose}
            >
              {t('cart.track')}
            </Link>
            <button className="btn btn--add btn--full" onClick={onClose}>
              {t('cart.continue')}
            </button>
          </div>
        ) : empty ? (
          <div className="drawer__empty">
            <p>{t('cart.empty')}</p>
            <p className="muted">{t('cart.emptyHint')}</p>
          </div>
        ) : step === 'cart' ? (
          <>
            <p className="cart-hold-note muted">{t('cart.holdNote')}</p>
            {itemList}
            <footer className="drawer__foot">
              {bundleNote}
              <div className="total">
                <span>{t('cart.total')}</span>
                <strong>{cart.total} TND</strong>
              </div>
              <button className="btn btn--add btn--full" onClick={() => setStep('pay')}>
                {t('cart.checkout')}
              </button>
            </footer>
          </>
        ) : (
          <div className="drawer__pay">
            <p className="cart-hold-note muted">
              {t(cart.lines.length > 1 ? 'cart.payNoteMany' : 'cart.payNote', { n: cart.lines.length })}
            </p>
            {itemList}
            <CheckoutForm cart={cart} onPlaceOrder={onPlaceOrder} onSuccess={setDone} />
          </div>
        )}
      </aside>
    </div>
  );
}
