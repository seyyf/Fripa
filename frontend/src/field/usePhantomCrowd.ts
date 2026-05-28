import { useEffect, useRef } from 'react';
import { pickSnatchTarget } from './pickSnatchTarget';

export interface PhantomCrowdOptions {
  boxKeys: string[];
  focusedKey: string | null;
  minFieldSize: number;
  minInterval: number;
  maxInterval: number;
  onSnatch: (boxKey: string) => void;
  rng?: () => number;
}

// Drives the "other shoppers" pressure: on a randomised interval it grabs one
// un-focused box and reports it via onSnatch. Reads live state through refs so
// the running timer always sees the current field without resetting.
export function usePhantomCrowd(opts: PhantomCrowdOptions): void {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const o = ref.current;
      const rng = o.rng ?? Math.random;
      const target = pickSnatchTarget(o.boxKeys, o.focusedKey, o.minFieldSize, rng);
      if (target) o.onSnatch(target);
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
