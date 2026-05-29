// Pure swipe-decision logic for a draggable card. Given the drag offset and
// per-direction thresholds, returns the committed action — or null to spring
// back. Kept pure so the threshold behaviour is unit-testable without
// simulating framer-motion pointer drags.
export type SwipeAction = 'keep' | 'pass' | 'favorite';

export interface SwipeThresholds {
  right: number; // drag-right distance committing "keep"
  left: number; // drag-left distance committing "pass"
  up: number; // drag-up distance committing "favorite"
}

export function decideSwipe(
  offset: { x: number; y: number },
  t: SwipeThresholds,
): SwipeAction | null {
  const ax = Math.abs(offset.x);
  const ay = Math.abs(offset.y);

  // Upward, vertically-dominant drag → favorite.
  if (offset.y < 0 && ay >= t.up && ay >= ax) return 'favorite';

  // Otherwise resolve horizontally.
  if (offset.x >= t.right) return 'keep';
  if (offset.x <= -t.left) return 'pass';

  return null;
}
