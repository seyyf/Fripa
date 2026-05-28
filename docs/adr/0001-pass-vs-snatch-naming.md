# Pass vs Snatch naming split

When the swipe UI was replaced by the floating-field UI, the user stopped being the one who "passes" on items — the phantom crowd became the sole trigger of that dice. Rather than rename the route, the backend method, and every test (`/api/swipes/pass`, `ShopService.pass()`, ~5 references), we kept **`pass`** as the **mechanical** event (an item leaves the field; the 90/10 dice rolls) and introduced **`snatch`** as the **narrative trigger** (the phantom crowd takes a box). The frontend calls `api.snatch(itemId)`, which posts to the unchanged `/api/swipes/pass` route — a one-liner comment on the API client flags the historical name. This keeps the route stable (single-client app, but still: no needless churn), preserves the French brand word "passer" in user-facing copy, and gives future readers a clear two-word vocabulary for the two distinct ideas the old code conflated. See `CONTEXT.md` for the canonical definitions.

## Considered options

- **Rename everywhere to `snatch`** — cleanest, but high churn and disconnects code from the brand verb "passer".
- **Keep `pass` everywhere** — lowest churn, but the sentence "the user never passes, yet `api.pass` fires on every snatch" remains confusing for new readers indefinitely.
