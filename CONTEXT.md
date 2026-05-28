# Fripa

The thrift-shop ("fripa" / "friperie") swipe app. A field of clothing pieces drifts on screen; the user reveals and grabs what they want; a simulated crowd ("phantom shoppers") snatches the rest, creating the scarcity feeling of a real Tunisian souk fripa.

## Language

### Field & boxes

**Field**:
The on-screen stage where clothing boxes drift. Holds roughly 9 boxes on mobile / 16 on desktop, drawn from a larger client-side deck.
_Avoid_: stage, board, grid (the field is specifically a soft drifting layout, not a grid).

**Box**:
A single drifting clothing item on the field. Idle = blurred and small; focused = sharp and scaled up with a detail panel.
_Avoid_: card, tile (we retired the swipe card; "card" refers to that older model).

**Reveal**:
The act of focusing a box — by tap (mobile) or hover (desktop). Blur → sharp, scale up, drift pauses for that one box.

**Grab**:
The user's commit action on a focused box: adds it to the cart. The only way a user removes an item from the field of their own accord.

### The dice mechanic

**Pass** (code-only, mechanical):
The backend event in which an item exits the field and the 90/10 dice rolls — 90% gone forever, 10% lands in the last-chance pool for one possible reprise. Lives in `shop.service.ts::pass()`. See [ADR-0001](docs/adr/0001-pass-vs-snatch-naming.md) for the naming split.
_Avoid_: using "pass" in user-facing copy or to describe a user action — the user no longer triggers passes in this UI.

**Snatch** (narrative trigger):
The phantom crowd taking an unfocused box off the field. Fires the backend `pass` mechanic. The only trigger for `pass` in the floating-field UI.
_Avoid_: "swipe-pass", "auto-pass".

**Reprise** (a.k.a. Dernière chance):
A previously-snatched item that the 90/10 dice put in the last-chance pool, drifting back into the field with a gold ribbon. Surfaces at a tunable rate (`LAST_CHANCE_SURFACE_RATE = 0.2`). Treated like any other box by the crowd — it can be snatched again before the user notices, in which case it's gone forever (this is intentional: brutal-fripa feel).
_Avoid_: "second chance", "redemption" — the French brand word is "Dernière chance".

### Sessions

**Stock-refresh** (a.k.a. "Voir d'autres pièces"):
Clears the user's swipe history (`passed`, `lastChancePool`, `shownLastChance`) **without** touching the cart. Triggered from `EmptyState` when the field is exhausted. The catalog becomes browseable again; items previously snatched (including reprises that never surfaced) return as fresh, without ribbons. See [ADR-0002](docs/adr/0002-preserve-cart-on-stock-refresh.md).
_Avoid_: "reset" (which is the destructive variant that also wipes the cart).

**Reset** (destructive):
Wipes the entire `UserState`, cart included. The secondary, hard-restart action.

### Actors

**Phantom crowd**:
The simulated other shoppers. A client-side timer (`usePhantomCrowd`) that periodically picks one un-focused box and calls `onSnatch`. There are no real other users — this is single-player with simulated pressure.
_Avoid_: "other users", "bots".

**User**:
The single human using the app. Identified by a `userId` generated client-side and stored in `localStorage`. No auth.
