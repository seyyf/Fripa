import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from './AccountContext';
import { accountApi, type AccountOrder, type RewardsStatus } from './accountApi';
import { useT } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/translations';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export function AccountPage() {
  const { t } = useT();
  const { user, ready, openLogin, logout, setUser } = useAccount();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [rewards, setRewards] = useState<RewardsStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setAddress(user.address ?? '');
    accountApi.orders().then(setOrders).catch(() => setOrders([]));
    accountApi.rewards().then(setRewards).catch(() => setRewards(null));
  }, [user]);

  async function copyReferral(code: string) {
    const text = t('account.shareText', { code, url: location.origin });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  if (!ready) return <main className="account"><p className="muted">{t('common.loading')}</p></main>;

  if (!user) {
    return (
      <main className="account account--guest">
        <h1 className="account__title">{t('account.title')}</h1>
        <p className="muted">{t('account.guestIntro')}</p>
        <button className="btn btn--add" onClick={openLogin}>{t('account.signIn')}</button>
      </main>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const updated = await accountApi.updateProfile({ name: name.trim(), address: address.trim() });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account">
      <div className="account__head">
        <h1 className="account__title">{t('account.title')}</h1>
        <button className="btn--ghost" onClick={logout}>{t('account.logout')}</button>
      </div>
      <p className="muted">{t('account.connectedAs', { phone: user.phone })}</p>

      <form className="account__profile" onSubmit={saveProfile}>
        <h2 className="checkout__section">{t('account.myInfo')}</h2>
        <label className="field">
          <span className="field__label">{t('account.name')}</span>
          <input className="filter-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('account.address')}</span>
          <input className="filter-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <button className="btn btn--add" disabled={busy}>{busy ? t('account.saving') : saved ? t('account.saved') : t('account.save')}</button>
      </form>

      {rewards && (rewards.loyalty.enabled || rewards.referral.enabled) && (
        <section className="rewards">
          <h2 className="checkout__section">{t('account.rewards')}</h2>

          {rewards.loyalty.enabled && (
            <div className="rewards__card">
              <div className="rewards__row">
                <span className="rewards__icon" aria-hidden="true">🎁</span>
                <div className="rewards__body">
                  <strong>{t('account.loyalty')}</strong>
                  {rewards.loyalty.available > 0 ? (
                    <p className="rewards__note rewards__note--on">
                      {t(
                        rewards.loyalty.available > 1
                          ? 'account.loyaltyReadyMany'
                          : 'account.loyaltyReadyOne',
                        { n: rewards.loyalty.available },
                      )}
                    </p>
                  ) : (
                    <p className="rewards__note muted">
                      {(() => {
                        const left = rewards.loyalty.threshold - rewards.loyalty.progress;
                        return t(
                          left > 1 ? 'account.loyaltyProgressMany' : 'account.loyaltyProgressOne',
                          { n: left },
                        );
                      })()}
                    </p>
                  )}
                </div>
              </div>
              <div className="rewards__stamps">
                {Array.from({ length: rewards.loyalty.threshold }).map((_, i) => (
                  <span
                    key={i}
                    className={`rewards__stamp ${i < rewards.loyalty.progress ? 'rewards__stamp--on' : ''}`}
                  />
                ))}
              </div>
            </div>
          )}

          {rewards.referral.enabled && (
            <div className="rewards__card">
              <div className="rewards__row">
                <span className="rewards__icon" aria-hidden="true">🤝</span>
                <div className="rewards__body">
                  <strong>{t('account.referralTitle')}</strong>
                  <p className="rewards__note muted">
                    {t('account.referralText')}
                    {rewards.referral.available > 0 &&
                      t(
                        rewards.referral.available > 1
                          ? 'account.referralPendingMany'
                          : 'account.referralPendingOne',
                        { n: rewards.referral.available },
                      )}
                  </p>
                </div>
              </div>
              <div className="rewards__code-row">
                <code className="rewards__code">{rewards.referralCode}</code>
                <button type="button" className="btn btn--pass rewards__share" onClick={() => copyReferral(rewards.referralCode)}>
                  {copied ? t('account.copied') : t('account.share')}
                </button>
              </div>
              {rewards.referral.referrals > 0 && (
                <p className="rewards__note muted">{t('account.referralCount', { n: rewards.referral.referrals })}</p>
              )}
            </div>
          )}
        </section>
      )}

      <h2 className="checkout__section account__orders-title">{t('account.ordersTitle')}</h2>
      {orders.length === 0 ? (
        <p className="muted">{t('account.noOrders')}</p>
      ) : (
        <ul className="account__orders">
          {orders.map((o) => (
            <li key={o.ref} className="account__order">
              <div className="account__order-head">
                <div>
                  <strong>{o.ref}</strong>
                  <span className="muted"> · {dateFmt.format(new Date(o.createdAt))}</span>
                </div>
                <span className="chip">{t(`status.${o.status}` as StringKey)}</span>
              </div>
              <div className="account__order-foot">
                <span className="muted">{o.lines.map((l) => l.title).join(', ')}</span>
                <span className="account__order-total">{o.total} TND</span>
              </div>
              <Link to={`/suivi?ref=${o.ref}`} className="account__order-track">{t('account.track')}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
