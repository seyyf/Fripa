// Tiny module-level store so the deck/cart can feed the heartbeat without
// prop-drilling. The heartbeat reads (and resets) the swipe counter each tick.
let swipesSincePing = 0;
let hasCart = false;

export function bumpSwipe(): void {
  swipesSincePing++;
}

// Read and reset the accumulated swipe count.
export function takeSwipes(): number {
  const n = swipesSincePing;
  swipesSincePing = 0;
  return n;
}

export function setHasCart(value: boolean): void {
  hasCart = value;
}

export function getHasCart(): boolean {
  return hasCart;
}
