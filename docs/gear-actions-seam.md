# Gear actions seam — refactor notes for review

**Status:** proposed, on `design/redesign-exploration`
**Touches production code:** yes — `GearManager.jsx`, `App.jsx`, plus a new `utils/gearActions.js`
**Behaviour change:** none intended in production. This is a pure extraction.
**Companion to:** [`admin-actions-seam.md`](./admin-actions-seam.md) — same pattern, same reasoning, one extra problem.

---

## Why

Same story as the admin panel: the redesign needs to show the gear surface, and
the direction is to reuse the real `GearManager` rather than rebuild it. And the
same two blockers applied — it could only run against live gear commitments, and
it couldn't render on the preview deploy at all.

This one had a third, worse problem:

```js
const LEDGER = doc(db, 'gear', 'ledger');   // GearManager.jsx, line 17
```

That ran at **module scope**. Merely `import`ing the component initialised
Firebase — before any route decided whether to render it. A lazy route boundary
wouldn't have saved us, and neither would a prop.

## What changed

`GearManager` no longer knows where its data lives. Everything moved to
`src/utils/gearActions.js` behind `createFirestoreGearActions({ adminName })`:

| Operation | Was |
|---|---|
| `subscribe(onNext, onError)` | the `onSnapshot(LEDGER, …)` in the component's effect |
| `claim({ type, returnDate, addToGame, takeDate, player })` | `claimGear`'s transaction + role writes |
| `cancel(commitment)` | `cancelCommitment`'s transaction + role clearing |
| `markReturned(commitment, onTime)` | `markReturned` |
| `reassign(commitment, account)` | `reassign`'s role moves + patch |
| `resolvePerson({ e164, name })` | the `ensureAccountByPhone` / `ensureAccount` fork |
| `addManual({ … })` | `addManual`'s transaction + role writes |

The module-level `setGearRole` helper moved in with them, as a closure.

**`subscribe` is the notable addition over the admin seam.** Reading is a data
concern too, so the live listener belongs behind the seam — the component is
handed commitments and never learns where they came from. That is what removed
the module-scope Firestore call: the ledger ref is now built inside the factory,
when someone actually asks for it.

`actions` is a **required** prop with no default. A component that can fall back
to Firestore on its own is exactly what the seam exists to prevent.

### One constraint the seam imposes

The `actions` object must be **stable across renders** — the subscription is
keyed on it, so a factory called inline in JSX would tear down and re-subscribe
every frame. Both call sites wrap it in `useMemo`. It's called out in the prop's
comment so the next caller doesn't have to rediscover it.

## What did NOT change

- **The render is untouched.** Read the diff with `git diff -w` — the only edit
  is a `{showTake && (<>…</>)}` wrapper, and the whitespace churn is that block
  being indented one level.
- `GearAdmin` (the sub-component) is byte-for-byte identical.
- Every rule still lives in `utils/gear.js`, uncovered by this change:
  `pickFreeSet`, `returnSlotsLeft`, `playerReturnDates`, coverage, the balls
  priority gate.
- All confirmations, prompts, alerts and busy state stayed in the component.
  The seam returns values or throws; it never talks to the user.

## Deliberate differences

Three, all small, all listed so review doesn't have to hunt for them:

1. **`showTake`** (default `true`, so production is unaffected). The redesign
   passes `false` to hide the "🎒 Gear for {date}" block, because choosing a set
   moved onto the gear tiles. Production keeps it.
2. **`adminName` is no longer a prop.** It stamps who performed an admin write,
   which is the factory's business now. `App.jsx` passes it there instead.
3. **`reassign` and `markReturned` now set `busy`, and `reassign` catches.**
   Previously `reassign` inherited `busy` from the inner `patchCommitment` call
   and had no `catch` at all — an error was an unhandled rejection. Preserving
   the old structure exactly would have meant losing the busy state when
   `patchCommitment` stopped being a component-level function.

`patchCommitment` is gone from the component: it existed only to serve
`markReturned` and `reassign`, both of which now call the seam directly. It
lives on inside `gearActions.js` as an internal helper, not an exposed
operation — nothing outside needs a blind field patch.

## Risk, stated plainly

`GearManager` had **no test coverage** — this is the code that tracks physical
club property and auto-adds people to match rosters.

Mitigations now in place:

- `src/utils/gearActions.test.js` asserts both implementations expose the same
  operations, asserts the ledger ref is built per factory call (the module-scope
  regression, guarded), and covers the mock's subscribe / cancel / unsubscribe.
- The full suite passes: **76 tests**.

Residual risk is the extraction itself — a handler body moved incorrectly. That
is what review should focus on, and it's mechanical to check: each method in
`utils/gearActions.js` should be identical to the old handler body minus its
`try/catch`, `setBusy`, and `window.*` lines.

The one place to look hardest is `setGearRole`. It writes roster rows and
deletes them, it is called with `null` to clear, and every caller pairs a take
day with a return day. It moved verbatim; confirm that it did.

## How to verify

```bash
npm run build && npx eslint src/ && npm test
```

```bash
git diff main -w -- src/components/GearManager.jsx
```

The second command should show the handler bodies collapsing to `actions.*`
calls, the import list shrinking, and nothing else in the render.

Then in the running app, signed in as an admin: take a set, cancel it before
you've picked it up, mark one returned, reassign one, and add one manually.
Check after each that the roster on the affected day gained or lost the person
as expected — that is the half of gear that isn't in the ledger.

## Merge path

When the redesign merges, the gear route swaps one line — mock actions become
`createFirestoreGearActions()` — and the panel is live. Nothing else to rewrite.
