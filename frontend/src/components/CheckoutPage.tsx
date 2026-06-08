import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';
import { CheckoutForm } from './CheckoutForm';

interface Props {
  cart: CartResponse;
  onPlaceOrder: (customer: CustomerInfo) => Promise<CheckoutResult>;
}

export function CheckoutPage({ cart, onPlaceOrder }: Props) {
  const [done, setDone] = useState<CheckoutResult | null>(null);

  // Order placed — confirmation.
  if (done) {
    return (
      <main className="checkout checkout--done">
        <div className="confirmation__icon">✓</div>
        <h1>Commande confirmée !</h1>
        <p className="checkout__ref">Référence : {done.ref}</p>
        <p className="checkout__done-text">{done.message}</p>
        <p className="muted">Paiement à la livraison — on te contacte pour confirmer.</p>
        <Link to="/catalogue" className="btn btn--add btn--wide">
          Continuer à chiner
        </Link>
      </main>
    );
  }

  // Empty cart.
  if (cart.lines.length === 0) {
    return (
      <main className="checkout checkout--empty">
        <div className="empty__emoji">🛒</div>
        <h1>Ton panier est vide.</h1>
        <p className="muted">
          Ajoute des pièces pour commander — les réservations expirent après 10 min.
        </p>
        <Link to="/catalogue" className="btn btn--add btn--wide">
          Voir le rayon
        </Link>
      </main>
    );
  }

  return (
    <main className="checkout">
      <Link to="/" className="pd__back">
        ← Continuer mes achats
      </Link>
      <h1 className="checkout__title">Finaliser la commande</h1>

      <div className="checkout__layout">
        <CheckoutForm cart={cart} onPlaceOrder={onPlaceOrder} onSuccess={setDone} />

        <aside className="checkout__summary">
          <h2 className="checkout__section">Ta commande</h2>
          <ul className="checkout__lines">
            {cart.lines.map((line) => (
              <li key={line.id} className="checkout__line">
                <img src={line.imageUrl} alt={line.title} />
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
            <span>Total</span>
            <strong>{cart.total} TND</strong>
          </div>
        </aside>
      </div>
    </main>
  );
}
