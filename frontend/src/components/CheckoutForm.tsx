import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAccount } from '../account/AccountContext';
import { accountApi, type RewardsStatus } from '../account/accountApi';
import { useShopConfig } from '../hooks/useShopConfig';
import type { CartResponse, CheckoutResult, CustomerInfo } from '../types';

interface Props {
  cart: CartResponse;
  onPlaceOrder: (
    customer: CustomerInfo,
    promoCode?: string,
    referralCode?: string,
  ) => Promise<CheckoutResult>;
  onSuccess: (result: CheckoutResult) => void;
}

type Field = keyof CustomerInfo;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// The delivery form + validation, shared by the checkout page and the cart
// drawer so both behave identically.
export function CheckoutForm({ cart, onPlaceOrder, onSuccess }: Props) {
  const { user } = useAccount();
  const config = useShopConfig();
  const [form, setForm] = useState<CustomerInfo>({
    name: '',
    email: '',
    address: '',
    phone: '',
    governorate: '',
  });

  // Prefill from the signed-in account, without overwriting anything typed.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      name: f.name || user.name || '',
      email: f.email || user.email || '',
      address: f.address || user.address || '',
      phone: f.phone || user.phone || '',
      governorate: f.governorate,
    }));
  }, [user]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  // The signed-in shopper's reward standing (loyalty stamps + referrer credits),
  // so we can preview free delivery before the server confirms it.
  const [rewards, setRewards] = useState<RewardsStatus | null>(null);
  useEffect(() => {
    if (!user) {
      setRewards(null);
      return;
    }
    accountApi.rewards().then(setRewards).catch(() => setRewards(null));
  }, [user]);

  const discount = promo?.discount ?? 0;
  const refereeDiscount =
    config?.referralEnabled && referralInput.trim() ? config.referralRefereeDiscount : 0;
  const itemsTotal = Math.max(0, cart.total - discount - refereeDiscount);

  // Delivery: per-governorate fee, waived by the free-delivery rule. Mirrors
  // the backend computation; the server stays authoritative at submit time.
  const itemCount = cart.lines.length;
  const bundleFree =
    config != null &&
    ((config.freeDeliveryMinItems != null && itemCount >= config.freeDeliveryMinItems) ||
      (config.freeDeliveryMinTotal != null && itemsTotal >= config.freeDeliveryMinTotal));
  // A loyalty stamp or referrer credit also waives delivery (server prioritises
  // bundle > loyalty > referrer; here we just preview "free").
  const rewardFree =
    !!rewards && (rewards.loyalty.available > 0 || rewards.referral.available > 0);
  const freeDelivery = bundleFree || rewardFree;
  const freeReason = bundleFree
    ? null
    : rewards && rewards.loyalty.available > 0
      ? 'fidélité 🎁'
      : rewards && rewards.referral.available > 0
        ? 'parrainage 🤝'
        : null;
  // Per-governorate override, else the admin's default fee — so a price always
  // shows, even before a governorate is picked.
  const baseFee = config ? config.deliveryFees[form.governorate] ?? config.deliveryFee : null;
  const deliveryFee = config == null ? null : freeDelivery ? 0 : baseFee;
  const payable = itemsTotal + (deliveryFee ?? 0);
  // How many more pieces until free delivery (the bundle nudge).
  const missingForFree =
    config?.freeDeliveryMinItems != null && !freeDelivery
      ? config.freeDeliveryMinItems - itemCount
      : null;
  const referralActive = !!config?.referralEnabled;

  // Validate + apply a code. Returns the applied promo (or null). Used by the
  // "Appliquer" button, the field's onBlur, and the submit safety net — so the
  // discount lands even if the shopper never clicks "Appliquer".
  async function applyPromo(codeArg?: string): Promise<{ code: string; discount: number } | null> {
    const code = (codeArg ?? promoInput).trim();
    if (!code) {
      setPromo(null);
      return null;
    }
    if (promo && promo.code.toUpperCase() === code.toUpperCase()) return promo; // already applied
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await api.applyPromo(code);
      const applied = { code: res.code, discount: res.discount };
      setPromo(applied);
      return applied;
    } catch (e) {
      setPromo(null);
      setPromoMsg(e instanceof Error && e.message && !e.message.startsWith('HTTP') ? e.message : 'Code invalide.');
      return null;
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
    if (!form.governorate) e.governorate = 'Choisis ton gouvernorat.';
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

    // Safety net: a code typed but never "Appliqué". Apply it now so the
    // discount isn't lost. If it's invalid, stop and let them fix or clear it
    // rather than silently charging full price.
    let applied = promo;
    const typed = promoInput.trim();
    if (typed && (!promo || promo.code.toUpperCase() !== typed.toUpperCase())) {
      applied = await applyPromo(typed);
      if (!applied) {
        setFormError('Code promo non valide — corrige-le ou efface-le pour continuer.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await onPlaceOrder(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          governorate: form.governorate,
        },
        applied?.code,
        referralActive ? referralInput.trim() || undefined : undefined,
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
        <span className="field__label">Gouvernorat</span>
        <select
          className="filter-input"
          value={form.governorate}
          onChange={(e) => set('governorate', e.target.value)}
        >
          <option value="">— Choisir —</option>
          {(config?.governorates ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {errors.governorate && <span className="field__error">{errors.governorate}</span>}
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
              onChange={(e) => {
                setPromoInput(e.target.value.toUpperCase());
                setPromoMsg(null);
              }}
              onBlur={() => void applyPromo()}
            />
            <button
              type="button"
              className="btn btn--pass"
              onClick={() => void applyPromo()}
              disabled={promoBusy || !promoInput.trim()}
            >
              {promoBusy ? '…' : 'Appliquer'}
            </button>
          </div>
        )}
        {promoMsg && <span className="field__error">{promoMsg}</span>}
        {promoInput.trim() && !promo && !promoMsg && (
          <span className="muted checkout__promo-hint">Ton code sera appliqué à la commande.</span>
        )}
      </div>

      {referralActive && (
        <label className="field">
          <span className="field__label">Code de parrainage (facultatif)</span>
          <input
            className="filter-input"
            placeholder="Le code d'un ami"
            value={referralInput}
            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
          />
          {refereeDiscount > 0 && (
            <span className="muted checkout__promo-hint">
              −{refereeDiscount} TND sur ta 1ʳᵉ commande si le code est valide.
            </span>
          )}
        </label>
      )}

      {discount > 0 && (
        <div className="total">
          <span>Remise</span>
          <strong>−{discount} TND</strong>
        </div>
      )}
      {refereeDiscount > 0 && (
        <div className="total">
          <span>Parrainage</span>
          <strong>−{refereeDiscount} TND</strong>
        </div>
      )}

      {config && (
        <div className="total checkout__delivery">
          <span>Livraison{freeReason ? ` · ${freeReason}` : ''}</span>
          <strong>
            {freeDelivery ? (
              <span className="checkout__delivery-free">Offerte 🚚</span>
            ) : (
              `${deliveryFee ?? 0} TND`
            )}
          </strong>
        </div>
      )}
      {missingForFree != null && missingForFree > 0 && (
        <p className="muted checkout__free-hint">
          🚚 Plus que {missingForFree} pièce{missingForFree > 1 ? 's' : ''} pour la livraison
          offerte !
        </p>
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
