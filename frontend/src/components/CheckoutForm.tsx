import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAccount } from '../account/AccountContext';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';

interface Props {
  cart: CartResponse;
  onPlaceOrder: (customer: CustomerInfo, promoCode?: string) => Promise<CheckoutResult>;
  onSuccess: (result: CheckoutResult) => void;
}

type Field = keyof CustomerInfo;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// The delivery form + validation, shared by the checkout page and the cart
// drawer so both behave identically.
export function CheckoutForm({ cart, onPlaceOrder, onSuccess }: Props) {
  const { user } = useAccount();
  const [form, setForm] = useState<CustomerInfo>({ name: '', email: '', address: '', phone: '' });

  // Prefill from the signed-in account, without overwriting anything typed.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      name: f.name || user.name || '',
      email: f.email || user.email || '',
      address: f.address || user.address || '',
      phone: f.phone || user.phone || '',
    }));
  }, [user]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const discount = promo?.discount ?? 0;
  const payable = cart.total - discount;

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await api.applyPromo(code);
      setPromo({ code: res.code, discount: res.discount });
    } catch (e) {
      setPromo(null);
      setPromoMsg(e instanceof Error && e.message && !e.message.startsWith('HTTP') ? e.message : 'Code invalide.');
    } finally {
      setPromoBusy(false);
    }
  }
  function clearPromo() {
    setPromo(null);
    setPromoInput('');
    setPromoMsg(null);
  }

  function set(field: Field, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) e.name = 'Le nom est obligatoire.';
    if (!form.email.trim()) e.email = "L'email est obligatoire.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Email invalide.';
    if (!form.address.trim()) e.address = "L'adresse est obligatoire.";
    if (!form.phone.trim()) e.phone = 'Le téléphone est obligatoire.';
    else if (form.phone.replace(/\D/g, '').length < 8) e.phone = 'Numéro trop court.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await onPlaceOrder(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
        },
        promo?.code,
      );
      if (res.ok) onSuccess(res);
      else setFormError(res.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout__form" onSubmit={submit} noValidate>
      <h2 className="checkout__section">Livraison</h2>

      <label className="field">
        <span className="field__label">Nom complet</span>
        <input
          className="filter-input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          autoComplete="name"
        />
        {errors.name && <span className="field__error">{errors.name}</span>}
      </label>

      <label className="field">
        <span className="field__label">Email</span>
        <input
          className="filter-input"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          autoComplete="email"
        />
        {errors.email && <span className="field__error">{errors.email}</span>}
      </label>

      <label className="field">
        <span className="field__label">Adresse de livraison</span>
        <input
          className="filter-input"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          autoComplete="street-address"
        />
        {errors.address && <span className="field__error">{errors.address}</span>}
      </label>

      <label className="field">
        <span className="field__label">Téléphone</span>
        <input
          className="filter-input"
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          autoComplete="tel"
          placeholder="20 123 456"
        />
        {errors.phone && <span className="field__error">{errors.phone}</span>}
      </label>

      <div className="checkout__promo">
        {promo ? (
          <div className="checkout__promo-applied">
            <span>Code <strong>{promo.code}</strong> appliqué · −{discount} TND</span>
            <button type="button" className="btn--ghost" onClick={clearPromo}>Retirer</button>
          </div>
        ) : (
          <div className="checkout__promo-row">
            <input
              className="filter-input"
              placeholder="Code promo"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="btn btn--pass"
              onClick={applyPromo}
              disabled={promoBusy || !promoInput.trim()}
            >
              {promoBusy ? '…' : 'Appliquer'}
            </button>
          </div>
        )}
        {promoMsg && <span className="field__error">{promoMsg}</span>}
      </div>

      {discount > 0 && (
        <div className="total">
          <span>Remise</span>
          <strong>−{discount} TND</strong>
        </div>
      )}

      {formError && <div className="checkout__error">{formError}</div>}
      <button type="submit" className="btn btn--add btn--full" disabled={submitting}>
        {submitting ? 'Envoi…' : `Confirmer la commande — ${payable} TND`}
      </button>
      <p className="muted checkout__pay-note">
        💵 Paiement à la livraison. Le paiement en ligne arrive bientôt.
      </p>
    </form>
  );
}
