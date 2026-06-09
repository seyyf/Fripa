import { useState } from 'react';
import { accountApi, type Account } from './accountApi';

interface Props {
  onClose: () => void;
  onAuthed: (token: string, user: Account) => void;
}

export function LoginModal({ onClose, onAuthed }: Props) {
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
      setError(err instanceof Error ? err.message : 'Échec de l’envoi.');
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
      setError(err instanceof Error ? err.message : 'Code invalide.');
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>{step === 'phone' ? 'Se connecter' : 'Vérification'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        {step === 'phone' ? (
          <form className="login-modal__body" onSubmit={sendCode}>
            <p className="muted">Entre ton numéro — on t’envoie un code par SMS.</p>
            <label className="field">
              <span className="field__label">Téléphone</span>
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
              {busy ? 'Envoi…' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          <form className="login-modal__body" onSubmit={verify}>
            <p className="muted">Code envoyé au {phone}.</p>
            {devCode && <p className="login-modal__dev">Code (démo) : <strong>{devCode}</strong></p>}
            <label className="field">
              <span className="field__label">Code à 4 chiffres</span>
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
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            <button type="button" className="btn--ghost login-modal__back" onClick={() => setStep('phone')}>
              ← Changer de numéro
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
