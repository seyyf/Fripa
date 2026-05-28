// Picks which box a phantom shopper grabs. Pure so it can be tested without
// timers. Returns null when the field is too small or only the focused box
// remains — we never snatch the box the user is currently looking at.
export function pickSnatchTarget(
  boxKeys: string[],
  focusedKey: string | null,
  minFieldSize: number,
  rng: () => number = Math.random,
): string | null {
  if (boxKeys.length <= minFieldSize) return null;
  const candidates = boxKeys.filter((k) => k !== focusedKey);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}
