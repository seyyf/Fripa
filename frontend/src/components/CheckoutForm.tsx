import { useState } from 'react';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';

interface Props {
  cart: CartResponse;
  onPlaceOrder: (customer: CustomerInfo) => Promise<CheckoutResult>;
  onSuccess: (result: CheckoutResult) => void;
}

type Field = keyof CustomerInfo;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// The delivery form + validation, shared by the checkout page and the cart
// drawer so both behave identically.
export function CheckoutForm({ cart, onPlaceOrder, onSuccess }: Props) {
  const [form, setForm] = useState<CustomerInfo>({ name: '', email: '', address: '', phone: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const res = await onPlaceOrder({
        name: form.name.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
      });
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

      {formError && <div className="checkout__error">{formError}</div>}
      <button type="submit" className="btn btn--add btn--full" disabled={submitting}>
        {submitting ? 'Envoi…' : `Confirmer la commande — ${cart.total} TND`}
      </button>
      <p className="muted checkout__pay-note">
        💵 Paiement à la livraison. Le paiement en ligne arrive bientôt.
      </p>
    </form>
  );
}
