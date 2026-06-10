import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Props {
  // Called once when the countdown reaches zero — the host view refreshes its
  // stock so the freshly dropped pieces appear immediately.
  onDrop?: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}j ${pad(h)}h${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// "🔥 Prochain drop dans …" countdown, fed by the admin's scheduled drops.
// Renders nothing when no drop is scheduled.
export function DropBanner({ onDrop }: Props) {
  const [next, setNext] = useState<{ at: string | null; count: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNext(await api.nextDrop());
    } catch {
      /* teaser only — never break the page */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const at = next?.at ? new Date(next.at).getTime() : null;

  useEffect(() => {
    if (at == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [at]);

  // Countdown hit zero: tell the host to refresh, then look for a next drop.
  useEffect(() => {
    if (at == null || at > now || firedRef.current === next?.at) return;
    firedRef.current = next?.at ?? null;
    onDrop?.();
    void load();
  }, [at, now, next, onDrop, load]);

  if (at == null || at <= now) return null;

  return (
    <div className="drop-banner" role="status">
      🔥 Prochain drop dans <strong className="drop-banner__count">{formatRemaining(at - now)}</strong>
      {next!.count > 0 && (
        <span className="drop-banner__pieces">
          — {next!.count} nouvelle{next!.count > 1 ? 's' : ''} pièce{next!.count > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
