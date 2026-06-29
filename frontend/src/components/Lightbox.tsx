import { useEffect, useState } from 'react';
import { useT } from '../i18n/LanguageContext';

interface Props {
  images: string[];
  alt: string;
  initialIndex?: number;
  onClose: () => void;
}

// Full-screen photo viewer: tap backdrop / ✕ / Esc to close, ‹ › or arrow keys
// to flip through angles. Shared by the product detail page and the cart.
export function Lightbox({ images, alt, initialIndex = 0, onClose }: Props) {
  const { t } = useT();
  const photos = images.filter(Boolean);
  const many = photos.length > 1;
  const [sel, setSel] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(0, photos.length - 1)),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') setSel((s) => (s - 1 + photos.length) % photos.length);
      else if (many && e.key === 'ArrowRight') setSel((s) => (s + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, photos.length, onClose]);

  if (photos.length === 0) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox__close" aria-label={t('common.close')} onClick={onClose}>
        ✕
      </button>
      {many && (
        <button
          className="lightbox__nav lightbox__nav--prev"
          aria-label={t('pd.prev')}
          onClick={(e) => {
            e.stopPropagation();
            setSel((s) => (s - 1 + photos.length) % photos.length);
          }}
        >
          ‹
        </button>
      )}
      <img
        className="lightbox__img"
        src={photos[sel]}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
      {many && (
        <button
          className="lightbox__nav lightbox__nav--next"
          aria-label={t('pd.next')}
          onClick={(e) => {
            e.stopPropagation();
            setSel((s) => (s + 1) % photos.length);
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}
