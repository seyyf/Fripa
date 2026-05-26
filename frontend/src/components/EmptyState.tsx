interface Props {
  onReset: () => void;
  onOpenCart: () => void;
  cartCount: number;
}

export function EmptyState({ onReset, onOpenCart, cartCount }: Props) {
  return (
    <div className="empty">
      <div className="empty__emoji">🪙</div>
      <h2>C'est fini pour aujourd'hui.</h2>
      <p>
        Tu as parcouru toute la fripa. Les pièces que tu n'as pas prises sont
        peut-être déjà parties chez quelqu'un d'autre.
      </p>
      <div className="empty__actions">
        {cartCount > 0 && (
          <button className="btn btn--add" onClick={onOpenCart}>
            Voir mon panier ({cartCount})
          </button>
        )}
        <button className="btn btn--pass btn--wide" onClick={onReset}>
          Recommencer la session
        </button>
      </div>
    </div>
  );
}
