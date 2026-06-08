import { useState } from 'react';
import {
  adminApi,
  CATEGORIES,
  CONDITIONS,
  SIZES,
  STATUSES,
  type AdminItem,
  type ItemInput,
} from './adminApi';

interface Props {
  initial: AdminItem | null; // data to prefill (null → blank create)
  isEdit?: boolean; // true = updating an existing piece; false = create (incl. clone)
  onSave: (input: ItemInput) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: ItemInput = {
  title: '',
  description: '',
  imageUrl: '',
  price: 0,
  salePrice: null,
  size: 'M',
  brand: '',
  condition: 'Bon état',
  color: '',
  seller: '',
  category: 'T-shirts',
  status: 'active',
};

export function ItemForm({ initial, isEdit = false, onSave, onCancel }: Props) {
  const [form, setForm] = useState<ItemInput>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          imageUrl: initial.imageUrl,
          price: initial.price,
          salePrice: initial.salePrice ?? null,
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
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof ItemInput>(key: K, value: ItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      set('imageUrl', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du téléversement.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSave({
        ...form,
        price: Number(form.price),
        salePrice: form.salePrice == null ? null : Number(form.salePrice),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <h2>{isEdit ? 'Modifier la pièce' : 'Nouvelle pièce'}</h2>
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
              <span className="field__label">Prix soldé (TND)</span>
              <input
                className="filter-input"
                type="number"
                min={0}
                value={form.salePrice ?? ''}
                placeholder="— (aucune solde)"
                onChange={(e) =>
                  set('salePrice', e.target.value === '' ? null : e.target.valueAsNumber || 0)
                }
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

            <div className="field admin-form__wide">
              <span className="field__label">Image</span>
              <div className="admin-form__upload">
                <label className={`admin-btn admin-upload-btn ${uploading ? 'is-busy' : ''}`}>
                  {uploading ? 'Téléversement…' : '⤓ Téléverser'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploading}
                    onChange={onPickFile}
                  />
                </label>
                <input
                  className="filter-input"
                  value={form.imageUrl}
                  onChange={(e) => set('imageUrl', e.target.value)}
                  placeholder="…ou colle une URL https://"
                />
              </div>
            </div>

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
              {busy ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la pièce'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
