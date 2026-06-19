import { useCallback, useEffect, useRef } from 'react';

// Idle time before a re-nudge fires, and how many replays a single page load
// allows. Kept here as the single source of truth for the policy.
export const IDLE_MS = 20_000;
export const MAX_REPLAYS = 2;

interface UseIdleNudgeArgs {
  // A top card exists, motion is allowed, no overlay is open, and the demo is
  // not already running. When false the timer is cleared.
  active: boolean;
  // Becomes true forever after the first real swipe; disables the nudge.
  hasSwiped: boolean;
  // Called to replay the demo.
  onNudge: () => void;
  idleMs?: number;
  maxReplays?: number;
}

// Onboarding safety net: if a never-swiped shopper sits idle, replay the swipe
// demo. All scheduling lives here so it can be tested without rendering a deck.
export function useIdleNudge({
  active,
  hasSwiped,
  onNudge,
  idleMs = IDLE_MS,
  maxReplays = MAX_REPLAYS,
}: UseIdleNudgeArgs): { noteInteraction: () => void } {
  const replays = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest values in refs so the stable arm()/clear() read fresh state.
  const onNudgeRef = useRef(onNudge);
  onNudgeRef.current = onNudge;
  const stateRef = useRef({ active, hasSwiped, idleMs, maxReplays });
  stateRef.current = { active, hasSwiped, idleMs, maxReplays };

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clear();
    const s = stateRef.current;
    if (!s.active || s.hasSwiped || replays.current >= s.maxReplays || document.hidden) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const now = stateRef.current;
      if (!now.active || now.hasSwiped || replays.current >= now.maxReplays || document.hidden) return;
      replays.current += 1;
      onNudgeRef.current();
      // After the nudge the parent flips `active` false (demo running); when it
      // returns true the arming effect re-fires for the next idle window.
    }, s.idleMs);
  }, [clear]);

  const noteInteraction = useCallback(() => {
    arm();
  }, [arm]);

  // Re-arm whenever the control inputs change (active toggles, swipe happens).
  useEffect(() => {
    arm();
    return clear;
  }, [active, hasSwiped, idleMs, maxReplays, arm, clear]);

  // Pause on tab hide; re-arm on return.
  useEffect(() => {
    const onVis = () => (document.hidden ? clear() : arm());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [arm, clear]);

  return { noteInteraction };
}
