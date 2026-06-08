// Cart-hold countdown helpers. A reservation is "warning" in its last minute
// and "expired" once the deadline passes. Pure, so the phases are unit-testable.
export const WARN_MS = 60_000;

export type HoldPhase = 'active' | 'warning' | 'expired';

export function holdState(expiresAt: number, now: number): { remainingMs: number; phase: HoldPhase } {
  const diff = expiresAt - now;
  if (diff <= 0) return { remainingMs: 0, phase: 'expired' };
  return { remainingMs: diff, phase: diff <= WARN_MS ? 'warning' : 'active' };
}

export function formatHold(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
