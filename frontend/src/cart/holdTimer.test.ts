import { describe, it, expect } from 'vitest';
import { holdState, formatHold, WARN_MS } from './holdTimer';

describe('holdState', () => {
  it('is active with plenty of time left', () => {
    const r = holdState(10_000, 0 + (10_000 - WARN_MS - 1000));
    // remaining > WARN_MS
    expect(r.phase).toBe('active');
    expect(r.remainingMs).toBeGreaterThan(WARN_MS);
  });

  it('is warning within the last minute', () => {
    const now = 0;
    const r = holdState(now + 30_000, now); // 30s left
    expect(r.phase).toBe('warning');
  });

  it('is expired once the deadline passes', () => {
    const r = holdState(1000, 1000);
    expect(r.phase).toBe('expired');
    expect(r.remainingMs).toBe(0);
  });
});

describe('formatHold', () => {
  it('formats minutes and seconds', () => {
    expect(formatHold(125_000)).toBe('2:05');
    expect(formatHold(5_000)).toBe('0:05');
  });
  it('never goes negative', () => {
    expect(formatHold(0)).toBe('0:00');
    expect(formatHold(-3000)).toBe('0:00');
  });
});
