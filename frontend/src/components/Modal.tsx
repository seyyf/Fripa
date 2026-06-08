import { useEffect, type ReactNode } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
  label?: string;
}

// Centered popup with a backdrop. Closes on Escape, backdrop click, or the X.
// Locks body scroll while open.
export function Modal({ onClose, children, label }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
