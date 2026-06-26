// Pure detector: given the ids that were reserved last poll and the current
// favorites lines, return the ids that just became available (still present,
// previously reserved, no longer held). Used to fire a "now available" toast.
export function detectFreedFavorites(
  prevReservedIds: Set<string>,
  lines: { id: string; reservedUntil?: number }[],
  now: number,
): string[] {
  const freed: string[] = [];
  for (const line of lines) {
    const stillReserved = typeof line.reservedUntil === 'number' && line.reservedUntil > now;
    if (prevReservedIds.has(line.id) && !stillReserved) freed.push(line.id);
  }
  return freed;
}

// Current reserved ids in a favorites list (for the next comparison).
export function reservedIdsOf(
  lines: { id: string; reservedUntil?: number }[],
  now: number,
): Set<string> {
  return new Set(
    lines.filter((l) => typeof l.reservedUntil === 'number' && l.reservedUntil > now).map((l) => l.id),
  );
}
