import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { takeSwipes, setHasCart } from './presenceState';

const HEARTBEAT_INTERVAL_MS = 15_000;

// Derive a coarse page label + pieceId from the current path.
function pageFromPath(pathname: string): { page: string; pieceId?: string } {
  const piece = pathname.match(/^\/piece\/(.+)$/);
  if (piece) return { page: 'piece', pieceId: piece[1] };
  if (pathname.startsWith('/catalogue')) return { page: 'catalogue' };
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) return { page: 'cart' };
  if (pathname.startsWith('/compte')) return { page: 'account' };
  if (pathname === '/' || pathname === '') return { page: 'home' };
  return { page: pathname.replace(/^\//, '').split('/')[0] || 'home' };
}

// Mounted once at the shopper app root. Sends a heartbeat every 15s while the
// tab is visible, plus a final beacon on pagehide. `hasCart` comes from the
// app's live cart state.
export function usePresenceHeartbeat(hasCart: boolean): void {
  const location = useLocation();
  // Keep the latest context in a ref so the interval always reads fresh values.
  const ctxRef = useRef({ pathname: location.pathname, hasCart });
  ctxRef.current = { pathname: location.pathname, hasCart };

  useEffect(() => {
    setHasCart(hasCart);
  }, [hasCart]);

  useEffect(() => {
    const send = () => {
      if (document.hidden) return;
      const { pathname, hasCart } = ctxRef.current;
      const { page, pieceId } = pageFromPath(pathname);
      api.presencePing({ page, pieceId, hasCart, swipesSincePing: takeSwipes() });
    };

    send(); // immediate first beat
    const timer = window.setInterval(send, HEARTBEAT_INTERVAL_MS);

    const onHide = () => {
      const { pathname, hasCart } = ctxRef.current;
      const { page, pieceId } = pageFromPath(pathname);
      api.presencePing({ page, pieceId, hasCart, swipesSincePing: takeSwipes() });
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);
}
