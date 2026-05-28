import { Injectable, NotFoundException } from '@nestjs/common';
import { ITEMS } from './items.data';
import { CartLine, FieldResponse, TShirt } from './types';

// Probability a "passed" item is given one more chance to surface later.
// 90% of passes → gone forever immediately. 10% → eligible to reappear once,
// flagged as "last chance" so the buyer knows it won't return.
const LAST_CHANCE_PROBABILITY = 0.1;

// When fresh items exist, how often we sneak in a last-chance reprise.
// Tuned to feel like a real fripa: rare but jolting when it happens.
const LAST_CHANCE_SURFACE_RATE = 0.2;

interface UserState {
  passed: Set<string>;
  lastChancePool: Set<string>;
  shownLastChance: Set<string>;
  cart: Map<string, number>;
}

@Injectable()
export class ShopService {
  private states = new Map<string, UserState>();

  // Injectable randomness so the 90/10 dice and field shuffle are testable.
  private rng: () => number = Math.random;

  private getState(userId: string): UserState {
    let s = this.states.get(userId);
    if (!s) {
      s = {
        passed: new Set(),
        lastChancePool: new Set(),
        shownLastChance: new Set(),
        cart: new Map(),
      };
      this.states.set(userId, s);
    }
    return s;
  }

  private getItem(id: string): TShirt {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  getField(userId: string, count: number): FieldResponse {
    const s = this.getState(userId);

    const fresh = ITEMS.filter(
      (i) =>
        !s.passed.has(i.id) &&
        !s.lastChancePool.has(i.id) &&
        !s.shownLastChance.has(i.id) &&
        !s.cart.has(i.id),
    );
    const reprise = ITEMS.filter(
      (i) => s.lastChancePool.has(i.id) && !s.shownLastChance.has(i.id),
    );

    const items: (TShirt & { lastChance: boolean })[] = [];

    // Occasionally sneak one last-chance reprise into the batch.
    if (reprise.length > 0 && this.rng() < LAST_CHANCE_SURFACE_RATE) {
      const chosen = reprise[Math.floor(this.rng() * reprise.length)];
      s.lastChancePool.delete(chosen.id);
      s.shownLastChance.add(chosen.id);
      items.push({ ...chosen, lastChance: true });
    }

    for (const item of this.shuffle([...fresh])) {
      if (items.length >= count) break;
      items.push({ ...item, lastChance: false });
    }

    const remaining = fresh.length + reprise.length - items.length;
    return { items, remaining: Math.max(0, remaining) };
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pass(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId); // validate

    // If it was already a last-chance show, the swipe seals it forever.
    if (s.shownLastChance.has(itemId)) return { gone: true };

    // Roll the dice: 10% chance it gets one reprise as last-chance.
    if (this.rng() < LAST_CHANCE_PROBABILITY) {
      s.lastChancePool.add(itemId);
      return { gone: false, eligibleForReprise: true };
    }

    s.passed.add(itemId);
    return { gone: true };
  }

  addToCart(userId: string, itemId: string) {
    const s = this.getState(userId);
    this.getItem(itemId);
    s.cart.set(itemId, (s.cart.get(itemId) || 0) + 1);
    // Once it's in the cart, drop any pending reprise.
    s.lastChancePool.delete(itemId);
    return this.getCart(userId);
  }

  removeFromCart(userId: string, itemId: string) {
    const s = this.getState(userId);
    s.cart.delete(itemId);
    // Removed items don't come back as last-chance — they're permanently passed.
    s.passed.add(itemId);
    return this.getCart(userId);
  }

  getCart(userId: string): { lines: CartLine[]; total: number } {
    const s = this.getState(userId);
    const lines: CartLine[] = Array.from(s.cart.entries()).map(([id, qty]) => ({
      ...this.getItem(id),
      quantity: qty,
    }));
    const total = lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
    return { lines, total };
  }

  checkout(userId: string) {
    const cart = this.getCart(userId);
    if (cart.lines.length === 0) {
      return { ok: false, message: 'Panier vide.' };
    }
    // In-memory demo: just clear the cart and pretend we sold them.
    const s = this.getState(userId);
    s.cart.clear();
    return {
      ok: true,
      message: `Commande confirmée — ${cart.total} TND. À très vite chez Fripa !`,
      orderTotal: cart.total,
      lines: cart.lines,
    };
  }

  reset(userId: string) {
    this.states.delete(userId);
    return { ok: true };
  }

  // Stock-refresh: keep the curated cart, wipe everything the swipe loop has
  // touched. See docs/adr/0002-preserve-cart-on-stock-refresh.md.
  resetSwipes(userId: string) {
    const s = this.getState(userId);
    s.passed.clear();
    s.lastChancePool.clear();
    s.shownLastChance.clear();
    return { ok: true };
  }
}
