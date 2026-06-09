import { useEffect, useState } from 'react';
import {
  adminApi,
  AdminAuthError,
  PROMO_TYPES,
  type AdminPromo,
  type PromoInput,
} from './adminApi';

interface Props {
  onAuthError: () => void;
}

const EMPTY: PromoInput = { code: '', type: 'percent', value: 10, minOrder: null, maxUses: null, active: true, expiresAt: null };

function PromoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AdminPromo | null;
  onSave: (input: PromoInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PromoInput>(
    initial
      ? {
          code: initial.code,
          type: initial.type,
          value: initial.value,
          minOrder: initial.minOrder,
          maxUses: initial.maxUses,
          active: initial.active,
          expiresAt: initial.expiresAt ? initial.expiresAt.slice(0, 10) : null,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PromoInput>(k: K, v: PromoInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const num = (s: string): number | null => (s === '' ? null : Number(s));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, value: Number(form.value) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <h2>{initial ? 'Modifier le code' : 'Nouveau code promo'}</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Fermer">✕</button>
        </header>
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form__grid">
            <label className="field">
              <span className="field__label">Code</span>
              <input className="filter-input" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="FRIPA10" />
            </label>
            <label className="field">
              <span className="field__label">Type</span>
              <select className="filter-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {PROMO_TYPES.map((t) => <option key={t} value={t}>{t === 'percent' ? 'Pourcentage (%)' : 'Montant fixe (TND)'}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Valeur {form.type === 'percent' ? '(%)' : '(TND)'}</span>
              <input className="filter-input" type="number" min={1} value={form.value} onChange={(e) => set('value', e.target.valueAsNumber || 0)} />
            </label>
            <label className="field">
              <span className="field__label">Min. panier (TND)</span>
              <input className="filter-input" type="number" min={0} value={form.minOrder ?? ''} placeholder="—" onChange={(e) => set('minOrder', num(e.target.value))} />
            </label>
            <label className="field">
              <span className="field__label">Usages max</span>
              <input className="filter-input" type="number" min={1} value={form.maxUses ?? ''} placeholder="illimité" onChange={(e) => set('maxUses', num(e.target.value))} />
            </label>
            <label className="field">
              <span className="field__label">Expire le</span>
              <input className="filter-input" type="date" value={form.expiresAt ?? ''} onChange={(e) => set('expiresAt', e.target.value || null)} />
            </label>
            <label className="field admin-promo-active">
              <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} />
              <span>Actif</span>
            </label>
          </div>
          {error && <div className="checkout__error">{error}</div>}
          <div className="admin-form__foot">
            <button type="button" className="btn btn--pass admin-form__cancel" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn btn--add" disabled={busy}>{busy ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminPromos({ onAuthError }: Props) {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; promo: AdminPromo } | null>(null);

  function handleError(err: unknown) {
    if (err instanceof AdminAuthError) onAuthError();
    else setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
  }

  async function refresh() {
    setLoading(true);
    try {
      setPromos(await adminApi.listPromos());
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(input: PromoInput) {
    if (editing?.mode === 'edit') await adminApi.updatePromo(editing.promo.id, input);
    else await adminApi.createPromo(input);
    setEditing(null);
    await refresh();
  }
  async function toggle(p: AdminPromo) {
    try {
      await adminApi.updatePromo(p.id, { active: !p.active });
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }
  async function remove(p: AdminPromo) {
    if (!window.confirm(`Supprimer le code « ${p.code} » ?`)) return;
    try {
      await adminApi.deletePromo(p.id);
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <section className="admin-items">
      <div className="admin-items__head">
        <div>
          <h1 className="admin-items__title">Codes promo</h1>
          <p className="admin-items__count">{promos.length} code{promos.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn--add" onClick={() => setEditing({ mode: 'create' })}>+ Nouveau code</button>
      </div>

      {error && <div className="checkout__error admin-items__error">{error}</div>}

      {loading ? (
        <p className="muted admin-items__empty">Chargement…</p>
      ) : promos.length === 0 ? (
        <p className="muted admin-items__empty">Aucun code promo.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Remise</th>
                <th>Conditions</th>
                <th>Usages</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const expired = p.expiresAt && new Date(p.expiresAt).getTime() < Date.now();
                return (
                  <tr key={p.id} className={!p.active || expired ? 'admin-row--dim' : ''}>
                    <td><strong className="admin-cell-title">{p.code}</strong></td>
                    <td className="admin-price">{p.type === 'percent' ? `${p.value}%` : `${p.value} TND`}</td>
                    <td className="admin-cell-sub">
                      {p.minOrder ? `min ${p.minOrder} TND` : '—'}
                      {p.expiresAt && ` · exp. ${p.expiresAt.slice(0, 10)}`}
                    </td>
                    <td>{p.uses}{p.maxUses != null ? ` / ${p.maxUses}` : ''}</td>
                    <td>
                      <button className={`admin-status ${p.active && !expired ? 'admin-status--active' : 'admin-status--archived'}`} onClick={() => toggle(p)}>
                        {expired ? 'expiré' : p.active ? 'actif' : 'inactif'}
                      </button>
                    </td>
                    <td className="admin-actions">
                      <button className="admin-btn" onClick={() => setEditing({ mode: 'edit', promo: p })}>Modifier</button>
                      <button className="admin-btn admin-btn--danger" onClick={() => remove(p)}>Suppr.</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PromoForm
          initial={editing.mode === 'edit' ? editing.promo : null}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  );
}
