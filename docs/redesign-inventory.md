# FTFC Redesign — Screen & State Inventory

A working checklist of every screen × every state for the redesign, so we can
see at a glance what's designed and what still needs a mockup before we build.

**Status legend:** ✅ Designed (mockup exists) · 🟡 Partial (some states drawn) · ⬜ Missing · ➖ Dropped (intentionally not building) · **🔨 Built** (coded on the redesign branch, viewable at `/r`)

**Logic anchors** (from the current app, all times US Eastern) — *refreshed after merging main 2026-08-10*:
- Windows: roll call opens **the day before the game** — **10 AM** list resets → admins sign up **+ gear opens** *(redesign decision; production opens gear at 11 AM)* · **3 PM** roll call opens (everyone), staying open through the game morning until the 10 AM reset · **6 PM** (eve) taking-home alert · **9 PM** Match 2 decision
- Roster caps: **Match 1 = 18** · **Match 2 confirms at 30**, cap **36** · **37+ = bench**
- Gear need per game: **2 Goals · 1 Balls · 1 Bibs** (4 slots) · balls-gate: Balls locked until Goals & Bibs are actually taken
- Games run **Mon–Fri**. **Changed on main:** a game 2+ days out is now `closed` — Monday's roll call opens **Sunday** 3 PM, no longer Friday. So Fri evening/Sat are genuinely closed.
- **You can't drop or cancel while holding gear** (it would strand the set)
- A **+1 added after signup takes a back-of-line spot**, not the host's (`plusOnesAt`); a +1 taken *at* signup still sits with its host
- Identity is **uid-keyed / phone-first** (`newUid`, `isSamePerson`, `rosterDocId`, one phone = one account)

**🔨 Built so far** (redesign branch, at `/r`): design tokens — color (incl. the new **Expressive** set) + type · routing shell + 6 screens · the **frosted sticky top nav** (progressive blur + olive scrim) · the **home roll-call screen — all 4 variants** (waiting w/ live countdown, open, admin, suspended) · the **"You're in" game screen** — confirmation header, gear-takers, and the full **Match 1 / Match 2 / Bench roster table** with all three **Match 2 states** (confirmed · on-hold · cancelled — top message *and* section header, driven by `getMatch2State`). Reusable components: `GameHeader`, `Confirmation`, `GearTile`, `GearTakers`, `Fab`, `StatusBadge`, `ProgressiveBlur`, `Avatar`, `PlayerAvatar`, `PlayerRow`, `RosterSection`, `TableCard`, plus the mock-identity seam. Also built: the **Rules & code of conduct** content screen + the top-nav **back** variant it uses.

---

## 0. Cross-cutting states (apply across screens)

| State | Status | Notes |
|---|---|---|
| Loading (session / gear ledger) | ⬜ | Skeleton vs spinner; avoid the false "gear at risk" flash |
| Empty roster (0 signed up) | ⬜ | First person to sign up sees an empty list |
| Offline / error | ⬜ | Firestore unreachable; read-only fallback |
| Suspended user | 🟡 🔨 | Home suspended screen built; appeal path + other screens' suspended states TBD |
| Admin vs non-admin | 🟡 | Admin sees early sign-up + admin panel entry; toggled everywhere |
| Weekend (Mon's game shown) | ⬜ | Sat/Sun display Monday, already open |

---

## 1. Account & identity flow

| Screen / state | Status | Notes |
|---|---|---|
| Create account — phone entry | ✅ | +1 country code, "we'll send an SMS code" |
| ↳ invalid phone / send error | ⬜ | Bad number, SMS failed to send |
| Create account — OTP verify | ✅ | 6-box code, "Try again" resend |
| ↳ wrong / expired code | ⬜ | Error + resend states |
| Add your name (first / last) | ✅ | **Data-model change:** splits today's single `name` field |
| ↳ validation / empty | ⬜ | |
| Add profile pic — empty | ✅ | Selfie / Upload / Skip |
| ↳ capturing / uploading | ⬜ | Camera + upload-in-progress |
| Add profile pic — filled | ✅ | Continue |
| Skipped photo → initials fallback | 🟡 🔨 | Built in roster (`PlayerAvatar`); the account-flow step still TBD |
| **Returning user sign-in** | ⬜ | Existing account: phone → OTP → home (distinct from "create") |

---

## 2. Home / roll-call screen (the standalone sign-up screen)

**Time-window variants**

| Variant | Status | Notes |
|---|---|---|
| Closed — before 10 AM, **or 2+ days out** | ⬜ | **Grew after the main merge.** Roll call now opens the day before the game, so Fri evening/Sat are genuinely closed for Monday's game. Today `useRollCallWindow` folds `closed` into `waiting`, which shows a multi-hour countdown — needs its own designed state |
| 10 AM–2:55 PM, non-admin — countdown + gear | ✅ 🔨 | Built · live countdown to 3 PM ET; gear available from 10 AM |
| 3 PM–8:59 PM, everyone — I'm in / +1 | ✅ 🔨 | Built |
| 10 AM–8:59 PM, admin — I'm in / +1 | ✅ 🔨 | Built · same screen as "open", shown early to admins |
| After 9 PM / overnight | ⬜ | Post-Match-2-decision; does sign-up stay open until the game? |
| Suspended user variant | ✅ 🔨 | Built · strike message, no actions (frame 2934:3005) |

**Gear tile sub-states** (4 tiles: Goals, Goals, Balls, Bibs)

| State | Status | Notes |
|---|---|---|
| Available (`+`) | ✅ | |
| Taken → shows **taker's avatar** in place of `+` | ⬜ | Per design decision — indicates who grabbed it |
| Locked (balls-gate) | ⬜ | Balls disabled until Goals & Bibs exhausted; needs a clear locked look |
| None left / fully covered | ⬜ | Slot count hit (2 goals / 1 balls / 1 bibs) |
| Yours (you took it) | ⬜ | Your avatar + cancel affordance |

---

## 3. Post-sign-up — "You're in" (game details + roster)

**Outcome variants** (what you land on after signing up)

| Variant | Status | Notes |
|---|---|---|
| You're in — Match 1 | ✅ 🔨 | Built |
| You're in — Match 2 confirmed (30+) | ✅ 🔨 | Built (default game screen) |
| Match 2 ON HOLD (<30, pre-9pm) | ✅ 🔨 | Built · top "In match 2 waitlist" + orange pill; section "Match 2 on hold" + count · dimmed (`?match2=onhold`) |
| Match 2 cancelled (past 9 PM, <30) | ✅ 🔨 | Built · top "No game — match 2 cancelled"; section "Match 2 — NO GAME" · dimmed (`?match2=cancelled`) |
| Bench (#N in line) — my standing | ✅ 🔨 | Built · "You are Nth in bench" (dynamic ordinal); `?standing=bench` |

**Roster list** — 🔗 *now built by the real production logic:* the screen calls `buildFlatList` from `src/utils/helpers.js` with a production-shaped mock (`mockPlayers` + `mockGearRoles` + `mockGearPriorityNames`), so tiering (bringers → takers → admins/pinned → Friday gear priority → rest, then signup time), the 18/18/overflow slicing, and +1 expansion are all genuine. Only the *data source* is mocked — swapping it for Firestore is the remaining seam.

| Element / state | Status | Notes |
|---|---|---|
| Match 1 section (top 18) | ✅ 🔨 | Built · in a Cream `TableCard` |
| Match 2 section (18) — confirmed / on-hold / off | ✅ 🔨 | Built · all three states (header + icon + dimming) |
| Bench section | ✅ 🔨 | Built · own card; only shows on 37+ overflow |
| Row — gear bringer badge (🥅 Goals) | ✅ 🔨 | Built |
| Row — bringer badge ⚽ Balls / 🧺 Bibs variants | ✅ 🔨 | Built · badge takes any gear emoji |
| Row — gear taker | ➖ | **Dropped** — gear *takers* are shown by their avatar in the "Tomorrow's gear takers" strip, so no roster-row badge (keeps the table uncluttered). Note: gear *bringers* still get the "Bringing 🥅" badge. |
| Row — admin (crown), no gear | ✅ 🔨 | Built · crown badge on avatar |
| Row — Friday gear-priority | ✅ 🔨 | Built · Tan/20% "Priority" badge (`priority` prop); mirrors prod suppression (hidden for bringers/admins). Real eligibility (took a set home Mon–Thu, Fridays only) + the position bump come from the gear ledger via `fridayGearPriorityNames`/`buildFlatList` when data is wired |
| Row — you (highlight) | ✅ 🔨 | Built · Tan/40% inset pill, 16px radius (`you` prop, matched via `useCurrentUser`); rows padded 8px so the highlight insets from the card edge |
| Row — +1 guest | ✅ 🔨 | Built · own roster slot repeating the host's avatar + name with a Tan/60% "+1" badge (`plusOne` prop) |
| Row — long name / initials fallback | ✅ 🔨 | Both handled (`PlayerAvatar` photo/initials, name truncates) |

**Actions & overlays on this screen**

| Element | Status | Notes |
|---|---|---|
| Gear takers strip ("Tomorrow's gear takers") | ✅ 🔨 | Built · shared `GearTakers` component |
| **Floating action bar** (Add a +1 · Out) | ✅ 🔨 | Built · `BottomActions`, 32px above the viewport bottom; slides down on scroll-down and back up on scroll-up (frame 3024:5347) |
| ↳ "Add a +1" action | ✅ 🔨 | Built · wired to state; sets `plusOnesAt` so a late guest takes a **back-of-line** spot (matches main `3db7b27`). Production has this too (`21b59ae`) — it is *not* redesign-only |
| ↳ "Add a +1" — already have one | 🟡 | Capped at 1; button disabled as an interim. **Needs a designed state** — production supports **remove** as well (`21b59ae` "add/remove a +1 … no drop, keeps your spot"), so this most likely wants to become a "Remove +1" affordance |
| Out / leave — action | ✅ 🔨 | Built · removes you from the list and returns to roll call |
| **Dialog pattern** (shared) | ✅ 🔨 | Built · `Dialog` (frame 3155:9399) — black 20% scrim, card 20px from the sides and 40px from the viewport bottom, Cream/radius 24/padding 24. Optional 48px icon + optional headline (**at least one required**, warned in dev) over body copy; buttons are either cancel+confirm or a single primary. Escape and scrim-tap dismiss; page scroll locks while open. The 56px pill `Button` is now shared with the action bar |
| ↳ Out — confirm step | ✅ 🔨 | Built (frame 3050:5354) · "Are you sure?" / "If you drop out you will lose your current spot and signing up again might not guarantee a spot" · Cancel · **Yes, I'm out** → drops you and returns to roll call |
| ↳ Out — blocked while holding gear | ✅ 🔨 | Built (frame 3159:9425) · the **icon-only** variant — no headline, warning icon over a body whose bold lead-in names the gear *and its emoji* ("You're holding Goals 🥅 — …"), single **Got it** |
| ↳ Out after the 9 PM deadline — strike warning | ✅ 🔨 | Built (frame 3159:9446) · "Are you sure? If you drop, you'll receive a strike." + Cancel / **Yes, I'm out**. Gated by `isPastDropDeadline()`; preview with `?deadline=passed`. **This is the first time the 9 PM rule exists as code** — production only ever stated it as text in `Rules.jsx`. Uses the `America/New_York` zone, so 9 PM stays 9 PM local across DST |
| ↳ Strikes stay manual (**decided**) | ➖ | The app issues **no** strike — the dialog only warns. Admins read the **drops log** and assign strikes off-app. That makes the drops section load-bearing for enforcement: it must show *who* dropped and *when*, and distinguish game vs bench drops — which it does |
| Drops log ("Drops today") | ✅ 🔨 | Built · `DropsCard` (frames 3055:9097 / 3055:9199) · own Cream card below the Bench, or below Match 2 when there's no bench · newest first via `formatTimeET`, clears at the 10 AM rollover · rows are the shared `PlayerRow` with no position + a trailing time |
| ↳ Drops — game vs bench split | ✅ 🔨 | **Kept** (confirmed) — the two mean different things, so they stay separate: "From the game (N) — opened a spot" and "From the bench (N) — no game impact", divided like the Match 1/2 card. 🎨 The Figma frame shows one flat list, so the grouping reuses the roster's muted-label + divider pattern as an interim — **the split's own visual treatment still needs a frame** |
| ↳ Drops — row data requirements | 🟡 | **Confirmed intent:** an admin who drops shows the **admin flag**; rows use the **avatar**, falling back to **two-letter initials** when there's no photo; a dropping **+1 shows the "+1" badge**. Built and working on mock data. ⚠️ Production's drop record is only `{ name, deviceId, at, fromBench }` — to wire this for real the drop must carry the person's `uid` (identity is uid-keyed now) so the profile resolves at render |
| ⚠️ Gear at risk alert | ⬜ | Kept — nobody bringing gear in · `gearBringingAlert()`, shows from the 10 AM reset until coverage is filled |
| ⏳ Nobody taking gear home alert | ⬜ | Kept — from 6 PM · `gearTakingAlert()`, gated by `GEAR_ALERT_HOUR_ET` |

---

## 4. Top navigation (persistent)

| Element | Status | Notes |
|---|---|---|
| Rules button (top-left) | ✅ 🔨 | Built · exact icon; frosted sticky nav |
| ↳ Back variant (detail surfaces) | ✅ 🔨 | Built · single Cream back-arrow pill; shown on `/rules`; `navigate(-1)` returns to prior screen |
| Gear detail icon(s) (top-left) | ✅ 🔨 | Built |
| Profile avatar (top-right) | ✅ 🔨 | Built · photo / initials fallback; opens profile + admin |
| Admin-only affordances | ⬜ | Admin panel entry lives in profile |
| Alert/unread indicators | ⬜ | Optional — surface gear-at-risk in nav? |

---

## 5. Rules screen

| State | Status | Notes |
|---|---|---|
| Rules & code of conduct | ✅ 🔨 | Built · headline + 5 sections (Schedule & location, Roll call, What results in a strike? + sick note, Strike consequences 5×2 table, Emergency contacts) · uses the nav **back** variant · contacts list mocked (real = admin roster) |

---

## 6. Gear details (from top-nav)

| Screen / state | Status | Notes |
|---|---|---|
| Who has gear now (current holders / out) | ⬜ | |
| Gear schedule (upcoming mornings) | ⬜ | Per-day coverage chips (🥅 2/2 etc.), bringing-in vs taking-home |
| ↳ day covered / short | ⬜ | |
| Take / return actions here | ⬜ | If gear can be claimed from this surface too |

---

## 7. Profile (from avatar)

| Element / state | Status | Notes |
|---|---|---|
| Profile — view (non-admin) | ✅ 🔨 | Built (frame 3159:9458) · back-nav; vertically centred 200px avatar + camera button, name, formatted phone, "Edit profile". Uses the nav's back variant |
| ↳ Profile photo — upload | ✅ 🔨 | Built · the camera button opens the OS picker via `<input type="file" accept="image/*">`. **No `capture` attribute on purpose** — that would force the camera; without it iOS offers Take Photo / Photo Library / Browse. The pick previews immediately (object URL, revoked on replace/unmount) |
| ↳ Profile photo — none uploaded | ✅ 🔨 | Built · falls back to the initials avatar (72px "CL" on Tan); preview with `?photo=none` |
| Edit name / last name / phone | ✅ 🔨 | Built (frame 3233:12478) · back-nav, centred heading, First/Last name + a phone row ("+1" chevron control × the number), Save pinned to the bottom. Reached from "Edit profile" |
| ↳ Required-name validation | ✅ 🔨 | Built · clearing either name and saving puts that field in the **error variant** (Red border + message) and blocks the save; typing clears it |
| ↳ Save actually persists | ✅ 🔨 | The identity seam is now a small **writable store** (`updateCurrentUser`): saving a name updates the profile, the nav avatar and the roster row together. Picking a photo writes through the same seam. In-memory, so a reload resets it — same as the roster mock |
| ↳ Rename propagates to the roster | ✅ 🔨 | The roster row resolves the current user's name and photo **by uid at render**, mirroring production's `45e8813` "definitive rename fix", so a rename shows up in the list. The "you" highlight matches via production's `isSamePerson` (uid first), so it survives a rename too |
| ↳ Phone change → verification | 🟡 🔨 | Change detected and surfaced ("You'll need to verify this number"). **The OTP step isn't built** — it belongs to the account-creation flow. The number is deliberately **not** written on save: in production it only takes effect once verified, so writing it early would show an unverified number as confirmed |
| **`InputField`** (shared component) | ✅ 🔨 | Built (frame 2666:7754) for reuse by the account-creation screens · four states — default (Tan), focused (Dark Gray + glow), error (Red + message), disabled — plus label, helper text, optional left icon and optional up/down chevron. All four verified in-browser |
| My gear commitments (+ cancel) | ➖ | **Not a profile feature** (confirmed). It exists in production but lives on the **Gear** surface (`GearManager.jsx`) — "🥅 You're bringing **Goals** back Tuesday" + Cancel. Keeping it there; tracked under §6. Note the real rule: cancel is only allowed *before* you take the gear home |
| Suspension status | ➖ | **Exists in production but not on the profile** — it's a banner on the roll-call screen (`App.jsx`: "🚫 You are suspended until … Contact an admin to appeal") and already built as the home suspended variant. Not in the profile frame, so not duplicated here |
| Admin panel entry (admins only) | ⬜ | → section 8 · not in the non-admin frame; needs an admin variant of this screen |
| Log out | ⬜ | Not in the current frame |

---

## 8. Admin panel (inside profile)

| Function / state | Status | Notes |
|---|---|---|
| Roll call open/close override | ⬜ | Phase-scoped override |
| Manage players (add / remove / drop) | ⬜ | |
| Suspensions (suspend / unsuspend / strikes) | ⬜ | Escalating durations |
| Admin badge grant / revoke | ⬜ | |
| Gear ledger — assign / reassign | ⬜ | |
| Gear ledger — mark returned / late / remove | ⬜ | |
| "Someone already has it" onboarding | ⬜ | Held-gear entry |

---

## Gap summary

- **🔨 Built:** the home roll-call screen (4 variants) and the "You're in" game screen (roster table + all Match 2 states) are done on the mock seam; tokens + frosted nav in place.
- **Biggest missing clusters:** gear tile sub-states (taken → avatar, locked) · the account-creation flow · two detail surfaces (Gear, Profile) · the entire Admin panel — the roster rows are now all built
- **~~Design-the-data-model-first item~~ → RESOLVED on main (merged 2026-08-10).** Identity is now **uid-keyed and phone-first**: `newUid()` mints a stable per-person id, `isSamePerson()` is the single matcher (uid → deviceId → name), `rosterDocId()` makes "one person = one row" true by construction, `toE164US()` canonicalizes numbers, and one phone = one account. The redesign's mock identity seam (`useCurrentUser`) should now be pointed at this real model — the proposal in `docs/data-model-proposal.md` is effectively answered. Still open for the redesign: the **first/last name split** and **profile-photo storage**, which main did not add.
- **Logic parity ledger** — what's real vs. still mocked:
  - ✅ Real: roster tiering + slicing + `+1` expansion (`buildFlatList`), Match 2 state (`getMatch2State`), roll-call windows/countdown/suspension, Friday-priority badge suppression.
  - ✅ Real: roster **mutations** too — "Out" and "Add a +1" write to local state and the list re-sorts through `buildFlatList` live.
  - 🟡 Mocked data source: `mockCommitments` (the gear ledger, in production's commitment shape) is now the single source — `mockGearRoles` is **derived** from it exactly as `App.jsx` does, and `mockPlayers` stands in for the Firestore session. `mockGearPriorityNames` is fixed so the badge is always previewable (production computes it only on Fridays). State is per-visit: it resets on reload, since there's no backend behind it yet.
  - ⬜ Not built: `player.priority` (admin per-day pin) has no UI yet — it ranks correctly but is only settable from the Admin panel.
  - ⚠️ Intentional rule delta: redesign opens gear at **10 AM**; production opens at **11 AM** (`GEAR_OPEN_HOUR_ET`). Don't "fix" this when wiring.

**Suggested build order:** (1) ✅ design tokens → (2) 🟡 identity/data model *(proposal open — awaiting team; screens built on a mock seam)* → (3) ✅ routing skeleton + top nav → (4) ✅ home roll-call screen (all variants) → (5) ✅ game + roster (table + Match 2 states) → (6) **← next: gear tile states** → (7) detail surfaces (Rules / Gear / Profile) → (8) admin panel.
