import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from './AccountContext';
import { accountApi, type AccountOrder } from './accountApi';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export function AccountPage() {
  const { user, ready, openLogin, logout, setUser } = useAccount();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setAddress(user.address ?? '');
    accountApi.orders().then(setOrders).catch(() => setOrders([]));
  }, [user]);

  if (!ready) return <main className="account"><p className="muted">Chargement…</p></main>;

  if (!user) {
    return (
      <main className="account account--guest">
        <h1 className="account__title">Mon compte</h1>
        <p className="muted">Connecte-toi pour retrouver tes commandes et ton adresse.</p>
        <button className="btn btn--add" onClick={openLogin}>Se connecter</button>
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
        <h1 className="account__title">Mon compte</h1>
        <button className="btn--ghost" onClick={logout}>Se déconnecter</button>
      </div>
      <p className="muted">Connecté avec {user.phone}</p>

      <form className="account__profile" onSubmit={saveProfile}>
        <h2 className="checkout__section">Mes infos</h2>
        <label className="field">
          <span className="field__label">Nom</span>
          <input className="filter-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Adresse de livraison</span>
          <input className="filter-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <button className="btn btn--add" disabled={busy}>{busy ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}</button>
      </form>

      <h2 className="checkout__section account__orders-title">Mes commandes</h2>
      {orders.length === 0 ? (
        <p className="muted">Aucune commande pour l’instant.</p>
      ) : (
        <ul className="account__orders">
          {orders.map((o) => (
            <li key={o.ref} className="account__order">
              <div className="account__order-head">
                <div>
                  <strong>{o.ref}</strong>
                  <span className="muted"> · {dateFmt.format(new Date(o.createdAt))}</span>
                </div>
                <span className="chip">{o.status}</span>
              </div>
              <div className="account__order-foot">
                <span className="muted">{o.lines.map((l) => l.title).join(', ')}</span>
                <span className="account__order-total">{o.total} TND</span>
              </div>
              <Link to={`/suivi?ref=${o.ref}`} className="account__order-track">Suivre →</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
