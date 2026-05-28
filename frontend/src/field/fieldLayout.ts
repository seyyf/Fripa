import type { FieldItem } from '../types';

export const X_MIN = 6;
export const X_MAX = 82;
export const Y_MIN = 6;
export const Y_MAX = 80;

export interface Placement {
  xPct: number;
  yPct: number;
  scale: number;
  driftSeed: number;
}

// A box instance living in the field. `boxKey` is unique per mount so framer
// AnimatePresence keeps a leaving box stable even if the same item recycles.
export interface FieldBox extends Placement {
  boxKey: string;
  item: FieldItem;
}

function between(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

export function placeBox(rng: () => number = Math.random): Placement {
  return {
    xPct: between(X_MIN, X_MAX, rng),
    yPct: between(Y_MIN, Y_MAX, rng),
    scale: between(0.85, 1.15, rng),
    driftSeed: rng() * Math.PI * 2,
  };
}

let counter = 0;
export function makeBox(item: FieldItem, rng: () => number = Math.random): FieldBox {
  counter += 1;
  return { boxKey: `${item.id}-${counter}`, item, ...placeBox(rng) };
}
