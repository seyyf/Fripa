# Revert to a swipe deck; user-triggered pass returns; favorites added

**Date:** 2026-05-29 · **Status:** Accepted · **Partially supersedes:** [ADR-0001](0001-pass-vs-snatch-naming.md)

## Context

The floating-field UI (drifting blurry boxes + a phantom crowd that snatches) was built and wired up, but the product direction changed: the whole app should feel like Tinder/Bumble — a card deck the user swipes. The user is once again the one making every decision, in three directions:

- **→ Garder** → add to cart
- **← Passer** → roll the existing 90/10 dice (90% gone forever, 10% resurfaces once as a **Dernière chance** card)
- **↑ Favori** → save for later in a list separate from the cart (new feature)

## Decision

1. **The swipe deck replaces the floating field.** `FloatingField`, `FloatingBox`, `AmbientLayer`, `usePhantomCrowd`, `pickSnatchTarget`, and `fieldLayout` are deleted. The Three.js dust-mote backdrop is dropped (bundle −~490 kB).
2. **The phantom crowd is retired.** Scarcity now comes purely from the user's own swipe-left dice — the original app's model. There is no longer any simulated-crowd pressure.
3. **`pass` is a user action again.** ADR-0001 split `pass` (mechanism) from `snatch` (the crowd's narrative trigger) because the user no longer passed. With the deck, swipe-left *is* a user-triggered pass, so the frontend exposes **`api.pass(itemId)`** again and the `snatch` alias is removed. The backend method, route (`/api/swipes/pass`), and the 90/10 dice are **unchanged**.
4. **Favorites are a new, cart-independent list.** A `favorites` set on `UserState`, excluded from the deck like the cart is. Removing a favorite is treated as a decision (it does not resurface). Stock-refresh (ADR-0002) preserves favorites alongside the cart; hard reset clears them.

## Consequences

- `CONTEXT.md` is updated: the swipe card is un-retired; **Pass** is user-triggered again; **Favori** is added; the floating-field vocabulary (Field, Box, Reveal, Grab, Snatch, Phantom crowd) is retired.
- ADR-0001's `snatch` naming is now historical — kept in that ADR for the record, but no longer present in the code.
- The 90/10 / Dernière chance mechanic — the brand's core hook — is preserved unchanged.

## Considered alternatives

- **Keep the floating field, add swipe to a focused box** — rejected: not "the whole app like Tinder".
- **Card stack + phantom-crowd scarcity** (cards snatched if you dither) — rejected for now in favor of the simpler, classic deck; the dice alone carries the scarcity feel.
