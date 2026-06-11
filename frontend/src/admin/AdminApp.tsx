import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { adminApi, clearToken, getToken } from './adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminOverview } from './AdminOverview';
import { AdminItems } from './AdminItems';
import { AdminOrders } from './AdminOrders';
import { AdminCustomers } from './AdminCustomers';
import { AdminPromos } from './AdminPromos';
import { AdminSettings } from './AdminSettings';
import { AdminInsightsPage } from './AdminInsights';
import { AdminJournal } from './AdminJournal';
import './admin.css';

type AuthState = 'checking' | 'out' | 'in';

export default function AdminApp() {
  const [auth, setAuth] = useState<AuthState>('checking');

  // On load, validate any stored token against the guarded /admin/me probe.
  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setAuth('out');
      return;
    }
    adminApi
      .me()
      .then(() => alive && setAuth('in'))
      .catch(() => {
        clearToken();
        if (alive) setAuth('out');
      });
    return () => {
      alive = false;
    };
  }, []);

  function logout() {
    clearToken();
    setAuth('out');
  }

  if (auth === 'checking') {
    return <div className="admin-boot">Chargement…</div>;
  }

  if (auth === 'out') {
    return <AdminLogin onAuthed={() => setAuth('in')} />;
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `admin__nav-link ${isActive ? 'admin__nav-link--on' : ''}`;

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          <span className="logo__mark">FR</span>
          <div>
            <strong>Fripa Admin</strong>
            <span className="admin__brand-sub">Gestion du stock</span>
          </div>
        </div>
        <nav className="admin__nav">
          <NavLink to="/admin" end className={navClass}>
            Tableau de bord
          </NavLink>
          <NavLink to="/admin/items" className={navClass}>
            Pièces
          </NavLink>
          <NavLink to="/admin/orders" className={navClass}>
            Commandes
          </NavLink>
          <NavLink to="/admin/customers" className={navClass}>
            Clients
          </NavLink>
          <NavLink to="/admin/insights" className={navClass}>
            Analyses
          </NavLink>
          <NavLink to="/admin/promos" className={navClass}>
            Promos
          </NavLink>
          <NavLink to="/admin/settings" className={navClass}>
            Réglages
          </NavLink>
          <NavLink to="/admin/journal" className={navClass}>
            Journal
          </NavLink>
        </nav>
        <div className="admin__bar-actions">
          <a className="admin__link" href="/" target="_blank" rel="noreferrer">
            Voir la boutique ↗
          </a>
          <button className="admin__logout" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="admin__main">
        <Routes>
          <Route index element={<AdminOverview onAuthError={logout} />} />
          <Route path="items" element={<AdminItems onAuthError={logout} />} />
          <Route path="orders" element={<AdminOrders onAuthError={logout} />} />
          <Route path="customers" element={<AdminCustomers onAuthError={logout} />} />
          <Route path="insights" element={<AdminInsightsPage onAuthError={logout} />} />
          <Route path="promos" element={<AdminPromos onAuthError={logout} />} />
          <Route path="settings" element={<AdminSettings onAuthError={logout} />} />
          <Route path="journal" element={<AdminJournal onAuthError={logout} />} />
        </Routes>
      </main>
    </div>
  );
}
