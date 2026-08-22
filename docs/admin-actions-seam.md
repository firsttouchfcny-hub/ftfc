# Admin actions seam — refactor notes for review

**Status:** proposed, on `design/redesign-exploration`
**Touches production code:** yes — `AdminPanel.jsx`, `App.jsx`, plus a new `utils/adminActions.js`
**Behaviour change:** none intended. This is a pure extraction.

---

## Why

The redesign needs to show the admin tools. The design direction is explicitly
*"same settings we have today, no UI changes or mechanism"* — so the goal was to
reuse the real `AdminPanel`, not rebuild it.

That wasn't possible as written. `AdminPanel` imported Firestore directly and
made 19 write calls inline, which meant:

- It could only ever run against **live production data**. Rendering it in a
  design prototype would let a stray click suspend or delete a real player.
- It couldn't render at all on the **preview deploy**, which has no Firebase
  credentials — so the team couldn't review it on a phone.

Copying the markup into the redesign would have solved both, at the cost of a
second copy that drifts, and whose handlers would all need rewriting when the
redesign merges. The requirement was that this be *set up correctly for main*,
so a copy was the wrong answer.

## What changed

`AdminPanel` no longer knows where its data lives. All data operations moved
behind a factory, and whoever renders the panel supplies one:

| Caller | Actions passed | Result |
|---|---|---|
| `App.jsx` (production) | `createFirestoreAdminActions()` | Identical to today |
| Redesign `/r/profile/admin` | `createMockAdminActions()` | In-memory, safe to click |

Three files:

- **`src/utils/adminActions.js`** (new) — the 17 operations, moved verbatim out
  of the component. Data only: each one returns a value or throws.
- **`src/components/AdminPanel.jsx`** — keeps all UI: state, toasts, confirms,
  form handling. Its handlers now delegate to `actions.*` inside the same
  `try/catch` they always had. **It no longer imports Firebase at all.**
- **`src/App.jsx`** — passes the Firestore actions. 4 added lines.

## What did NOT change

- **The rendered UI.** Everything from the `── Render ──` marker down is
  untouched — same markup, same classes, same layout. Verify with
  `git diff` on that region: it is empty.
- **What the operations do.** Handler bodies were moved, not rewritten. The
  Firestore calls, batching, uid resolution, strike escalation and suspension
  maths are character-for-character the same.
- **Production wiring.** `App.jsx` renders the panel in the same place under the
  same condition; only the `actions` prop was added.

Two props were dropped from `AdminPanel` (`today`, `adminName`) because they
only ever fed the Firestore paths and the strike author. They now go to the
actions factory, which is what needs them.

## Incidental fixes

The refactor left the file lint-clean, from **3 pre-existing errors** to zero:

- A `react-hooks/purity` error (`Date.now()` during render) disappeared when
  that code moved into a plain module.
- Two "cannot access variable before it is declared" errors are gone: the data
  loaders are now declared above the effects that call them, wrapped in
  `useCallback` with honest dependency lists.
- `react-hooks/set-state-in-effect` is disabled on those two effects, with the
  reason inline: they set state *after* an `await`, not synchronously, and the
  rule can't see through the async boundary.

## Risk, stated plainly

`AdminPanel` had **no test coverage** — this is the code that suspends players
and issues strikes, and nothing guarded it.

Mitigations now in place:

- `src/utils/adminActions.test.js` asserts both implementations expose the
  **same operations**, so the two can't silently drift, and covers the mock's
  behaviour (bulk-add dedupe, strike escalation, non-destructive undo).
- The full suite passes: **64 tests**.
- The riskiest logic (strike counting, suspension dates) still runs through
  `helpers.js`, which is covered by the existing tests.

Residual risk is the extraction itself — a handler body moved incorrectly. That
is what review should focus on, and it's mechanical to check: each
`utils/adminActions.js` method should be identical to the old handler body minus
its `try/catch`, toast, and form-reset lines.

## How to verify

```bash
npm run build && npx eslint src/ && npm test
git diff main -- src/components/AdminPanel.jsx   # render region should be unchanged
```

Then in the running app: open the admin panel as an admin and exercise Roll
Call, Bulk Add, Admins & Verification, Manage Players and Issue Strikes. All
five should behave exactly as before.

## Merge path

When the redesign merges, the admin route swaps one line — mock actions become
`createFirestoreAdminActions()` — and the panel is live. Nothing else to rewrite.
