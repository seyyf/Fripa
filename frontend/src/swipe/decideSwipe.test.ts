import { describe, it, expect } from 'vitest';
import { decideSwipe } from './decideSwipe';

const T = { right: 120, left: 120, up: 120 };

describe('decideSwipe', () => {
  it('returns null for movement below every threshold', () => {
    expect(decideSwipe({ x: 40, y: -30 }, T)).toBeNull();
  });

  it('commits keep when dragged right past the threshold', () => {
    expect(decideSwipe({ x: 160, y: 10 }, T)).toBe('keep');
  });

  it('commits pass when dragged left past the threshold', () => {
    expect(decideSwipe({ x: -160, y: 10 }, T)).toBe('pass');
  });

  it('commits favorite when dragged up past the threshold (vertical dominant)', () => {
    expect(decideSwipe({ x: 20, y: -160 }, T)).toBe('favorite');
  });

  it('prefers horizontal when an up-right drag is mostly horizontal', () => {
    expect(decideSwipe({ x: 200, y: -130 }, T)).toBe('keep');
  });

  it('never favorites a downward drag', () => {
    expect(decideSwipe({ x: 10, y: 200 }, T)).toBeNull();
  });
});
