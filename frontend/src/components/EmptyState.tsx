import { useT } from '../i18n/LanguageContext';

interface Props {
  onStockRefresh: () => void;
  onHardReset: () => void;
  onOpenCart: () => void;
  cartCount: number;
}

export function EmptyState({ onStockRefresh, onHardReset, onOpenCart, cartCount }: Props) {
  const { t } = useT();
  return (
    <div className="empty">
      <div className="empty__emoji">🪙</div>
      <h2>{t('empty.title')}</h2>
      <p>{t('empty.text')}</p>
      <div className="empty__actions">
        {cartCount > 0 && (
          <button className="btn btn--add" onClick={onOpenCart}>
            {t('empty.cart', { n: cartCount })}
          </button>
        )}
        <button className="btn btn--add btn--wide" onClick={onStockRefresh}>
          {t('empty.more')}
        </button>
        <button className="btn btn--pass btn--ghost" onClick={onHardReset}>
          {t('empty.restart')}
        </button>
      </div>
    </div>
  );
}
