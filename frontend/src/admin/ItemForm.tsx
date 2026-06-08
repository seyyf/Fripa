import { useState } from 'react';
import {
  CATEGORIES,
  CONDITIONS,
  SIZES,
  STATUSES,
  type AdminItem,
  type ItemInput,
} from './adminApi';

interface Props {
  initial: AdminItem | null; // null → create
  onSave: (input: ItemInput) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: ItemInput = {
  title: '',
  description: '',
  imageUrl: '',
  price: 0,
  size: 'M',
  brand: '',
  condition: 'Bon état',
  color: '',
  seller: '',
  category: 'T-shirts',
  status: 'active',
};

export function ItemForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<ItemInput>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          imageUrl: initial.imageUrl,
          price: initial.price,
          size: initial.size,
          brand: initial.brand,
          condition: initial.condition,
          color: initial.color,
          seller: initial.seller,
          category: initial.category,
          status: initial.status,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof ItemInput>(key: K, value: ItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSave({ ...form, price: Number(form.price) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <h2>{initial ? 'Modifier la pièce' : 'Nouvelle pièce'}</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </header>

        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form__grid">
            <label className="field admin-form__wide">
              <span className="field__label">Titre</span>
              <input className="filter-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </label>

            <label className="field">
              <span className="field__label">Marque</span>
              <input className="filter-input" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </label>

            <label className="field">
              <span className="field__label">Prix (TND)</span>
              <input
                className="filter-input"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set('price', e.target.valueAsNumber || 0)}
              />
            </label>

            <label className="field">
              <span className="field__label">Taille</span>
              <select className="filter-input" value={form.size} onChange={(e) => set('size', e.target.value)}>
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">État</span>
              <select className="filter-input" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Catégorie</span>
              <select className="filter-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Statut</span>
              <select className="filter-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Couleur</span>
              <input className="filter-input" value={form.color} onChange={(e) => set('color', e.target.value)} />
            </label>

            <label className="field">
              <span className="field__label">Vendeur / souk</span>
              <input className="filter-input" value={form.seller} onChange={(e) => set('seller', e.target.value)} />
            </label>

            <label className="field admin-form__wide">
              <span className="field__label">URL de l’image</span>
              <input className="filter-input" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
            </label>

            <label className="field admin-form__wide">
              <span className="field__label">Description</span>
              <textarea
                className="filter-input admin-form__textarea"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
              />
            </label>
          </div>

          {form.imageUrl && (
            <div className="admin-form__preview">
              <span className="field__label">Aperçu</span>
              <img src={form.imageUrl} alt="" />
            </div>
          )}

          {error && <div className="checkout__error">{error}</div>}

          <div className="admin-form__foot">
            <button type="button" className="btn btn--pass admin-form__cancel" onClick={onCancel}>
              Annuler
            </button>
            <button type="submit" className="btn btn--add" disabled={busy}>
              {busy ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer la pièce'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
