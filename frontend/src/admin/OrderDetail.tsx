import { useState } from 'react';
import {
  adminApi,
  AdminAuthError,
  ORDER_STATUSES,
  type AdminOrder,
  type OrderPatch,
} from './adminApi';

interface Props {
  order: AdminOrder;
  onClose: () => void;
  onChanged: (order: AdminOrder) => void;
  onAuthError: () => void;
}

const statusKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function printSlip(o: AdminOrder) {
  const rows = o.lines
    .map((l) => `<tr><td>${l.title} <small>(${l.brand} · ${l.size})</small></td><td style="text-align:right">${l.price} TND</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.ref}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}h1{font-size:20px;margin:0}
  .muted{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:12px}
  td{padding:6px 0;border-bottom:1px solid #eee}.tot{font-weight:800;font-size:18px;margin-top:10px;display:flex;justify-content:space-between}
  .box{border:1px solid #ddd;border-radius:10px;padding:14px;margin-top:14px}</style></head>
  <body><h1>Fripa — Bon de livraison</h1><div class="muted">Réf ${o.ref} · ${dateFmt.format(new Date(o.createdAt))}</div>
  <div class="box"><strong>${o.customerName}</strong><br>${o.customerPhone}<br>${o.customerAddress}<br><span class="muted">${o.customerEmail}</span></div>
  <table>${rows}</table><div class="tot"><span>Total (à encaisser)</span><span>${o.total} TND</span></div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function OrderDetail({ order, onClose, onChanged, onAuthError }: Props) {
  const [form, setForm] = useState({
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    customerPhone: order.customerPhone,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty =
    form.customerName !== order.customerName ||
    form.customerEmail !== order.customerEmail ||
    form.customerAddress !== order.customerAddress ||
    form.customerPhone !== order.customerPhone;

  async function patch(p: OrderPatch, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.updateOrder(order.id, p);
      onChanged(updated);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthError();
      else setError(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }

  async function doReturn() {
    if (!window.confirm('Marquer la commande comme retournée et remettre les pièces en stock ?')) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.returnOrder(order.id);
      onChanged(updated);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthError();
      else setError(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <h2>Commande {order.ref}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="admin-form">
          <div className="admin-order-detail__top">
            <span className="admin-cell-sub">{dateFmt.format(new Date(order.createdAt))}</span>
            <span className={`admin-status admin-order-status--${statusKey(order.status)}`}>{order.status}</span>
          </div>

          <div className="admin-order-detail__controls">
            <label className="field">
              <span className="field__label">Statut</span>
              <select
                className="filter-input"
                value={order.status}
                disabled={busy}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button
              className={`admin-btn ${order.paid ? 'admin-btn--paid' : ''}`}
              disabled={busy}
              onClick={() => patch({ paid: !order.paid })}
            >
              {order.paid ? '✓ Encaissée' : 'Marquer encaissée'}
            </button>
          </div>

          <h3 className="admin-panel__title">Client</h3>
          <div className="admin-form__grid">
            <label className="field admin-form__wide">
              <span className="field__label">Nom</span>
              <input className="filter-input" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field__label">Téléphone</span>
              <input className="filter-input" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input className="filter-input" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} />
            </label>
            <label className="field admin-form__wide">
              <span className="field__label">Adresse</span>
              <input className="filter-input" value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} />
            </label>
          </div>
          {dirty && (
            <button className="admin-btn" disabled={busy} onClick={() => patch(form)}>
              Enregistrer les modifications client
            </button>
          )}

          <h3 className="admin-panel__title">Pièces</h3>
          <ul className="admin-order__lines">
            {order.lines.map((l) => (
              <li key={l.id} className="admin-order__line">
                <span className="admin-thumb admin-order__thumb" style={{ backgroundImage: `url(${l.imageUrl})` }} />
                <span className="admin-order__line-info">
                  <strong>{l.title}</strong>
                  <span className="admin-cell-sub">{l.brand} · {l.size}</span>
                </span>
                <span className="admin-price">{l.price} TND</span>
              </li>
            ))}
          </ul>
          <div className="admin-order__head" style={{ marginTop: 6 }}>
            <strong>Total {order.paid ? '(encaissé)' : '(à encaisser)'}</strong>
            <span className="admin-order__total">{order.total} TND</span>
          </div>

          {error && <div className="checkout__error">{error}</div>}

          <div className="admin-form__foot">
            <button className="admin-btn" disabled={busy} onClick={() => printSlip(order)}>🖨 Bon de livraison</button>
            <button className="admin-btn admin-btn--danger" disabled={busy} onClick={doReturn}>↩ Retour / restock</button>
          </div>
        </div>
      </div>
    </div>
  );
}
