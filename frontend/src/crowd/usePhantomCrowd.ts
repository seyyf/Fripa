import { useEffect, useRef } from 'react';
import { pickSnatchTarget } from './pickSnatchTarget';

export interface PhantomCrowdOptions {
  ids: string[];
  protectedId: string | null;
  minFloor: number;
  minInterval: number;
  maxInterval: number;
  onSnatch: (id: string) => void;
  rng?: () => number;
  paused?: boolean;
}

// Drives the "other shoppers" pressure on the catalogue floor: on a randomised
// interval it grabs one un-protected piece and reports it via onSnatch. Reads
// live state through a ref so the running timer always sees the current floor
// without resetting on every change.
export function usePhantomCrowd(opts: PhantomCrowdOptions): void {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const o = ref.current;
      if (!o.paused) {
        const rng = o.rng ?? Math.random;
        const target = pickSnatchTarget(o.ids, o.protectedId, o.minFloor, rng);
        if (target) o.onSnatch(target);
      }
      schedule();
    };

    const schedule = () => {
      const o = ref.current;
      const span = Math.max(0, o.maxInterval - o.minInterval);
      const delay = o.minInterval + (o.rng ?? Math.random)() * span;
      timer = setTimeout(tick, delay);
    };

    schedule();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
