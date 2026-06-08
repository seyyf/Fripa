import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhantomCrowd } from './usePhantomCrowd';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePhantomCrowd', () => {
  it('snatches a non-protected piece after the interval elapses', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        ids: ['a', 'b', 'c'],
        protectedId: 'a',
        minFloor: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0, // first candidate after removing protected 'a' = 'b'
      }),
    );
    expect(onSnatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSnatch).toHaveBeenCalledWith('b');
  });

  it('does not snatch when the floor is at the minimum size', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        ids: ['a'],
        protectedId: null,
        minFloor: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0,
      }),
    );
    vi.advanceTimersByTime(3000);
    expect(onSnatch).not.toHaveBeenCalled();
  });

  it('does nothing when paused', () => {
    const onSnatch = vi.fn();
    renderHook(() =>
      usePhantomCrowd({
        ids: ['a', 'b', 'c'],
        protectedId: null,
        minFloor: 1,
        minInterval: 1000,
        maxInterval: 1000,
        onSnatch,
        rng: () => 0,
        paused: true,
      }),
    );
    vi.advanceTimersByTime(3000);
    expect(onSnatch).not.toHaveBeenCalled();
  });
});
