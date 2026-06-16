import { describe, it, expect, beforeEach } from 'vitest';
import { bumpSwipe, setHasCart, takeSwipes, getHasCart } from './presenceState';

describe('presenceState', () => {
  beforeEach(() => {
    takeSwipes(); // drain
    setHasCart(false);
  });

  it('accumulates swipes and drains them on take', () => {
    bumpSwipe();
    bumpSwipe();
    expect(takeSwipes()).toBe(2);
    expect(takeSwipes()).toBe(0); // drained
  });

  it('tracks cart presence', () => {
    expect(getHasCart()).toBe(false);
    setHasCart(true);
    expect(getHasCart()).toBe(true);
  });
});
