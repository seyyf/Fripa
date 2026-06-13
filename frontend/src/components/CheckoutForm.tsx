import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAccount } from '../account/AccountContext';
import { accountApi, type RewardsStatus } from '../account/accountApi';
import { useShopConfig } from '../hooks/useShopConfig';
import { useT } from '../i18n/LanguageContext';
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

// Persist what the shopper typed so closing the cart drawer (or reloading)
// doesn't wipe the delivery form. Cleared once an order is placed.
const DRAFT_KEY = 'fripa-checkout-draft';
const EMPTY_FORM: CustomerInfo = { name: '', email: '', address: '', phone: '', governorate: '' };

interface Draft {
  form: CustomerInfo;
  promoInput: string;
  referralInput: string;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        form: { ...EMPTY_FORM, ...(d.form ?? {}) },
        promoInput: typeof d.promoInput === 'string' ? d.promoInput : '',
        referralInput: typeof d.referralInput === 'string' ? d.referralInput : '',
      };
    }
  } catch {
    /* corrupt/unavailable storage → start blank */
  }
  return { form: { ...EMPTY_FORM }, promoInput: '', referralInput: '' };
}

// The delivery form + validation, shared by the checkout page and the cart
// drawer so both behave identically.
export function CheckoutForm({ cart, onPlaceOrder, onSuccess }: Props) {
  const { user } = useAccount();
  const config = useShopConfig();
  const { t } = useT();
  const [draft] = useState(loadDraft); // read once on mount
  const [form, setForm] = useState<CustomerInfo>(draft.form);

  // Prefill from the signed-in account, without overwriting anything typed
  // (or restored from the saved draft).
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
  const [promoInput, setPromoInput] = useState(draft.promoInput);
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [referralInput, setReferralInput] = useState(draft.referralInput);

  // Mirror the form + codes to localStorage so they survive an unmount/reload.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, promoInput, referralInput }));
    } catch {
      /* storage full/unavailable — non-fatal */
    }
  }, [form, promoInput, referralInput]);
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
      ? t('checkout.freeLoyalty')
      : rewards && rewards.referral.available > 0
        ? t('checkout.freeReferral')
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
  // Promo field shows by default (its long-standing behaviour); only an
  // explicit `promoEnabled: false` from the backend hides it.
  const promoActive = config?.promoEnabled !== false;

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
      setPromoMsg(e instanceof Error && e.message && !e.message.startsWith('HTTP') ? e.message : t('checkout.promoInvalid'));
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
    if (!form.name.trim()) e.name = t('checkout.errName');
    if (!form.email.trim()) e.email = t('checkout.errEmail');
    else if (!EMAIL_RE.test(form.email.trim())) e.email = t('checkout.errEmailBad');
    if (!form.governorate) e.governorate = t('checkout.errGov');
    if (!form.address.trim()) e.address = t('checkout.errAddress');
    if (!form.phone.trim()) e.phone = t('checkout.errPhone');
    else if (form.phone.replace(/\D/g, '').length < 8) e.phone = t('checkout.errPhoneShort');
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
        setFormError(t('checkout.promoBad'));
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
      if (res.ok) {
        // Order placed — drop the saved draft so the next order starts fresh.
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        onSuccess(res);
      } else setFormError(res.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout__form" onSubmit={submit} noValidate>
      <h2 className="checkout__section">{t('checkout.delivery')}</h2>

      <label className="field">
        <span className="field__label">{t('checkout.name')}</span>
        <input
          className="filter-input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          autoComplete="name"
        />
        {errors.name && <span className="field__error">{errors.name}</span>}
      </label>

      <label className="field">
        <span className="field__label">{t('checkout.email')}</span>
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
        <span className="field__label">{t('checkout.governorate')}</span>
        <select
          className="filter-input"
          value={form.governorate}
          onChange={(e) => set('governorate', e.target.value)}
        >
          <option value="">{t('checkout.govChoose')}</option>
          {(config?.governorates ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {errors.governorate && <span className="field__error">{errors.governorate}</span>}
      </label>

      <label className="field">
        <span className="field__label">{t('checkout.address')}</span>
        <input
          className="filter-input"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          autoComplete="street-address"
        />
        {errors.address && <span className="field__error">{errors.address}</span>}
      </label>

      <label className="field">
        <span className="field__label">{t('checkout.phone')}</span>
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

      {promoActive && (
        <div className="checkout__promo">
          {promo ? (
            <div className="checkout__promo-applied">
              <span>{t('checkout.promoApplied', { code: promo.code, discount })}</span>
              <button type="button" className="btn--ghost" onClick={clearPromo}>{t('common.remove')}</button>
            </div>
          ) : (
            <div className="checkout__promo-row">
              <input
                className="filter-input"
                placeholder={t('checkout.promoPlaceholder')}
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
                {promoBusy ? '…' : t('common.apply')}
              </button>
            </div>
          )}
          {promoMsg && <span className="field__error">{promoMsg}</span>}
          {promoInput.trim() && !promo && !promoMsg && (
            <span className="muted checkout__promo-hint">{t('checkout.promoHint')}</span>
          )}
        </div>
      )}

      {referralActive && (
        <label className="field">
          <span className="field__label">{t('checkout.referralLabel')}</span>
          <input
            className="filter-input"
            placeholder={t('checkout.referralPlaceholder')}
            value={referralInput}
            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
          />
          {refereeDiscount > 0 && (
            <span className="muted checkout__promo-hint">
              {t('checkout.referralHint', { discount: refereeDiscount })}
            </span>
          )}
        </label>
      )}

      {discount > 0 && (
        <div className="total">
          <span>{t('checkout.discount')}</span>
          <strong>−{discount} TND</strong>
        </div>
      )}
      {refereeDiscount > 0 && (
        <div className="total">
          <span>{t('checkout.referralRow')}</span>
          <strong>−{refereeDiscount} TND</strong>
        </div>
      )}

      {config && (
        <div className="total checkout__delivery">
          <span>{t('checkout.delivery')}{freeReason ? ` · ${freeReason}` : ''}</span>
          <strong>
            {freeDelivery ? (
              <span className="checkout__delivery-free">{t('checkout.deliveryFree')}</span>
            ) : (
              `${deliveryFee ?? 0} TND`
            )}
          </strong>
        </div>
      )}
      {missingForFree != null && missingForFree > 0 && (
        <p className="muted checkout__free-hint">
          {t(missingForFree > 1 ? 'checkout.freeMany' : 'checkout.freeOne', { n: missingForFree })}
        </p>
      )}

      {formError && <div className="checkout__error">{formError}</div>}
      <button type="submit" className="btn btn--add btn--full" disabled={submitting}>
        {submitting ? t('checkout.submitting') : t('checkout.confirm', { total: payable })}
      </button>
      <p className="muted checkout__pay-note">{t('checkout.payNote')}</p>
    </form>
  );
}
