# FTFC Redesign — Screen & State Inventory

A working checklist of every screen × every state for the redesign, so we can
see at a glance what's designed and what still needs a mockup before we build.

**Status legend:** ✅ Designed (mockup exists) · 🟡 Partial (some states drawn) · ⬜ Missing

**Logic anchors** (from the current app, all times US Eastern):
- Windows: **10 AM** list resets → admins can sign up · **11 AM** gear opens (everyone) · **3 PM** roll call opens (everyone) · **6 PM** (eve) taking-home alert · **9 PM** Match 2 decision
- Roster caps: **Match 1 = 18** · **Match 2 confirms at 30**, cap **36** · **37+ = bench**
- Gear need per game: **2 Goals · 1 Balls · 1 Bibs** (4 slots) · balls-gate: Balls locked until Goals & Bibs are exhausted
- Games run **Mon–Fri**; weekends show Monday's game (already open since Fri 3 PM)

---

## 0. Cross-cutting states (apply across screens)

| State | Status | Notes |
|---|---|---|
| Loading (session / gear ledger) | ⬜ | Skeleton vs spinner; avoid the false "gear at risk" flash |
| Empty roster (0 signed up) | ⬜ | First person to sign up sees an empty list |
| Offline / error | ⬜ | Firestore unreachable; read-only fallback |
| Suspended user | ⬜ | Can't sign in or take gear; suspension banner + appeal path |
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
| Skipped photo → initials fallback | 🟡 | Fallback shown in roster ("JC"), not in flow |
| **Returning user sign-in** | ⬜ | Existing account: phone → OTP → home (distinct from "create") |

---

## 2. Home / roll-call screen (the standalone sign-up screen)

**Time-window variants**

| Variant | Status | Notes |
|---|---|---|
| Before 10 AM — closed | ⬜ | Nothing to join yet; countdown to 10 AM reset? |
| 10–11 AM, non-admin | ⬜ | **Gap:** roll call closed *and* gear not open — countdown, no gear tiles |
| 11 AM–2:55 PM, non-admin — countdown + gear | ✅ | "Or take gear and skip the wait" |
| 3 PM–8:59 PM, everyone — I'm in / +1 | ✅ | |
| 10 AM–8:59 PM, admin — I'm in / +1 | ✅ | Admin signs up early |
| After 9 PM / overnight | ⬜ | Post-Match-2-decision; does sign-up stay open until the game? |
| Suspended user variant | ⬜ | Buttons disabled + banner |

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
| You're in — Match 1 | ✅ | Screenshot 5 |
| You're in — Match 2 confirmed (30+) | ⬜ | Headline/subcopy differ |
| Match 2 ON HOLD (<30, decides 9 PM) | ⬜ | "waiting for N more · decides 9 PM" |
| Match 2 cancelled (past 9 PM, <30) | ⬜ | You were Match 2 → not playing |
| Bench (#N in line) | ⬜ | 37+ |

**Roster list**

| Element / state | Status | Notes |
|---|---|---|
| Match 1 section (top 18) | ✅ | |
| Match 2 section (18) — confirmed / on-hold / off | ⬜ | Styling differs by state |
| Bench section | ⬜ | |
| Row — gear bringer badge (🥅 Goals) | ✅ | |
| Row — bringer badge ⚽ Balls / 🧺 Bibs variants | ⬜ | Only Goals shown; respect caps (2/1/1) |
| Row — gear taker | ⬜ | Tier below bringer, above admin |
| Row — admin (crown), no gear | ⬜ | Pure-admin treatment |
| Row — Friday gear-priority | ⬜ | Bumped up on Fridays |
| Row — you (highlight) | ⬜ | Self-locator in a long list |
| Row — +1 guest | ⬜ | Sub-row under the host |
| Row — long name / initials fallback | ✅ | Both handled |

**Actions & overlays on this screen**

| Element | Status | Notes |
|---|---|---|
| Gear takers strip ("Tomorrow's gear takers") | ✅ | Align label to taker/bringer vocabulary |
| Out / leave + confirm | ⬜ | Removes you; logs a drop |
| Drops log (game drops vs bench drops) | ⬜ | Kept |
| ⚠️ Gear at risk alert | ⬜ | Kept — nobody bringing gear in |
| ⏳ Nobody taking gear home alert | ⬜ | Kept — from 6 PM |

---

## 4. Top navigation (persistent)

| Element | Status | Notes |
|---|---|---|
| Rules button (top-left) | ⬜ | Per decision |
| Gear detail icon(s) (top-left) | 🟡 | Icons shown; destinations below |
| Profile avatar (top-right) | ✅ | Opens profile + admin panel |
| Admin-only affordances | ⬜ | Admin panel entry lives in profile |
| Alert/unread indicators | ⬜ | Optional — surface gear-at-risk in nav? |

---

## 5. Rules screen

| State | Status | Notes |
|---|---|---|
| Rules & code of conduct | ⬜ | Content screen from top-left button |

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
| Profile settings (name, photo, phone, verified) | ⬜ | |
| Edit name / photo | ⬜ | |
| My gear commitments (+ cancel) | ⬜ | "You're bringing X back Y" |
| Suspension status | ⬜ | If suspended |
| Admin panel entry (admins only) | ⬜ | → section 8 |
| Log out | ⬜ | |

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

- **Designed:** ~10 screens/states (the happy paths across all four flows)
- **Biggest missing clusters:** Match 2 / Bench outcome variants · gear tile sub-states · roster row variants · the three detail surfaces (Rules, Gear, Profile) · the entire Admin panel
- **Design-the-data-model-first item:** identity moving from device → phone account, first/last name split, and profile-photo storage — settle this before screens, since roster + gear + identity all depend on it.

**Suggested build order:** (1) design tokens → (2) identity/data model + account flow → (3) routing skeleton + top nav → (4) home roll-call screen (all window variants) → (5) game + roster (all outcome variants) → (6) gear tile states → (7) detail surfaces → (8) admin panel.
