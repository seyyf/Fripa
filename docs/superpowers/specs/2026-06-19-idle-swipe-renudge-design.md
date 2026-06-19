# Idle Swipe Re-Nudge — Design Spec

**Date:** 2026-06-19
**Status:** Approved, ready for implementation plan

## Goal

Help a brand-new shopper who has watched the first-visit swipe demo but then
**frozen without trying a single swipe**. After a short idle period, replay the
existing teaching animation to remind them the cards are swipeable — without
ever nagging users who already know how to swipe.

## Decisions (locked during brainstorming)

1. **Who:** only users with **zero real swipes this visit** (drag commit, action
   button, or arrow key). The first real swipe disables the re-nudge permanently
   for that visit.
2. **Idle delay:** **20 seconds** of no interaction before a replay fires. The
   timer resets on any interaction (non-committing drag, photo-angle tap).
3. **Form:** the **full first-visit demo replay** (right → left → up, with the
   GARDER/PASSER/FAVORI stamps + hand cue, ~3.5s) — identical to what the user
   first saw.
4. **Frequency cap:** at most **twice per visit**, then stay silent.

## Why not the literal "every idle minute" idea

Idle ≠ confused. A user lingering on a card is usually reading it (price, brand,
condition, photos). Re-teaching everyone on a recurring timer interrupts engaged
behaviour and reads as condescending. Restricting to zero-swipe users with a
hard cap keeps it purely an onboarding aid.

## Tuning constants

Defined in `frontend/src/swipe/useIdleNudge.ts`:

| Constant | Value | Meaning |
|---|---|---|
| `IDLE_MS` | 20_000 | idle time before a replay fires |
| `MAX_REPLAYS` | 2 | replays allowed per page load |

## Existing machinery this reuses

- **First-visit demo** lives in `SwipeCard.tsx`: the `demo` prop drives a
  scripted `right → left → up` sequence (`demoing` state + `demoCancel` ref) that
  animates the real `x`/`y` motion values, so the glow + stamps + hand cue light
  up exactly as in a real swipe. It cancels on `onDragStart`.
- **`SwipeDeck.tsx`** owns the `demo` state, `endDemo()` (which sets the one-time
  `localStorage['fripa-coached']` flag), and `decide()` (the single funnel for
  every committed swipe — drag, buttons, arrow keys).

Re-triggering a replay is simply `setDemo(true)` again: the `localStorage` gate
only guards the **initial** `demo` state, not a manual re-set.

## Architecture

### New: `useIdleNudge` hook — `frontend/src/swipe/useIdleNudge.ts`

Owns the entire trigger policy so it is testable in isolation from rendering.

```ts
interface UseIdleNudgeArgs {
  active: boolean;       // a top card exists, not reduced-motion, no overlay
                         // open, and the demo is not already running
  hasSwiped: boolean;    // becomes true forever after the first real swipe
  onNudge: () => void;   // called to replay the demo
  idleMs?: number;       // default IDLE_MS
  maxReplays?: number;   // default MAX_REPLAYS
}

interface UseIdleNudge {
  noteInteraction: () => void; // reset the idle timer (drag attempt, photo tap)
}
```

Behaviour:
- Runs a single idle timer. While `active && !hasSwiped` and replays-used
  `< maxReplays`, it (re)starts a `idleMs` timer; on fire it calls `onNudge()`
  and increments an internal replay counter (a `ref`).
- `noteInteraction()` restarts the timer (clears + re-arms).
- **Pauses on `document.hidden`**: a `visibilitychange` listener clears the timer
  when the tab is hidden and re-arms it when visible, so a backgrounded tab never
  silently consumes a replay.
- When `hasSwiped` becomes true, or the cap is reached, the timer is cleared and
  never re-armed.
- While `active` is false (overlay open, reduced-motion, demo running, deck
  empty) the timer is cleared; it re-arms when `active` returns true.

### Modify: `SwipeDeck.tsx`

- Add `const [hasSwiped, setHasSwiped] = useState(false)`; set it `true` inside
  `decide()` (covers drag commit, action buttons, and arrow keys — all funnel
  through `decide()`).
- Compute `active`:
  `!!top && !reducedMotion && !demo && !document.querySelector('.drawer-backdrop, .modal-backdrop')`.
  (The overlay check mirrors the existing keyboard-handler guard.)
- Wire the hook:
  ```ts
  const { noteInteraction } = useIdleNudge({
    active,
    hasSwiped,
    onNudge: () => setDemo(true),
  });
  ```
- Pass `onInteract={noteInteraction}` to `SwipeCard`.

### Modify: `SwipeCard.tsx`

- Add an optional `onInteract?: () => void` prop.
- Call `onInteract?.()` in `onDragStart` (a non-committing drag still counts as
  engagement) and inside `cyclePhoto` (photo-angle tap).
- Action buttons (`✕ ⭐ 🛒`) already route through `decide()` → they set
  `hasSwiped`, so they need no extra wiring.

## Flow (zero-swipe newbie)

first-visit demo on load → ends → 20s idle, no swipe/interaction → **replay #1**
→ 20s idle → **replay #2** → silent for the rest of the visit. Any real swipe at
any point disables it permanently for the visit; any drag attempt or photo tap
resets the 20s clock.

## Edge cases

- **Reduced motion** → never fires (`active` is false), consistent with the
  first-visit demo.
- **Deck empty / out of cards** → `active` false, no nudge.
- **Drawer or modal open** (cart, favorites, filters, size prompt) → suppressed
  and timer reset; no animation behind an overlay.
- **Tab hidden** → timer paused; resumes (re-armed) on return.
- **Replay count is in-memory per page load** → a returning, still-confused user
  is helped again on their next visit (the first-visit demo won't replay for them
  because of its `localStorage` gate, so this idle path is their safety net).

## Out of scope

- Any nudge for users who have already swiped at least once.
- Persisting the replay count across reloads.
- A shorter/alternate animation for the 2nd replay (both replays are the full
  sequence).
- Backend or i18n changes (reuses the existing stamps + hand cue).

## Testing

`frontend/src/swipe/useIdleNudge.test.ts` with `vi.useFakeTimers()`:
- fires `onNudge` after `IDLE_MS` when `active && !hasSwiped`;
- never fires once `hasSwiped` is true;
- caps at exactly `MAX_REPLAYS` (2) replays;
- `noteInteraction()` resets the timer (advancing just under `IDLE_MS`, calling
  it, then advancing again does not fire early);
- does not fire while `active` is false (overlay / reduced-motion);
- does not fire while `document.hidden`, and re-arms on visibility return.

The `SwipeDeck`/`SwipeCard` wiring is thin; covered by the existing
`npm run build` + `vitest run` pass.
