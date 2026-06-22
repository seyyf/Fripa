import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, AdminAuthError, type BaleDetail } from './adminApi';

interface Props {
  onAuthError: () => void;
}

const tnd = (n: number) => `${n} TND`;

export function AdminBaleDetail({ onAuthError }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [bale, setBale] = useState<BaleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    adminApi
      .getBale(id)
      .then((b) => alive && setBale(b))
      .catch((e) => {
        if (e instanceof AdminAuthError) return onAuthError();
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      });
    return () => {
      alive = false;
    };
  }, [id, onAuthError]);

  async function del() {
    if (!id || !window.confirm('Supprimer cette balle ? Les pièces seront détachées.')) return;
    await adminApi.deleteBale(id);
    nav('/admin/bales');
  }

  if (error) return <div className="admin__error">{error}</div>;
  if (!bale) return <div className="admin-boot">Chargement…</div>;

  return (
    <section className="admin-bale-detail">
      <div className="admin-items__head">
        <h1 className="admin-items__title">{bale.label}</h1>
        <div className="admin-items__head-actions">
          <button className="admin-btn" onClick={() => nav('/admin/bales')}>← Balles</button>
          <button className="admin-btn admin-btn--danger" onClick={del}>Supprimer</button>
        </div>
      </div>

      <div className="admin-panel admin-pnl">
        <div className="admin-pnl__row"><span>Coût de la balle</span><strong>{tnd(bale.totalCost)}</strong></div>
        <div className="admin-pnl__row"><span>Revenu réalisé ({bale.soldCount}/{bale.itemCount} vendues)</span><strong>{tnd(bale.realizedRevenue)}</strong></div>
        <div className="admin-pnl__row"><span>Coût des pièces vendues</span><span>−{tnd(bale.costOfSold)}</span></div>
        <div className="admin-pnl__row admin-pnl__sub"><span>Gain brut</span><strong>{tnd(bale.grossGain)}</strong></div>
        <div className="admin-pnl__row"><span>Promos / parrainage</span><span>−{tnd(bale.discounts)}</span></div>
        <div className="admin-pnl__row"><span>Livraisons offertes ({bale.freeDelivery.count}) <em>estimé</em></span><span>−{tnd(bale.freeDelivery.estimated)}</span></div>
        <div className={`admin-pnl__row admin-pnl__net ${bale.netGain >= 0 ? 'admin-gain-pos' : 'admin-gain-neg'}`}>
          <span>Gain net</span><strong>{tnd(bale.netGain)}</strong>
        </div>
      </div>

      <div className="admin-panel">
        <h3 className="admin-panel__title">Récupération</h3>
        <div className="admin-recoup admin-recoup--lg">
          <span className="admin-recoup__bar" style={{ width: `${bale.recoupedPct}%` }} />
          <span className="admin-recoup__val">{bale.recoupedPct}%</span>
        </div>
        <p className="muted">
          {bale.remainingCount} pièce(s) en stock · coût restant {tnd(bale.remainingCost)} · potentiel {tnd(bale.potentialRevenue)}.
          Les coûts par pièce sont la moyenne de la balle.
        </p>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Pièce</th><th>Statut</th><th>Coût</th><th>Vendue à</th></tr></thead>
          <tbody>
            {bale.members.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.status}</td>
                <td>{tnd(m.cost)}</td>
                <td>{m.soldPrice != null ? tnd(m.soldPrice) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
