import { useEffect, useState } from 'react';
import {
  adminApi,
  CATEGORIES,
  CONDITIONS,
  SIZES,
  STATUSES,
  type AdminItem,
  type BaleSummary,
  type ItemInput,
} from './adminApi';

interface Props {
  initial: AdminItem | null; // data to prefill (null → blank create)
  isEdit?: boolean; // true = updating an existing piece; false = create (incl. clone)
  onSave: (input: ItemInput) => Promise<void>;
  onCancel: () => void;
}

const parseImages = (raw?: string | null): string[] => {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((u) => typeof u === 'string') : [];
  } catch {
    return [];
  }
};

// ISO timestamp → value for a datetime-local input (local time, minute precision).
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY: ItemInput = {
  title: '',
  description: '',
  imageUrl: '',
  images: [],
  price: 0,
  cost: 0,
  salePrice: null,
  size: 'M',
  brand: '',
  condition: 'Bon état',
  color: '',
  seller: '',
  category: 'T-shirts',
  status: 'active',
  baleId: null,
};

export function ItemForm({ initial, isEdit = false, onSave, onCancel }: Props) {
  const [form, setForm] = useState<ItemInput>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          imageUrl: initial.imageUrl,
          images: parseImages(initial.images),
          price: initial.price,
          cost: initial.cost ?? 0,
          salePrice: initial.salePrice ?? null,
          size: initial.size,
          brand: initial.brand,
          condition: initial.condition,
          color: initial.color,
          seller: initial.seller,
          category: initial.category,
          status: initial.status,
          baleId: initial.baleId ?? null,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  // Drop scheduling (kept as the datetime-local string; converted on submit).
  const [publishLocal, setPublishLocal] = useState(() => toLocalInput(initial?.publishAt));
  const images = form.images ?? [];

  // Bale assignment (the piece's wholesale lot) + inline "new bale" creation.
  const [bales, setBales] = useState<BaleSummary[]>([]);
  const [newBale, setNewBale] = useState<{ open: boolean; label: string; cost: number }>({
    open: false,
    label: '',
    cost: 0,
  });
  useEffect(() => {
    let alive = true;
    adminApi.listBales().then((b) => alive && setBales(b)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function createBaleInline() {
    if (!newBale.label.trim() || newBale.cost <= 0) return;
    const { id } = await adminApi.createBale({
      label: newBale.label.trim(),
      totalCost: Math.round(newBale.cost),
    });
    setBales(await adminApi.listBales());
    set('baleId', id);
    setNewBale({ open: false, label: '', cost: 0 });
  }

  function set<K extends keyof ItemInput>(key: K, value: ItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  const removeImage = (i: number) => set('images', images.filter((_, idx) => idx !== i));
  // Reorder a gallery photo one step left/right (the order shoppers swipe through).
  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    set('images', next);
  };
  // Promote a gallery photo to cover; the old cover slides into its slot.
  const makeCover = (i: number) => {
    const next = [...images];
    const promoted = next[i];
    next[i] = form.imageUrl;
    setForm((f) => ({ ...f, imageUrl: promoted, images: next.filter(Boolean) }));
  };

  async function onPickExtra(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploadingExtra(true);
    setError(null);
    try {
      // Sequential uploads keep the picked order in the gallery.
      const urls: string[] = [];
      for (const file of files) {
        const { url } = await adminApi.uploadImage(file);
        urls.push(url);
      }
      setForm((f) => ({ ...f, images: [...(f.images ?? []), ...urls] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du téléversement.');
    } finally {
      setUploadingExtra(false);
    }
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
        cost: Number(form.cost ?? 0),
        salePrice: form.salePrice == null ? null : Number(form.salePrice),
        publishAt: publishLocal ? new Date(publishLocal).toISOString() : null,
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
              <span className="field__label">Coût d'achat (TND)</span>
              <input
                className="filter-input"
                type="number"
                min={0}
                value={form.cost ?? 0}
                placeholder="souk"
                onChange={(e) => set('cost', e.target.valueAsNumber || 0)}
              />
              {Number(form.cost) > 0 && Number(form.price) > 0 && (
                <span className="muted">
                  Marge : {Number(form.price) - Number(form.cost)} TND (
                  {Math.round(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100)}
                  %)
                </span>
              )}
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
              <span className="field__label">Balle</span>
              <select
                className="filter-input"
                value={form.baleId ?? ''}
                onChange={(e) => set('baleId', e.target.value || null)}
              >
                <option value="">— Aucune —</option>
                {bales.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              {!newBale.open ? (
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={() => setNewBale((n) => ({ ...n, open: true }))}
                >
                  + Nouvelle balle
                </button>
              ) : (
                <div className="admin-inline-bale">
                  <input
                    className="filter-input"
                    placeholder="Libellé (ex. Balle #1)"
                    value={newBale.label}
                    onChange={(e) => setNewBale((n) => ({ ...n, label: e.target.value }))}
                  />
                  <input
                    className="filter-input"
                    type="number"
                    min={1}
                    placeholder="Coût total (TND)"
                    value={newBale.cost || ''}
                    onChange={(e) => setNewBale((n) => ({ ...n, cost: e.target.valueAsNumber || 0 }))}
                  />
                  <button type="button" className="admin-btn" onClick={createBaleInline}>Créer</button>
                </div>
              )}
              {form.baleId && (
                <span className="muted">Le coût d'achat est calculé automatiquement (coût balle ÷ nb pièces).</span>
              )}
            </label>

            <label className="field">
              <span className="field__label">🔥 Drop programmé</span>
              <input
                className="filter-input"
                type="datetime-local"
                value={publishLocal}
                onChange={(e) => setPublishLocal(e.target.value)}
              />
              {publishLocal && form.status !== 'draft' && (
                <span className="field__error">
                  Passe le statut en « draft » — la pièce s'activera toute seule à cette date.
                </span>
              )}
              {publishLocal && form.status === 'draft' && (
                <span className="muted">S'activera automatiquement (compte à rebours côté boutique).</span>
              )}
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
                  placeholder="…ou colle une URL (photo principale)"
                />
              </div>
            </div>

            <div className="field admin-form__wide">
              <span className="field__label">
                Photos supplémentaires{images.length > 0 ? ` (${images.length})` : ''}
              </span>
              <div className="admin-gallery">
                {images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="admin-gallery__thumb"
                    style={{ backgroundImage: `url(${url})` }}
                  >
                    <button type="button" onClick={() => removeImage(i)} aria-label="Retirer">
                      ×
                    </button>
                    <div className="admin-gallery__tools">
                      <button
                        type="button"
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        aria-label="Avancer la photo"
                        title="Avancer"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => makeCover(i)}
                        aria-label="Utiliser comme couverture"
                        title="Utiliser comme couverture"
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, 1)}
                        disabled={i === images.length - 1}
                        aria-label="Reculer la photo"
                        title="Reculer"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
                <label className={`admin-gallery__add ${uploadingExtra ? 'is-busy' : ''}`}>
                  {uploadingExtra ? '…' : '+'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    disabled={uploadingExtra}
                    onChange={onPickExtra}
                  />
                </label>
              </div>
              <span className="muted admin-gallery__hint">
                ‹ › pour ordonner le carrousel · ★ pour passer en photo principale · sélection
                multiple possible.
              </span>
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
