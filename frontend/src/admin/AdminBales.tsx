import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, AdminAuthError, type BaleSummary } from './adminApi';

interface Props {
  onAuthError: () => void;
}

export function AdminBales({ onAuthError }: Props) {
  const nav = useNavigate();
  const [bales, setBales] = useState<BaleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', cost: 0 });

  async function load() {
    try {
      setBales(await adminApi.listBales());
    } catch (e) {
      if (e instanceof AdminAuthError) return onAuthError();
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!form.label.trim() || form.cost <= 0) return;
    try {
      await adminApi.createBale({ label: form.label.trim(), totalCost: Math.round(form.cost) });
      setForm({ label: '', cost: 0 });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création.');
    }
  }

  return (
    <section className="admin-bales">
      <div className="admin-items__head">
        <h1 className="admin-items__title">Balles</h1>
      </div>

      <div className="admin-panel admin-bale-create">
        <input
          className="filter-input"
          placeholder="Libellé (ex. Balle #1 – juin)"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        />
        <input
          className="filter-input"
          type="number"
          min={1}
          placeholder="Coût total (TND)"
          value={form.cost || ''}
          onChange={(e) => setForm((f) => ({ ...f, cost: e.target.valueAsNumber || 0 }))}
        />
        <button className="btn btn--add" onClick={create}>Créer la balle</button>
      </div>

      {error && <div className="checkout__error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Balle</th>
              <th>Coût</th>
              <th>Vendues</th>
              <th>Récupéré</th>
              <th>Gain net</th>
            </tr>
          </thead>
          <tbody>
            {bales.map((b) => (
              <tr key={b.id} className="admin-bale-row" onClick={() => nav(`/admin/bales/${b.id}`)}>
                <td>{b.label}</td>
                <td>{b.totalCost} TND</td>
                <td>{b.soldCount}/{b.itemCount}</td>
                <td>
                  <span className="admin-recoup">
                    <span className="admin-recoup__bar" style={{ width: `${b.recoupedPct}%` }} />
                    <span className="admin-recoup__val">{b.recoupedPct}%</span>
                  </span>
                </td>
                <td className={b.netGain >= 0 ? 'admin-gain-pos' : 'admin-gain-neg'}>{b.netGain} TND</td>
              </tr>
            ))}
            {bales.length === 0 && (
              <tr><td colSpan={5} className="admin-items__empty">Aucune balle pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
