import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhantomCrowd } from './usePhantomCrowd';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePhantomCrowd', () => {
  it('snatches a non-focused box after the interval elapses', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        boxKeys: ['a', 'b', 'c'],
        focusedKey: 'a',
        minFieldSize: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0, // first candidate after removing focused 'a' = 'b'
      }),
    );
    expect(onSnatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSnatch).toHaveBeenCalledWith('b');
  });

  it('does not snatch when the field is at the minimum size', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        boxKeys: ['a'],
        focusedKey: null,
        minFieldSize: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0,
      }),
    );
    vi.advanceTimersByTime(3000);
    expect(onSnatch).not.toHaveBeenCalled();
  });
});
