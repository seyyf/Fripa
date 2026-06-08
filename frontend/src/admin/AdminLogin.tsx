import { useState } from 'react';
import { adminApi, setToken } from './adminApi';

interface Props {
  onAuthed: () => void;
}

export function AdminLogin({ onAuthed }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await adminApi.login(password);
      setToken(token);
      onAuthed();
    } catch {
      setError('Mot de passe incorrect.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <span className="logo__mark admin-login__mark">FR</span>
        <h1 className="admin-login__title">Fripa Admin</h1>
        <p className="admin-login__sub">Connecte-toi pour gérer le stock.</p>

        <label className="field">
          <span className="field__label">Mot de passe</span>
          <input
            className="filter-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </label>

        {error && <div className="checkout__error">{error}</div>}

        <button type="submit" className="btn btn--add btn--full" disabled={busy || !password}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
