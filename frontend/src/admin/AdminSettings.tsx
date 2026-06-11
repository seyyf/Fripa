import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type ShopConfig } from './adminApi';

interface Props {
  onAuthError: () => void;
}

// Shop configuration: delivery fees per governorate, the free-delivery
// (bundle) rule, and the WhatsApp numbers (shop link + order alerts).
export function AdminSettings({ onAuthError }: Props) {
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showZones, setShowZones] = useState(false);

  function handleError(err: unknown) {
    if (err instanceof AdminAuthError) onAuthError();
    else setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
  }

  useEffect(() => {
    let alive = true;
    adminApi
      .getSettings()
      .then((res) => {
        if (!alive) return;
        setGovernorates(res.governorates);
        setConfig(res.config);
      })
      .catch(handleError);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !config) return <div className="checkout__error admin-items__error">{error}</div>;
  if (!config) return <p className="muted admin-items__empty">Chargement…</p>;

  function set<K extends keyof ShopConfig>(key: K, value: ShopConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
    setNotice(null);
  }

  function setZoneFee(gov: string, raw: string) {
    const fees = { ...config!.deliveryFees };
    if (raw === '') delete fees[gov];
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) return;
      fees[gov] = n;
    }
    set('deliveryFees', fees);
  }

  // Empty number input → null (rule disabled).
  const numOrNull = (raw: string) => (raw === '' ? null : Math.max(0, Math.floor(Number(raw) || 0)));

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminApi.updateSettings(config!);
      setConfig(res.config);
      setNotice('Réglages enregistrés.');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function testWhatsApp() {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      // Persist first so the test uses what's on screen.
      await adminApi.updateSettings(config!);
      await adminApi.testWhatsApp();
      setNotice('Message de test envoyé — vérifie ton WhatsApp.');
    } catch (err) {
      handleError(err);
    } finally {
      setTesting(false);
    }
  }

  const overrides = Object.keys(config.deliveryFees).length;

  return (
    <section className="admin-settings">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Réglages</h1>
          <p className="admin-items__count">Livraison, livraison offerte et WhatsApp</p>
        </div>
        <button className="btn btn--add" onClick={save} disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {error && <div className="checkout__error admin-items__error">{error}</div>}
      {notice && <div className="admin-notice">{notice}</div>}

      <div className="admin-panel">
        <h2 className="admin-panel__title">🚚 Livraison</h2>
        <div className="admin-form__grid">
          <label className="field">
            <span className="field__label">Frais par défaut (TND)</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              value={config.deliveryFee}
              onChange={(e) => set('deliveryFee', Math.max(0, Math.floor(e.target.valueAsNumber || 0)))}
            />
          </label>
        </div>
        <button className="admin-btn" onClick={() => setShowZones((v) => !v)}>
          {showZones ? 'Masquer' : 'Afficher'} les tarifs par gouvernorat
          {overrides > 0 ? ` (${overrides} personnalisé${overrides > 1 ? 's' : ''})` : ''}
        </button>
        {showZones && (
          <div className="admin-zones">
            {governorates.map((g) => (
              <label key={g} className="field admin-zone">
                <span className="field__label">{g}</span>
                <input
                  className="filter-input"
                  type="number"
                  min={0}
                  placeholder={`${config.deliveryFee}`}
                  value={config.deliveryFees[g] ?? ''}
                  onChange={(e) => setZoneFee(g, e.target.value)}
                />
              </label>
            ))}
          </div>
        )}
        <p className="muted admin-settings__hint">
          Champ vide = frais par défaut. Le tarif s'applique selon le gouvernorat choisi au
          checkout.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">🎁 Livraison offerte</h2>
        <div className="admin-form__grid">
          <label className="field">
            <span className="field__label">À partir de (pièces)</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              placeholder="désactivé"
              value={config.freeDeliveryMinItems ?? ''}
              onChange={(e) => set('freeDeliveryMinItems', numOrNull(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">Ou à partir de (TND, après remise)</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              placeholder="désactivé"
              value={config.freeDeliveryMinTotal ?? ''}
              onChange={(e) => set('freeDeliveryMinTotal', numOrNull(e.target.value))}
            />
          </label>
        </div>
        <p className="muted admin-settings__hint">
          Le panier affiche « Plus que X pièces pour la livraison offerte » — vide = règle
          désactivée.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">🎁 Fidélité</h2>
        <label className="field admin-promo-active">
          <input
            type="checkbox"
            checked={config.loyaltyEnabled}
            onChange={(e) => set('loyaltyEnabled', e.target.checked)}
          />
          <span className="field__label">Activer la carte de fidélité</span>
        </label>
        <div className="admin-form__grid">
          <label className="field">
            <span className="field__label">Commandes livrées pour une livraison offerte</span>
            <input
              className="filter-input"
              type="number"
              min={1}
              value={config.loyaltyThreshold}
              onChange={(e) => set('loyaltyThreshold', Math.max(1, Math.floor(e.target.valueAsNumber || 1)))}
            />
          </label>
        </div>
        <p className="muted admin-settings__hint">
          Après ce nombre de commandes livrées, le client gagne une livraison offerte (appliquée
          automatiquement à sa commande suivante). Visible sur sa page compte.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">🤝 Parrainage</h2>
        <label className="field admin-promo-active">
          <input
            type="checkbox"
            checked={config.referralEnabled}
            onChange={(e) => set('referralEnabled', e.target.checked)}
          />
          <span className="field__label">Activer le parrainage</span>
        </label>
        <div className="admin-form__grid">
          <label className="field">
            <span className="field__label">Réduction filleul — 1ʳᵉ commande (TND)</span>
            <input
              className="filter-input"
              type="number"
              min={0}
              value={config.referralRefereeDiscount}
              onChange={(e) => set('referralRefereeDiscount', Math.max(0, Math.floor(e.target.valueAsNumber || 0)))}
            />
          </label>
        </div>
        <p className="muted admin-settings__hint">
          Chaque client a un code à partager. Le filleul obtient la réduction sur sa 1ʳᵉ commande ;
          le parrain gagne une livraison offerte par filleul dont la commande est livrée.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">💬 WhatsApp boutique</h2>
        <div className="admin-form__grid">
          <label className="field admin-form__wide">
            <span className="field__label">Numéro public (format international, ex. 21620123456)</span>
            <input
              className="filter-input"
              value={config.whatsappShop}
              placeholder="21620123456"
              onChange={(e) => set('whatsappShop', e.target.value)}
            />
          </label>
        </div>
        <p className="muted admin-settings__hint">
          Affiche un bouton « Confirmer sur WhatsApp » après chaque commande. Vide = bouton
          masqué.
        </p>
      </div>

      <div className="admin-panel">
        <h2 className="admin-panel__title">🔔 Alertes nouvelle commande (WhatsApp)</h2>
        <div className="admin-form__grid">
          <label className="field">
            <span className="field__label">Ton numéro WhatsApp</span>
            <input
              className="filter-input"
              value={config.whatsappAlertPhone}
              placeholder="21620123456"
              onChange={(e) => set('whatsappAlertPhone', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Clé API CallMeBot</span>
            <input
              className="filter-input"
              value={config.whatsappAlertApiKey}
              placeholder="123456"
              onChange={(e) => set('whatsappAlertApiKey', e.target.value)}
            />
          </label>
        </div>
        <div className="admin-settings__row">
          <button className="admin-btn" onClick={testWhatsApp} disabled={testing}>
            {testing ? 'Envoi…' : 'Envoyer un message de test'}
          </button>
        </div>
        <p className="muted admin-settings__hint">
          Gratuit : envoie « I allow callmebot to send me messages » au bot WhatsApp de{' '}
          <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">
            callmebot.com
          </a>{' '}
          pour recevoir ta clé, puis colle-la ici. À chaque commande tu reçois réf, total et
          client.
        </p>
      </div>
    </section>
  );
}
