# FTFC Redesign — Screen & State Inventory

A working checklist of every screen × every state for the redesign, so we can
see at a glance what's designed and what still needs a mockup before we build.

**Status legend:** ✅ Designed (mockup exists) · 🟡 Partial (some states drawn) · ⬜ Missing · **🔨 Built** (coded on the redesign branch, viewable at `/r`)

**Logic anchors** (from the current app, all times US Eastern):
- Windows: **10 AM** list resets → admins can sign up **+ gear opens** *(redesign decision; the current app opens gear at 11 AM)* · **3 PM** roll call opens (everyone) · **6 PM** (eve) taking-home alert · **9 PM** Match 2 decision
- Roster caps: **Match 1 = 18** · **Match 2 confirms at 30**, cap **36** · **37+ = bench**
- Gear need per game: **2 Goals · 1 Balls · 1 Bibs** (4 slots) · balls-gate: Balls locked until Goals & Bibs are exhausted
- Games run **Mon–Fri**; weekends show Monday's game (already open since Fri 3 PM)

**🔨 Built so far** (redesign branch, at `/r`): design tokens — color (incl. the new **Expressive** set) + type · routing shell + 6 screens · the **frosted sticky top nav** (progressive blur + olive scrim) · the **home roll-call screen — all 4 variants** (waiting w/ live countdown, open, admin, suspended) · the **"You're in" game screen** — confirmation header, gear-takers, and the full **Match 1 / Match 2 / Bench roster table** with all three **Match 2 states** (confirmed · on-hold · cancelled — top message *and* section header, driven by `getMatch2State`). Reusable components: `GameHeader`, `Confirmation`, `GearTile`, `GearTakers`, `Fab`, `StatusBadge`, `ProgressiveBlur`, `Avatar`, `PlayerAvatar`, `PlayerRow`, `RosterSection`, `TableCard`, plus the mock-identity seam.

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
| Before 10 AM — closed | ⬜ | Nothing to join yet; countdown to 10 AM reset? |
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
| Bench (#N in line) — my standing | 🟡 🔨 | Bench *section* built; the "you're on the bench" standing message TBD |

**Roster list**

| Element / state | Status | Notes |
|---|---|---|
| Match 1 section (top 18) | ✅ 🔨 | Built · in a Cream `TableCard` |
| Match 2 section (18) — confirmed / on-hold / off | ✅ 🔨 | Built · all three states (header + icon + dimming) |
| Bench section | ✅ 🔨 | Built · own card; only shows on 37+ overflow |
| Row — gear bringer badge (🥅 Goals) | ✅ 🔨 | Built |
| Row — bringer badge ⚽ Balls / 🧺 Bibs variants | ✅ 🔨 | Built · badge takes any gear emoji |
| Row — gear taker | ⬜ | Tier below bringer, above admin — not distinctly styled yet |
| Row — admin (crown), no gear | ✅ 🔨 | Built · crown badge on avatar |
| Row — Friday gear-priority | ⬜ | Bumped up on Fridays |
| Row — you (highlight) | ⬜ | Self-locator in a long list |
| Row — +1 guest | ⬜ | Sub-row under the host |
| Row — long name / initials fallback | ✅ 🔨 | Both handled (`PlayerAvatar` photo/initials, name truncates) |

**Actions & overlays on this screen**

| Element | Status | Notes |
|---|---|---|
| Gear takers strip ("Tomorrow's gear takers") | ✅ 🔨 | Built · shared `GearTakers` component |
| Out / leave + confirm | ⬜ | Removes you; logs a drop |
| Drops log (game drops vs bench drops) | ⬜ | Kept |
| ⚠️ Gear at risk alert | ⬜ | Kept — nobody bringing gear in |
| ⏳ Nobody taking gear home alert | ⬜ | Kept — from 6 PM |

---

## 4. Top navigation (persistent)

| Element | Status | Notes |
|---|---|---|
| Rules button (top-left) | ✅ 🔨 | Built · exact icon; frosted sticky nav |
| Gear detail icon(s) (top-left) | ✅ 🔨 | Built |
| Profile avatar (top-right) | ✅ 🔨 | Built · photo / initials fallback; opens profile + admin |
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

- **🔨 Built:** the home roll-call screen (4 variants) and the "You're in" game screen (roster table + all Match 2 states) are done on the mock seam; tokens + frosted nav in place.
- **Biggest missing clusters:** gear tile sub-states (taken → avatar, locked) · a few roster row variants (you-highlight, +1 guest, gear-taker, Friday-priority) · the bench standing message · the account-creation flow · the three detail surfaces (Rules, Gear, Profile) · the entire Admin panel
- **Design-the-data-model-first item:** identity moving from device → phone account, first/last name split, and profile-photo storage — settle this before wiring real data, since roster + gear + identity all depend on it.

**Suggested build order:** (1) ✅ design tokens → (2) 🟡 identity/data model *(proposal open — awaiting team; screens built on a mock seam)* → (3) ✅ routing skeleton + top nav → (4) ✅ home roll-call screen (all variants) → (5) ✅ game + roster (table + Match 2 states) → (6) **← next: gear tile states** → (7) detail surfaces (Rules / Gear / Profile) → (8) admin panel.
