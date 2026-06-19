# Idle Swipe Re-Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replay the existing first-visit swipe demo for a shopper who has made zero swipes after 20s of inactivity, at most twice per visit, to remind them the cards are swipeable.

**Architecture:** A new `useIdleNudge` hook owns the trigger policy (idle timer, zero-swipe gate, replay cap, tab-visibility pause). `SwipeDeck` wires it to re-fire its existing `demo` state via `setDemo(true)`; `SwipeCard` reports non-committing interactions so the timer resets while the user fiddles.

**Tech Stack:** React 18 + framer-motion, Vitest + @testing-library/react (jsdom), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-19-idle-swipe-renudge-design.md`

---

## File Structure

- **Create** `frontend/src/swipe/useIdleNudge.ts` — the trigger policy (timer, gate, cap, visibility). One responsibility, no rendering.
- **Create** `frontend/src/swipe/useIdleNudge.test.ts` — fake-timer unit tests for the policy.
- **Modify** `frontend/src/components/SwipeCard.tsx` — add an `onInteract?` prop, fired on non-committing drag start + photo-angle tap.
- **Modify** `frontend/src/components/SwipeDeck.tsx` — track `hasSwiped`, compute `active`, wire the hook, pass `onInteract`.

---

## Task 1: `useIdleNudge` hook

**Files:**
- Create: `frontend/src/swipe/useIdleNudge.ts`
- Test: `frontend/src/swipe/useIdleNudge.test.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/swipe/useIdleNudge.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/swipe/useIdleNudge.test.ts`
Expected: FAIL — cannot find module `./useIdleNudge`.

- [ ] **Step 3: Write the implementation**

`frontend/src/swipe/useIdleNudge.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `frontend/`): `npx vitest run src/swipe/useIdleNudge.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/swipe/useIdleNudge.ts frontend/src/swipe/useIdleNudge.test.ts
git commit -m "feat(deck): useIdleNudge hook — idle re-nudge policy for zero-swipe users"
```

---

## Task 2: Report non-committing interactions from `SwipeCard`

**Files:**
- Modify: `frontend/src/components/SwipeCard.tsx`

- [ ] **Step 1: Add the prop to the interface.** In `frontend/src/components/SwipeCard.tsx`, add `onInteract` to `Props`:
```ts
interface Props {
  item: FieldItem;
  onKeep: (item: FieldItem) => void;
  onPass: (item: FieldItem) => void;
  onFavorite: (item: FieldItem) => void;
  reducedMotion?: boolean;
  // First-visit teaching: play a one-time scripted nudge (right→left→up) so the
  // shopper sees each gesture and its feedback before touching anything.
  demo?: boolean;
  onDemoEnd?: () => void;
  // Fired on a non-committing interaction (drag attempt, photo tap) so the deck
  // can reset its idle re-nudge timer.
  onInteract?: () => void;
}
```

- [ ] **Step 2: Destructure the prop.** Update the component signature:
```ts
export const SwipeCard = forwardRef<HTMLDivElement, Props>(function SwipeCard(
  { item, onKeep, onPass, onFavorite, reducedMotion = false, demo = false, onDemoEnd, onInteract }: Props,
  ref,
) {
```

- [ ] **Step 3: Fire it on a photo-angle tap.** In `cyclePhoto`, after the early-return guard:
```ts
  function cyclePhoto(dir: 1 | -1) {
    if (draggingRef.current || photos.length < 2) return;
    onInteract?.();
    setPhotoIndex((i) => (i + dir + photos.length) % photos.length);
  }
```

- [ ] **Step 4: Fire it on drag start.** In the `onDragStart` handler on the `motion.div`:
```ts
      onDragStart={() => {
        draggingRef.current = true;
        demoCancel.current?.(); // the shopper took over — stop demonstrating
        onInteract?.(); // a drag attempt counts as engagement
      }}
```

- [ ] **Step 5: Verify it still builds.**

Run (from `frontend/`): `npm run build`
Expected: `tsc -b && vite build` completes with no type errors. (`onInteract` is optional, so existing tests that render `SwipeCard` without it still compile.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SwipeCard.tsx
git commit -m "feat(deck): SwipeCard reports non-committing interactions"
```

---

## Task 3: Wire the hook into `SwipeDeck`

**Files:**
- Modify: `frontend/src/components/SwipeDeck.tsx`

- [ ] **Step 1: Import the hook.** Add to the imports at the top of `frontend/src/components/SwipeDeck.tsx`:
```ts
import { useIdleNudge } from '../swipe/useIdleNudge';
```
(Keep the existing `import { useEffect, useRef, useState } from 'react';` — `useState` is already imported.)

- [ ] **Step 2: Track whether the user has swiped.** Inside the component, next to the existing `demo` state:
```ts
  // Once the shopper makes any real swipe, the idle re-nudge is done for good.
  const [hasSwiped, setHasSwiped] = useState(false);
```

- [ ] **Step 3: Set it in `decide()`.** `decide()` is the single funnel for every committed swipe (drag, buttons, arrow keys). Add the flag at the top of it:
```ts
  function decide(action: BurstAction, item: FieldItem) {
    setHasSwiped(true); // any committed swipe ends the onboarding nudge
    lastAction.current = action;
    if (demo) endDemo(); // a real swipe means they've got it
```

- [ ] **Step 4: Compute `active` and wire the hook.** Add immediately after `endDemo` is defined (before the first `useEffect`):
```ts
  // The idle re-nudge may run only when a card is on top, motion is allowed,
  // no drawer/modal is covering the deck, and the demo isn't already playing.
  const overlayOpen =
    typeof document !== 'undefined' &&
    !!document.querySelector('.drawer-backdrop, .modal-backdrop');
  const nudgeActive = !!top && !reducedMotion && !demo && !overlayOpen;
  const { noteInteraction } = useIdleNudge({
    active: nudgeActive,
    hasSwiped,
    onNudge: () => setDemo(true), // replay the existing first-visit demo
  });
```

- [ ] **Step 5: Pass `onInteract` to the card.** In the `<SwipeCard ... />` JSX, add the prop:
```tsx
          <SwipeCard
            key={top.id}
            item={top}
            reducedMotion={reducedMotion}
            demo={demo}
            onDemoEnd={endDemo}
            onInteract={noteInteraction}
            onKeep={(i) => decide('keep', i)}
            onPass={(i) => decide('pass', i)}
            onFavorite={(i) => decide('favorite', i)}
          />
```

- [ ] **Step 6: Run the deck tests + build.**

Run (from `frontend/`): `npx vitest run src/components/SwipeDeck.test.tsx src/components/SwipeCard.test.tsx`
Expected: PASS if those test files exist; if a path doesn't exist, run `npx vitest run` (whole suite) instead.
Then: `npm run build`
Expected: completes with no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SwipeDeck.tsx
git commit -m "feat(deck): replay swipe demo after 20s idle for zero-swipe users"
```

---

## Task 4: Full suite + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole frontend suite.**

Run (from `frontend/`): `npx vitest run`
Expected: all test files PASS, including the new `useIdleNudge` tests.

- [ ] **Step 2: Manual check — re-nudge fires for a fresh user.**

Start the frontend (`npm run dev` from `frontend/`). In a browser:
1. Clear the onboarding flag so it behaves like a first visit: open DevTools console and run `localStorage.removeItem('fripa-coached')`, then reload.
2. Watch the first-visit demo play, then **do nothing**.
3. After ~20s, the demo replays (replay #1). After another ~20s idle, it replays once more (replay #2). After that it stays silent.

- [ ] **Step 3: Manual check — a real swipe disables it.**

Reload with the flag cleared again. After the first demo, **swipe one card** (drag, or click ✕/⭐/🛒). Then wait > 40s: confirm **no** replay occurs.

- [ ] **Step 4: Manual check — interaction resets the timer.**

Reload with the flag cleared. After the first demo, every ~15s **tap a photo angle** or grab-and-release the card without swiping far enough to commit. Confirm the replay does **not** fire while you keep interacting, and only fires after a full ~20s of true inactivity.

- [ ] **Step 5: Manual check — reduced motion opts out.**

In DevTools, emulate `prefers-reduced-motion: reduce` (Rendering tab), reload with the flag cleared. Confirm neither the first demo nor any re-nudge animates.

---

## Self-Review Notes

- **Spec coverage:** zero-swipe gate (`hasSwiped`, Task 3 Step 3 + hook), 20s idle (`IDLE_MS`, Task 1), full demo replay (`onNudge: () => setDemo(true)`, Task 3 Step 4), cap of 2 (`MAX_REPLAYS`, Task 1), interaction reset (Task 2 + `noteInteraction`), reduced-motion opt-out (`nudgeActive`, Task 3 Step 4), overlay suppression (`overlayOpen`, Task 3 Step 4), tab-hidden pause (Task 1 visibility effect), in-memory per-load count (`replays` ref, Task 1). All covered.
- **Type consistency:** `useIdleNudge` args (`active`, `hasSwiped`, `onNudge`) and return (`{ noteInteraction }`) match between Task 1 and Task 3; `onInteract` prop name matches between Task 2 (SwipeCard) and Task 3 (SwipeDeck passes `onInteract={noteInteraction}`).
- **No backend / i18n changes** — reuses the existing stamps + hand cue, as specified.
