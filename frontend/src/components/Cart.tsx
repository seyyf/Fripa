import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CartResponse } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cart: CartResponse;
  refresh: () => void;
}

export function Cart({ open, onClose, cart, refresh }: Props) {
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setConfirmation(null);
  }, [open]);

  async function remove(id: string) {
    await api.remove(id);
    refresh();
  }

  async function checkout() {
    const res = await api.checkout();
    if (res.ok) {
      setConfirmation(res.message);
      refresh();
    }
  }

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>Mon panier</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        {confirmation ? (
          <div className="drawer__confirmation">
            <div className="confirmation__icon">✓</div>
            <p>{confirmation}</p>
            <button className="btn btn--add" onClick={onClose}>Continuer à chiner</button>
          </div>
        ) : cart.lines.length === 0 ? (
          <div className="drawer__empty">
            <p>Ton panier est vide.</p>
            <p className="muted">Swipe à gauche pour passer, tape 🛒 pour garder.</p>
          </div>
        ) : (
          <>
            <ul className="cart-list">
              {cart.lines.map((line) => (
                <li key={line.id} className="cart-line">
                  <img src={line.imageUrl} alt={line.title} />
                  <div className="cart-line__info">
                    <strong>{line.title}</strong>
                    <span className="muted">{line.size} · {line.condition}</span>
                    <span className="cart-line__price">{line.price} TND</span>
                  </div>
                  <button className="icon-btn" onClick={() => remove(line.id)} aria-label="Retirer">
                    🗑
                  </button>
                </li>
              ))}
            </ul>
            <footer className="drawer__foot">
              <div className="total">
                <span>Total</span>
                <strong>{cart.total} TND</strong>
              </div>
              <button className="btn btn--add btn--full" onClick={checkout}>
                Passer commande
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
