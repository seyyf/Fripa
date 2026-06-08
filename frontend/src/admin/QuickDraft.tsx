import { useState } from 'react';
import { adminApi, CATEGORIES, type ItemInput } from './adminApi';

interface Props {
  onSaved: () => void;
  onCancel: () => void;
}

// Fast intake: photo + title + price + category → a `draft` piece with sensible
// placeholders to polish later. Matches how a fripier receives stock.
export function QuickDraft({ onSaved, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState<string>('T-shirts');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      setImageUrl(url);
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
      const input: ItemInput = {
        title: title.trim() || 'Brouillon',
        description: '—',
        imageUrl: imageUrl || 'https://picsum.photos/seed/fripa-draft/600/800',
        price: Math.max(0, Math.round(Number(price) || 0)),
        salePrice: null,
        size: 'M',
        brand: '—',
        condition: 'Bon état',
        color: '—',
        seller: '—',
        category,
        status: 'draft',
      };
      await adminApi.createItem(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <h2>Brouillon rapide</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Fermer">✕</button>
        </header>
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form__quickdraft">
            <label className={`admin-draft-photo ${uploading ? 'is-busy' : ''}`}>
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <span>{uploading ? 'Téléversement…' : '⤓ Photo'}</span>
              )}
              <input type="file" accept="image/*" hidden disabled={uploading} onChange={onPickFile} />
            </label>
            <div className="admin-form__quickdraft-fields">
              <label className="field">
                <span className="field__label">Titre</span>
                <input className="filter-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span className="field__label">Prix (TND)</span>
                <input className="filter-input" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.valueAsNumber || 0)} />
              </label>
              <label className="field">
                <span className="field__label">Catégorie</span>
                <select className="filter-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </div>
          <p className="muted">Créé en brouillon — complète les détails plus tard depuis « Modifier ».</p>
          {error && <div className="checkout__error">{error}</div>}
          <div className="admin-form__foot">
            <button type="button" className="btn btn--pass admin-form__cancel" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn btn--add" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Créer le brouillon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
