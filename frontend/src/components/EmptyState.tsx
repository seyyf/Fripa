interface Props {
  onStockRefresh: () => void;
  onHardReset: () => void;
  onOpenCart: () => void;
  cartCount: number;
}

export function EmptyState({ onStockRefresh, onHardReset, onOpenCart, cartCount }: Props) {
  return (
    <div className="empty">
      <div className="empty__emoji">🪙</div>
      <h2>Tu as tout vu.</h2>
      <p>
        Toute la fripa est passée devant tes yeux. On peut rouvrir le rayon —
        ton panier reste comme tu l'as laissé.
      </p>
      <div className="empty__actions">
        {cartCount > 0 && (
          <button className="btn btn--add" onClick={onOpenCart}>
            Voir mon panier ({cartCount})
          </button>
        )}
        <button className="btn btn--add btn--wide" onClick={onStockRefresh}>
          ✨ Voir d'autres pièces
        </button>
        <button className="btn btn--pass btn--ghost" onClick={onHardReset}>
          Tout recommencer (vide le panier)
        </button>
      </div>
    </div>
  );
}
