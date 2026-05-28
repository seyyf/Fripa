import { describe, it, expect } from 'vitest';
import { placeBox, X_MIN, X_MAX, Y_MIN, Y_MAX } from './fieldLayout';

describe('placeBox', () => {
  it('keeps positions inside the field margins', () => {
    for (let i = 0; i < 50; i++) {
      const p = placeBox(Math.random);
      expect(p.xPct).toBeGreaterThanOrEqual(X_MIN);
      expect(p.xPct).toBeLessThanOrEqual(X_MAX);
      expect(p.yPct).toBeGreaterThanOrEqual(Y_MIN);
      expect(p.yPct).toBeLessThanOrEqual(Y_MAX);
    }
  });

  it('produces a scale within the configured band', () => {
    const p = placeBox(() => 0.5);
    expect(p.scale).toBeGreaterThanOrEqual(0.85);
    expect(p.scale).toBeLessThanOrEqual(1.15);
  });
});
