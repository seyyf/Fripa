import { useEffect, useState } from 'react';
import { adminApi, AdminAuthError, type LivePresence, type VisitorHistoryPoint } from './adminApi';

const ADMIN_POLL_MS = 5_000;

interface Props {
  onAuthError: () => void;
}

export function AdminLive({ onAuthError }: Props) {
  const [live, setLive] = useState<LivePresence | null>(null);
  const [history, setHistory] = useState<VisitorHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const snap = await adminApi.presence();
        if (alive) setLive(snap);
      } catch (e) {
        if (e instanceof AdminAuthError) return onAuthError();
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      }
    };
    tick();
    const timer = window.setInterval(tick, ADMIN_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [onAuthError]);

  useEffect(() => {
    let alive = true;
    adminApi
      .presenceHistory(48)
      .then((h) => alive && setHistory(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="admin__error">{error}</div>;
  if (!live) return <div className="admin-boot">Chargement…</div>;

  const maxGov = Math.max(1, ...live.byGovernorate.map((g) => g.count));
  const maxHist = Math.max(1, ...history.map((h) => h.peakOnline));

  return (
    <div className="admin-live">
      <div className="admin-live__hero">
        <div className="admin-live__online">
          <span className="admin-live__dot" aria-hidden />
          <strong>{live.online}</strong>
          <span>en ligne maintenant</span>
        </div>
        <div className="admin-live__kpis">
          <div className="admin-live__kpi">
            <strong>{live.activeCarts}</strong>
            <span>paniers actifs</span>
          </div>
          <div className="admin-live__kpi">
            <strong>{live.swipeRatePerMin}</strong>
            <span>swipes / min</span>
          </div>
        </div>
      </div>

      <div className="admin-live__cols">
        <section className="admin-panel">
          <h3 className="admin-panel__title">Par gouvernorat</h3>
          {live.byGovernorate.length === 0 && <p className="admin-muted">Aucun visiteur.</p>}
          <ul className="admin-live__bars">
            {live.byGovernorate.map((g) => (
              <li key={g.name}>
                <span className="admin-live__bar-label">{g.name}</span>
                <span className="admin-live__bar-track">
                  <span className="admin-live__bar-fill" style={{ width: `${(g.count / maxGov) * 100}%` }} />
                </span>
                <span className="admin-live__bar-val">{g.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-panel">
          <h3 className="admin-panel__title">Pièces regardées</h3>
          {live.topPieces.length === 0 && <p className="admin-muted">Personne sur une pièce.</p>}
          <ul className="admin-live__pieces">
            {live.topPieces.map((p) => (
              <li key={p.pieceId}>
                <span>{p.title}</span>
                <span className="admin-live__count">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-panel">
        <h3 className="admin-panel__title">Trafic (48 h)</h3>
        {history.length === 0 && <p className="admin-muted">Pas encore d'historique.</p>}
        <div className="admin-live__hist">
          {history.map((h) => (
            <span
              key={h.hour}
              className="admin-live__hist-bar"
              style={{ height: `${(h.peakOnline / maxHist) * 100}%` }}
              title={`${new Date(h.hour).toLocaleString('fr-FR')} — pic ${h.peakOnline}, moy ${h.avgOnline}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
