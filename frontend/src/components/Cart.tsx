import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';
import { effectivePrice, isOnSale } from '../types';
import { holdState, formatHold } from '../cart/holdTimer';
import { CheckoutForm } from './CheckoutForm';

interface Props {
  open: boolean;
  onClose: () => void;
  cart: CartResponse;
  onRemove: (itemId: string) => void;
  onPlaceOrder: (customer: CustomerInfo, promoCode?: string) => Promise<CheckoutResult>;
}

export function Cart({ open, onClose, cart, onRemove, onPlaceOrder }: Props) {
  const reduce = useReducedMotion();
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
                  ⏳ Réservé · {formatHold(remainingMs)}
                </span>
              </div>
              <button className="icon-btn" onClick={() => onRemove(line.id)} aria-label="Retirer">
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
            <button className="icon-btn" onClick={() => setStep('cart')} aria-label="Retour au panier">
              ←
            </button>
          ) : (
            <span />
          )}
          <h2>{done ? 'Commande confirmée' : step === 'pay' ? 'Finaliser' : 'Mon panier'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        {done ? (
          <div className="drawer__confirmation">
            <div className="confirmation__icon">✓</div>
            <h3>Merci ! C'est commandé.</h3>
            <p className="checkout__ref">Référence : {done.ref}</p>
            <p className="muted">{done.message}</p>
            <p className="muted">💵 Paiement à la livraison — on te contacte pour confirmer.</p>
            <button className="btn btn--add btn--full" onClick={onClose}>
              Continuer à chiner
            </button>
          </div>
        ) : empty ? (
          <div className="drawer__empty">
            <p>Ton panier est vide.</p>
            <p className="muted">Tape une pièce qui flotte, puis 🛒 pour la garder avant les autres.</p>
          </div>
        ) : step === 'cart' ? (
          <>
            <p className="cart-hold-note muted">
              ⏳ Chaque pièce est réservée 10 min. Passe commande avant que ça reparte.
            </p>
            {itemList}
            <footer className="drawer__foot">
              <div className="total">
                <span>Total</span>
                <strong>{cart.total} TND</strong>
              </div>
              <button className="btn btn--add btn--full" onClick={() => setStep('pay')}>
                Passer commande
              </button>
            </footer>
          </>
        ) : (
          <div className="drawer__pay">
            <p className="cart-hold-note muted">
              📦 {cart.lines.length} pièce{cart.lines.length > 1 ? 's' : ''} · tu peux encore en retirer avant de confirmer.
            </p>
            {itemList}
            <CheckoutForm cart={cart} onPlaceOrder={onPlaceOrder} onSuccess={setDone} />
          </div>
        )}
      </aside>
    </div>
  );
}
