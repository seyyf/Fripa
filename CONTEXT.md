# Fripa

The thrift-shop ("fripa" / "friperie") swipe app. A Tinder/Bumble-style deck of clothing cards: the user swipes each card right to keep, left to pass, or up to save for later — recreating the snap decisions of a real Tunisian souk fripa, where the brutal 90/10 dice means a passed piece is usually gone for good.

> History: an earlier iteration replaced this deck with a "floating field" of drifting boxes plus a simulated phantom crowd. That direction was reverted — see [ADR-0003](docs/adr/0003-revert-to-swipe-deck-add-favorites.md). The floating-field vocabulary (Field, Box, Reveal, Grab, Snatch, Phantom crowd) is **retired**.

## Language

### The deck & cards

**Deck**:
The stack of clothing cards the user swipes through, one at a time. Fed client-side from a larger batch (`GET /api/items/field`) and topped up as it runs low.

**Swipe card** (a.k.a. card):
A single clothing item presented full-size in the deck. Draggable in three directions; on-screen buttons mirror each gesture for mouse/desktop and accessibility.

**Garder** (swipe right →):
The keep action — adds the item to the cart.

**Passer** (swipe left ←):
The user's pass. Fires the 90/10 dice (see **Pass**). This is a genuine user action again (the floating field had removed it; [ADR-0003](docs/adr/0003-revert-to-swipe-deck-add-favorites.md) brought it back).

**Favori** (swipe up ↑):
Save-for-later. Adds the item to the **favorites** list — separate from the cart. From the favorites drawer the user can move an item to the cart or remove it. Removing a favorite is a decision: it does not resurface in the deck.

**Reviens !** (undo):
Reverses the most recent swipe and drops the piece back on top of the deck. Backed by a per-user **action-history** stack (`shop.service.ts::undo()`): a pass becomes eligible again (whatever the dice rolled), a keep leaves the cart, a favorite leaves the list. Repeatable in reverse order. `moveFavoriteToCart` is not an undoable swipe. Cleared by stock-refresh and reset.

**Filtres** (Filtrer):
Narrows the deck by free-text search (title/brand/description/colour), size, condition, and max price. Applied server-side in `getField`; changing filters resets the deck. An empty result shows a "Aucune pièce ne correspond" panel rather than the exhaustion state.

### The dice mechanic

**Pass** (`shop.service.ts::pass()`):
The backend event in which a swiped-left item exits and the 90/10 dice rolls — 90% gone forever, 10% lands in the last-chance pool for one possible reprise. Triggered directly by the user's swipe-left (`api.pass`). The route is `/api/swipes/pass`.
_Avoid_: "snatch" (the retired phantom-crowd trigger from ADR-0001).

**Reprise** (a.k.a. Dernière chance):
A previously-passed item that the 90/10 dice put in the last-chance pool, surfacing once more in the deck with a gold pulsing banner. Surfaces at a tunable rate (`LAST_CHANCE_SURFACE_RATE = 0.2`). Once shown, it never returns again.
_Avoid_: "second chance", "redemption" — the French brand word is "Dernière chance".

### Sessions

**Stock-refresh** (a.k.a. "Voir d'autres pièces"):
Clears the user's swipe history (`passed`, `lastChancePool`, `shownLastChance`) **without** touching the cart **or the favorites**. Triggered from `EmptyState` when the deck is exhausted. See [ADR-0002](docs/adr/0002-preserve-cart-on-stock-refresh.md).
_Avoid_: "reset" (the destructive variant that also wipes the cart).

**Reset** (destructive):
Wipes the entire `UserState` — cart and favorites included. The secondary, hard-restart action (header `↻`).

### Actors

**User**:
The single human using the app. Identified by a `userId` generated client-side and stored in `localStorage`. No auth.
