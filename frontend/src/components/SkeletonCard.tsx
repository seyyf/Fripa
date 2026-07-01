// Loading placeholder shown in the deck while the first batch of pieces is
// still being fetched (or a filter change is reloading). Mirrors the swipe
// card's silhouette so the layout doesn't jump when real cards arrive. The
// shimmer is pure CSS and is disabled under prefers-reduced-motion.
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card__image sk-shimmer" />
      <div className="skeleton-card__body">
        <div className="skeleton-card__row">
          <span className="sk-shimmer sk-line sk-line--title" />
          <span className="sk-shimmer sk-line sk-line--brand" />
        </div>
        <span className="sk-shimmer sk-line sk-line--desc" />
        <span className="sk-shimmer sk-line sk-line--desc sk-line--short" />
        <div className="skeleton-card__chips">
          <span className="sk-shimmer sk-chip" />
          <span className="sk-shimmer sk-chip" />
          <span className="sk-shimmer sk-chip" />
        </div>
      </div>
      <div className="skeleton-card__actions">
        <span className="sk-shimmer sk-dot" />
        <span className="sk-shimmer sk-dot" />
        <span className="sk-shimmer sk-dot" />
      </div>
    </div>
  );
}
