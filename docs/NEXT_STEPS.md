# FTFC — Next-day recommendations

_Written 2026-07-29, after the uid-keyed identity refactor shipped to production._
State now: identity anchors on `accounts/<uid>`; roster + gear key by uid; admin
gear-add & strikes resolve by phone; renames sync to the roster + gear ledger.
50 unit tests pass. This lists what's left, most important first.

## Tier 1 — correctness (do first)

1. **Resolve display names by uid at render (the definitive rename fix).**
   Today the roster row `name`, gear `takerName`, and the badge lookup all trust
   *stored snapshots*. A rename syncs today's roster row + the gear ledger, but
   NOT future-dated roster rows created by gear commitments — so a future
   session can show the old name and drop the gear badge (badges match by name).
   Fix: build a `uid → currentName` map (only for the uids actually shown) and
   resolve names/badges from it at display time. Eliminates the whole class:
   stale future rows, dropped badges, and same-name mix-ups in one move.
   _Files: App.jsx (gearRoles build, PlayerList/GearManager props), helpers.js
   (buildFlatList could key gearRoles by uid instead of name)._

2. **Strikes: stop under-counting after a rename.**
   `activeStrikesFor` counts strikes under the account uid + the *current*
   normalized name. Strikes filed under a person's OLD name are missed, so a
   renamed repeat-offender can be under-suspended. Fix: one-off migration to
   backfill `playerUid` onto every existing strike (resolve `playerName` →
   account), then counting by uid alone is complete.

3. **Clean up leftover duplicate accounts.**
   Unverified name-dupes still exist (e.g. "Will Escobar" ×2 next to verified
   "Escobar"; "Miguel" ×3). These aren't auto-merged by design (two people CAN
   share a name). Build a small admin **"merge A into B"** action (re-point
   roster + gear + strikes to the keeper, delete the loser) and surface a
   review list of same-name accounts.

## Tier 2 — UX / robustness

4. **No more silent dead-ends.** If "In"/"Out" can't find the person's row
   (name-only match, admin-added row on another device), it currently `return`s
   with no feedback. Give a toast, and let sign-out match the same way sign-in
   does so an admin-added player can always drop themselves.

5. **Onboarding orphan.** If someone verifies a new number then refreshes at the
   name-entry step, the SMS is spent, no account/name was saved, and they're
   forced through verification again. Persist the verified phone (localStorage)
   across that step so a refresh resumes instead of restarting.

6. **`phoneOwnedByOther` is dead code.** Either wire it into PhoneVerify as the
   guard against stamping one number onto a second account, or delete it.

## Tier 3 — performance, cost, hygiene

7. **`ensureAccount`/`findAccountByName` scan the whole `accounts` collection**
   on every name resolution (gear-add, strike, bulk-add). At ~520 accounts and
   growing that's a real read-cost/latency hit, especially bulk-add (N scans in
   a loop). Add an indexed query (by normalized name / phone) or a cached map.

8. **`getToday`/`getTomorrow` use device-local time** while everything else is
   Eastern. Audit callers; standardize on the Eastern helpers to avoid a
   midnight off-by-one for non-Eastern users.

9. **Security debt (pre-existing, but this is a public prod app):**
   - Firestore rules are blanket-public (`allow read, write: if true`). Anyone
     can read/write any doc. Add real rules (validate shape, restrict writes).
   - The admin PIN `ftfc2025` is hardcoded in the shipped bundle (view-source).
     Move admin auth to the account `isAdmin` flag + a real check.

## Tier 4 — features (deferred, need the Functions backend)

10. **Auto-promote the bench + notify** when someone drops (Eventbrite-style
    waitlist): promote the next by signup time, text/push them. This is the
    long-planned Phase 2.

11. **Admin type-ahead against existing accounts** for name entry (bulk-add,
    grant admin) — suggests known players as you type, so a variant never forks
    a new identity. Complements the phone-first entry already shipped.

## Known limitations shipped (acceptable for now)
- Future-dated match-list rows self-heal only when that day becomes "today" and
  the person is active (superseded by Tier-1 #1).
- Bulk Add stays name-based on purpose (new people / +1s).
