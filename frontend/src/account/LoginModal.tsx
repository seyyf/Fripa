import { useState } from 'react';
import { accountApi, type Account } from './accountApi';
import { useT } from '../i18n/LanguageContext';

interface Props {
  onClose: () => void;
  onAuthed: (token: string, user: Account) => void;
}

export function LoginModal({ onClose, onAuthed }: Props) {
  const { t } = useT();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await accountApi.requestOtp(phone);
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.sendFail'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await accountApi.verifyOtp(phone, code);
      onAuthed(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.codeInvalid'));
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>{step === 'phone' ? t('login.title') : t('login.verifyTitle')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </header>

        {step === 'phone' ? (
          <form className="login-modal__body" onSubmit={sendCode}>
            <p className="muted">{t('login.phoneIntro')}</p>
            <label className="field">
              <span className="field__label">{t('login.phone')}</span>
              <input
                className="filter-input"
                type="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="20 123 456"
              />
            </label>
            {error && <div className="checkout__error">{error}</div>}
            <button className="btn btn--add btn--full" disabled={busy || phone.replace(/\D/g, '').length < 8}>
              {busy ? t('login.sending') : t('login.getCode')}
            </button>
          </form>
        ) : (
          <form className="login-modal__body" onSubmit={verify}>
            <p className="muted">{t('login.codeSentTo', { phone })}</p>
            {devCode && <p className="login-modal__dev">{t('login.devCode')} <strong>{devCode}</strong></p>}
            <label className="field">
              <span className="field__label">{t('login.codeLabel')}</span>
              <input
                className="filter-input"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
              />
            </label>
            {error && <div className="checkout__error">{error}</div>}
            <button className="btn btn--add btn--full" disabled={busy || code.length !== 4}>
              {busy ? t('login.connecting') : t('login.signIn')}
            </button>
            <button type="button" className="btn--ghost login-modal__back" onClick={() => setStep('phone')}>
              {t('login.changeNumber')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
