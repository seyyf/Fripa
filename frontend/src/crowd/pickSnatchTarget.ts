// Picks which piece a phantom shopper grabs off the catalogue floor. Pure, so
// it's testable without timers. Returns null when the floor is too small or the
// only piece left is the one the user is hovering (we never snatch that).
export function pickSnatchTarget(
  ids: string[],
  protectedId: string | null,
  minFloor: number,
  rng: () => number = Math.random,
): string | null {
  if (ids.length <= minFloor) return null;
  const candidates = ids.filter((id) => id !== protectedId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}
