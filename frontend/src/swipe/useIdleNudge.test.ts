import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useIdleNudge, IDLE_MS, MAX_REPLAYS } from './useIdleNudge';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  // ensure the visibility flag is reset between tests
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('useIdleNudge', () => {
  it('fires onNudge after the idle window when active and not swiped', () => {
    const onNudge = vi.fn();
    renderHook(() => useIdleNudge({ active: true, hasSwiped: false, onNudge }));
    expect(onNudge).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(IDLE_MS));
    expect(onNudge).toHaveBeenCalledTimes(1);
  });

  it('never fires once the user has swiped', () => {
    const onNudge = vi.fn();
    renderHook(() => useIdleNudge({ active: true, hasSwiped: true, onNudge }));
    act(() => vi.advanceTimersByTime(IDLE_MS * 5));
    expect(onNudge).not.toHaveBeenCalled();
  });

  it('does not fire while inactive (overlay / reduced-motion / demo running)', () => {
    const onNudge = vi.fn();
    renderHook(() => useIdleNudge({ active: false, hasSwiped: false, onNudge }));
    act(() => vi.advanceTimersByTime(IDLE_MS * 3));
    expect(onNudge).not.toHaveBeenCalled();
  });

  it('caps at MAX_REPLAYS across idle windows', () => {
    const onNudge = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useIdleNudge({ active, hasSwiped: false, onNudge }),
      { initialProps: { active: true } },
    );
    // window 1 -> replay
    act(() => vi.advanceTimersByTime(IDLE_MS));
    // demo plays (active false) then ends (active true) -> re-arm
    rerender({ active: false });
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(IDLE_MS)); // replay 2
    rerender({ active: false });
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(IDLE_MS)); // capped -> no replay 3
    expect(onNudge).toHaveBeenCalledTimes(MAX_REPLAYS);
  });

  it('noteInteraction resets the idle timer', () => {
    const onNudge = vi.fn();
    const { result } = renderHook(() => useIdleNudge({ active: true, hasSwiped: false, onNudge }));
    act(() => vi.advanceTimersByTime(IDLE_MS - 1000));
    act(() => result.current.noteInteraction());
    act(() => vi.advanceTimersByTime(1000)); // would have fired without the reset
    expect(onNudge).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(IDLE_MS));
    expect(onNudge).toHaveBeenCalledTimes(1);
  });

  it('pauses while the tab is hidden and re-arms on return', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const onNudge = vi.fn();
    renderHook(() => useIdleNudge({ active: true, hasSwiped: false, onNudge }));
    act(() => vi.advanceTimersByTime(IDLE_MS));
    expect(onNudge).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(IDLE_MS));
    expect(onNudge).toHaveBeenCalledTimes(1);
  });
});
