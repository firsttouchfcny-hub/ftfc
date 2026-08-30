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

**🔨 Built so far** (redesign branch, at `/r`): design tokens — color (incl. the new **Expressive** set) + type · routing shell (12 routes) · the **frosted sticky top nav** (progressive blur + olive scrim) · the **home roll-call screen — all 4 variants** (waiting w/ live countdown, open, admin, suspended) · the **"You're in" game screen** — confirmation header, gear-takers, and the full **Match 1 / Match 2 / Bench roster table** with all three **Match 2 states** (confirmed · on-hold · cancelled — top message *and* section header, driven by `getMatch2State`). Reusable components: `GameHeader`, `Confirmation`, `GearTile`, `GearTakers`, `Fab`, `StatusBadge`, `ProgressiveBlur`, `Avatar`, `PlayerAvatar`, `PlayerRow`, `RosterSection`, `TableCard`, plus the mock-identity seam. Also built: the **Rules & code of conduct** content screen + the top-nav **back** variant it uses. **Detail surfaces are now all in:** Profile + Edit profile, **Admin tools** (`/r/profile/admin`) and the **Gear panel** (`/r/gear`) — the last two render the *real production components* on an actions seam (`docs/admin-actions-seam.md`, `docs/gear-actions-seam.md`). Plus the shared **`Dialog`** pattern and its variants, the **`Button`**/**`IconButton`** state sets, and the **gear tile** sub-states (free / locked / taken-shows-avatar) with both commitment dialogs. **And the account-creation flow** (`/r/create-account`) — phone, OTP, name, photo, welcome — on a third actions seam, with new `CodeInput` and `OnboardingLayout` components.

---

## ⚠️ Open actions (not code — someone has to go do these)

| Action | Owner | Why it matters |
|---|---|---|
| **Set `VITE_ENABLE_REDESIGN=true` on Vercel → Preview only.** Leave Production unset. | Cristian | Until it's set, `/r` will **not load on the preview link**, so the team can't review on their phones. And if it were ever set on Production, players could reach an unfinished experience showing mock data and think they're signed up. |
| Set the same var in local `.env.local` (optional) | anyone | Local dev already enables it automatically; only needed to test the *disabled* path. |

---

## 0. Cross-cutting states (apply across screens)

| State | Status | Notes |
|---|---|---|
| Loading — roster & gear | ✅ 🔨 | **Built (2026-08-26):** skeletons, not spinners — the shape of what's coming is known, so placeholders reassure rather than just spin. Sized to the real elements (rows 325×48, gear tiles 48×72, 24px gap — measured against both) so nothing shifts on arrival. Gear deliberately shows **no "+"**: an unloaded tile and an unclaimed one are the same picture, so a plus would invite taking a set that's already gone. Pulse, not shimmer; `prefers-reduced-motion` keeps the shape and drops the animation. The **headline waits too** (2026-08-26) — "You're in" / "2nd in bench" / "No game" is a *claim* that depends on the roster still arriving, and its placeholder occupies the full 36px line so nothing shifts. Date, time and place never wait: they come from the clock and fixed copy. The **action bar is not rendered at all until the data lands**, then fades in (240ms, opacity only so it doesn't fight the scroll transform) — "Out" tapped before the roster arrives would act on a spot we can't confirm exists. Preview: `?loading=1` |
| Couldn't load / offline | ✅ 🔨 | **Built (2026-08-26).** Says it failed and offers **Reload**, rather than production's approach of timing out after 5–6s and presenting a *guess* as fact ("roll call is closed", "no gear") — which confidently misinforms anyone on a bad connection. **Offline is the same component with different words** ("You're offline / Check your connection"), keyed on `navigator.onLine`: "reload" is useless advice with no signal, and "check your connection" is insulting when the connection is fine. Two sizes — **section** for a partial failure (gear fails, roster stays usable) and **page** for a total one, since without the roster we know nothing about the screen, not even whether you're on the list. Preview: `?error=1` · `?error=offline` · `?error=gear`. The original sketch for this row proposed a **read-only fallback** (serve stale data behind a banner); superseded 2026-08-26 — showing a message and asking for a reload was judged more honest than presenting old data as current |
| ↳ App-level wait | ✅ 🔨 | **Built (2026-08-30):** a **spinner**, not a skeleton — the one wait where a placeholder would be dishonest. Which roll-call variant to show depends on the **session**, not just the clock (`isRollCallOpen(session)` lets an admin force it open or closed), so until it arrives we don't know whether this screen is a countdown or a pair of sign-up buttons. Drawing either would be a guess the player watches get corrected — and showing "opens in 4 hours" over an already-open roll call could cost someone their spot. After **5s** it falls through to **Couldn't load** rather than production's assume-closed, which presents a guess as fact. Rotation swaps to the skeleton pulse under `prefers-reduced-motion`. Preview: `?loading=1` on `/r` |
| ↳ **Submitting — "Signing in…"** | ✅ 🔨 | **Built (2026-08-30).** The tapped button reads "Signing in…" and both lock; on failure a line appears **directly under the buttons** — the button is what you tap to fix it. Wording follows the couldn't-load voice rather than inventing a third register: **"Couldn't sign you up. Tap to try again."**, and offline gets **"You're offline — check your connection and tap again."** because "try again" is useless advice with no signal. The message clears the moment a retry starts, so a stale error never sits over a live attempt. `role="alert"` + `aria-busy`. **Fixes a real production gap:** today the error goes to the console, the buttons quietly re-enable, and the player is left to infer from an unchanged list whether they're in. Preview: `?state=open&signup=failed` · `&signup=offline` |
| Empty roster (0 signed up) | ✅ 🔨 | **Built (2026-08-30):** the card with **"No players yet"** inside, rather than a set of section labels with nothing under them. ⚠️ **A safety net, not an experience** — its job is to not look broken. On this screen it is close to unreachable: you arrive by signing up, which puts you on the list, and taking gear auto-adds you too. It also can't be fully coherent here — the headline still reads "You're in" above it, and both can't be true. **The real "nobody yet" moment belongs to the sign-up count** on the roll-call screen, where a roster is shown to someone who isn't on it. Preview: `?roster=empty` |
| Suspended user | 🟡 🔨 | Home suspended screen built; appeal path + other screens' suspended states TBD |
| Admin vs non-admin | 🟡 | Admin sees early sign-up + admin panel entry; toggled everywhere · `/r/profile/admin` now guards itself by `isAdmin` |
| **Render error** | ✅ 🔨 | Built · `ErrorBoundary` wraps the whole app, so a thrown error shows a readable message + Reload instead of a white screen (stack shown in dev only) |
| **Redesign visibility** | ✅ 🔨 | `/r` is off unless `VITE_ENABLE_REDESIGN=true` (or local dev). **Leave it unset in Production** — the redesign shows mock data a real player could mistake for the live roster. Set it on Preview so the team can review |
| Weekend (Mon's game shown) | ✅ 🔨 | Same gap as §2's closed window, now built: Sat shows Monday's game with "Roll call opens Sun at 3 PM"; Sunday switches to the countdown |

---

## 1. Account & identity flow

**Built (2026-08-24)** at `/r/create-account` — five routes, one per step, so any screen opens directly. Runs on the third actions seam (`utils/authActions.js` + `redesign/state/mockAuthActions.js`); unlike the admin and gear seams this is **not** an extraction — the redesign replaces `components/PhoneVerify.jsx`, which is untouched and gets deleted at merge.

| Screen / state | Status | Notes |
|---|---|---|
| **Secret code** (admin-generated invite) | ➖ | **Decided against (2026-08-24).** The frame exists (`2670:11821`) and would make the club invite-only — a rule production doesn't have. Not built; revisit as a product decision, not a UI one. Its footnote also carries the phone screen's copy ("We'll send you an SMS Verification code"), which it shouldn't |
| Create account — phone entry | ✅ 🔨 | Built (`2670:11784`) · **one field, no country selector** — a deliberate change from the frame (2026-08-24). The "+1" box carried a chevron promising a picker that could never open, and `toE164US` already adds the +1 to a bare 10-digit number, so the box did nothing but invite a dead tap |
| ↳ **Non-`+1` numbers are refused** | ➖ | **Decided (2026-08-25): match production — no non-`+1` numbers.** Every entry point funnels through `toE164US`, which accepts only the +1 range, so Canada and the Caribbean work and +52 / +55 / +57 / +44 do not. Verification is mandatory (`App.jsx:409`), so an excluded number means no self-service account — and the **fallback is the one production already uses: an admin vouches by name** (`markVerifiedByName`, which sets `phoneVerified` without a number). Deliberately no player-facing "ask an admin" path, since production has none either. Revisit only if real players turn up who can't get in |
| ↳ invalid phone / send error | ✅ 🔨 | `InputField`'s error state. Both seam implementations reject a bad number with the *same words* — asserted in the contract test, since that string is the design |
| Create account — OTP verify | ✅ 🔨 | Built (`2670:11964`) · new `CodeInput` — 6 boxes, type-to-advance, backspace-to-retreat, paste/auto-fill fills the row, `autocomplete="one-time-code"` |
| ↳ wrong / expired code | ✅ 🔨 | Red borders + message; the attempt stays live so the code can be corrected without starting over. "Try again" resends and reports it |
| ↳ **Returning player — number already known** | ✅ 🔨 | **The important fork.** A verified number that already has an account is *adopted* — no name, no photo, straight to roll call. Asking again would fork the identity the uid-keyed model exists to unify |
| Add your name (first / last) | ✅ 🔨 | Built (`2670:12326`) · **Data-model change:** splits today's single `name` field. 🎨 Figma labels it "Frist name" — typo, corrected (edit-profile already did) |
| ↳ validation / empty | ✅ 🔨 | Both fields required, per-field messages |
| Add profile pic — empty | ✅ 🔨 | Built (`2670:12560`) · 248px Tan circle · Selfie / Upload / Skip. Both buttons are one file input; Selfie adds `capture="user"`, ignored on desktop |
| ↳ capturing / uploading | ➖ | **No in-between state needed:** the OS owns the camera and picker, and a local `objectURL` is instant — there is no upload to wait on until storage is wired |
| Add profile pic — filled | ✅ 🔨 | Built (`2699:12884`) · Continue, plus a "Choose a different photo" escape the frame lacks |
| **Welcome to the club {first-name}** | ✅ 🔨 | Built (`2699:12982`) · commits everything to the identity seam. 🎨 Two illustrations exist; the **first** is used (decided). **Decided (2026-08-25):** the frame has no CTA, so it auto-advances after **2.6s**, with tap/Enter to skip the wait. Confirmed as good for now — revisit only if it reads as rushed on a real phone |
| Skipped photo → initials fallback | ✅ 🔨 | Built end-to-end: skipping lands on roll call with initials in the nav |
| **Returning user sign-in** | ➖ | **Decided (2026-08-14): no special flow.** A returning verified user goes straight to the home / roll-call screen — the new root — where they join a game. Nothing to design. The *verification check itself* still has to be wired (see below) |
| ↳ Verification gate | 🟡 🔨 | The flow now *produces* a verified number, and the seam is the place the real check lands. **Still open:** no screen yet *refuses* an unverified user — the gate exists as a path, not a wall (Phase 4) |
| **Name split — existing accounts** | 🟡 | **Decided (2026-08-14):** production stores ONE `name`; the redesign splits it. Rule: **first word = first name, the rest = last name** — so "Eric J" → Eric / J, "Felipe Di Carli" → Felipe / Di Carli. One-word names are **not allowed** |
| ↳ **Missing last name — prompt** | ✅ 🔨 | **No new frame needed** (resolved 2026-08-24). `splitName` already returns `needsLastName`, and "Add your name" *is* the form — so a one-word account lands there with the first name filled, the headline reading **"Add your last name"** and the button **Save**. Preview with `5555550188` (Elle) |

---

## 2. Home / roll-call screen (the standalone sign-up screen)

**Time-window variants**

| Variant | Status | Notes |
|---|---|---|
| Closed — roll call opens on a **later day** | ✅ 🔨 | **Built (2026-08-25).** From Friday's 10 AM reset until Sunday the next game is Monday, whose roll call opens Sunday — the countdown read **40+ hours for two days**, which looks broken. The badge now says **"Roll call opens Sun at 3 PM"** instead; Sunday returns to the countdown, which by then is under a day. Not a separate screen: taking gear on Saturday for Monday is still valid, so only the badge changes. `useRollCallWindow` now returns `'closed'` as its own window, and the hour comes from `OPEN_HOUR_ET` so the copy can't drift. Preview: `?state=closed` vs `?state=waiting` |
| 10 AM–2:55 PM, non-admin — countdown + gear | ✅ 🔨 | Built · live countdown to 3 PM ET; gear available from 10 AM |
| 3 PM–8:59 PM, everyone — I'm in / +1 | ✅ 🔨 | Built |
| 10 AM–8:59 PM, admin — I'm in / +1 | ✅ 🔨 | Built · same screen as "open", shown early to admins |
| After 9 PM / overnight | ➖ | **No separate state needed** (verified 2026-08-25). The question this row posed is already answered in code: sign-up runs **continuously from 3 PM the day before until 10 AM on game morning** — straight through midnight — and **9 PM is not a sign-up gate**. It is two unrelated things sharing an hour: `GAME2_CUTOFF_HOUR_ET` (Match 2's go/no-go, which only changes the *status message* — nothing blocks joining) and the drop-strike deadline. Both resulting states are already built: `?match2=cancelled` and the late-drop warning |
| Suspended user variant | ✅ 🔨 | Built · strike message, no actions (frame 2934:3005) |

**Gear tile sub-states** (4 tiles: Goals, Goals, Balls, Bibs)

| State | Status | Notes |
|---|---|---|
| Available (`+`) | ✅ 🔨 | Built · the `+` (shared `IconButton`, sm) opens the take-home dialog (stacked variant), with the gear name, take day and return date all computed by production's `playerReturnDates` |
| ↳ Take dialog — two context variants | ✅ 🔨 | The question and buttons change on whether you're **already on the take-day roster** — keyed on the roster, not the screen, since after 3 PM you can sign up *and* take gear from the roll-call screen. **Not in yet:** "Are you playing both days?" / *Take & play both days* · *Take gear only*. **Already in:** "You're already in for {day}. Playing {return day} too?" / *Take & play {day}* · *Just bringing it back* — because the take day is settled, and "take gear only" would be false (you'd still be playing the day you signed up for) |
| **`IconButton`** (shared component) | ✅ 🔨 | Built (frame 2754:3164) · circular icon button, sizes sm (32) / md (40), five states (default / hover / focus / pressed / disabled) in `redesign/styles.css` (namespaced `rd-icon-btn`). Used for the gear tile `+`; disabled state doubles as the balls-gate lock |
| ↳ **Return-date picker (bibs)** | ✅ 🔨 | Built (`dd7544e`) — **folded into the take dialog** rather than a separate step. Production asks *"When will you bring the {gear} back?"* on its own screen, but only when there's a choice: goals and balls are always forced to the earliest open day, and so are bibs whenever a near game is uncovered. Probed against the real logic, every common path yields exactly one option — so rather than a screen most players never see, a row of day chips appears **only when `playerReturnDates` returns more than one**. Chips sit with the sentence they change and stay terse ("Tue 20") because that sentence restates the day in full. Single-option case is unchanged. Preview: `/r/game?picker=1` |
| Taken → shows **taker's avatar** in place of `+` | ✅ 🔨 | Built (frame 2756:2786) · the `+` becomes the taker's `PlayerAvatar` (photo or initials, same as the roster). Takers resolved from the ledger via `takersFor()` — the same source as coverage/alerts; two goal tiles fill independently. Taken tiles are non-interactive |
| Locked (balls-gate) | ✅ 🔨 | Built (2026-08-15) · the balls tile shows the **disabled icon button** (frame 2754:3164) until goals & bibs are fully taken. Uses production's `takeBlockedByPriority`; the disabled `+` can't open the dialog |
| None left / fully covered | ✅ 🔨 | **No separate state needed** (decided): because each set is its own tile, "fully covered" is just every tile in the **taken** state (avatar). Differs from production, which used a single tile with a count |
| Yours (you took it) | ✅ 🔨 | Built (frames 3323:21876 / 3323:21901) · tapping any **claimed** tile opens a commitment dialog: yours reads "**You** are taking [gear] to bring back {date}" with **Stop taking {gear}**; someone else's reads "{name} **is** taking …" with **Close**. Grammar switches per variant — the frame's "{name} are taking" only works for "You". Built on new `GearCommitmentLine` + `GearChip`, and `Dialog`'s new `content` slot |
| ↳ **Joining a cancelled Match 2** | ➖ | **Decided (2026-08-25): leave it — same as production.** Production doesn't block or warn either; sign-up is gated only by the time window (`iCanSignUp` = `rollOpen`), and you're told immediately after. The redesign's post-signup screen carries that status at the top (`?match2=cancelled`, built). Production makes this self-explanatory by showing the roster on the same screen as the buttons — the redesign split them, and that general gap is tracked separately below |
| ↳ **Lineup facepile + sheet** | ✅ 🔨 | **Built (2026-08-30)** from frames `3150:9375` (facepile) and `3647:22988` (sheet). Closes the gap the screen split created: production showed the roster beside the sign-up buttons, the redesign put it behind them. Five faces + a Tan **"+N"** disc under a "Lineup" label; tapping opens a **view-only** bottom sheet with the full roster. Shown on **all four roll-call variants** — open, waiting, closed and suspended (decided: suspended means you can't join, not that you can't look). Deviations from the frames, all deliberate: the **whole facepile is the tap target**, not only the "+N" disc, since a 40px circle is a small target and with ≤5 players there is no disc at all; **faces exclude +1 guests** (they repeat the host's avatar and would read as a bug) while **the count includes them**, because a guest is a person playing; the sheet **includes Bench** and carries the Match 2 on-hold / NO GAME labels. Row mapping and slicing are now shared with the game screen (`state/rosterRows.js`) so the two views can't disagree |
| ↳ Cancel behaviour — game spot | 🟡 | **Verified same as production**, keyed on the `signedUp` flag not the screen: gear-only rows are deleted on cancel, real sign-ups keep their spot. So taking gear pre-signup → cancel removes you from **both** games; taking it after signing up → only the **return** game is dropped. The button is wired to close only — the actual cancel needs the data layer |

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
| Gear takers strip | ✅ 🔨 | Built · shared `GearTakers` component. The heading names the take day **relative to now** and is derived inside the component, so it can't disagree with the dates below it |
| ↳ **"Tomorrow" is often not tomorrow** | ✅ 🔨 | **Fixed (2026-08-25)** via `relativeDayName()`: **Today** / **Tomorrow** / the weekday name, counted from the dates rather than from a weekday rule — so a holiday or an odd fixture can't break it. Three cases it corrects: Friday after the 10 AM reset (Monday, 3 days out), all Saturday (2 days), and **every game morning before the reset**, when the take day is *today* — five mornings a week, and the moment people actually check. ⚠️ The earlier note that this also affected the **take-gear dialog** was wrong: that copy already used `formatWeekday(takeDate)` and was always correct. **Decided (2026-08-25):** Sunday says **"Tomorrow's"**, not "Monday's" — proximity is clearer than consistency with the day before, even though Saturday named the same game "Monday's". Preview: `?day=today|tomorrow|later` |
| **Floating action bar** (Add a +1 · Out) | ✅ 🔨 | Built · `BottomActions`, 32px above the viewport bottom; slides down on scroll-down and back up on scroll-up (frame 3024:5347) |
| ↳ "Add a +1" action | ✅ 🔨 | Built · wired to state; sets `plusOnesAt` so a late guest takes a **back-of-line** spot (matches main `3db7b27`). Production has this too (`21b59ae`) — it is *not* redesign-only |
| ↳ "Add a +1" — already have one | ✅ 🔨 | **Built (2026-08-25):** the pill **toggles to "Remove +1"** rather than going disabled. Disabling it meant the only way to undo a mis-tap was to drop out and sign up again — losing your spot over a guest. Matches production's `handleSetMyPlusOnes(0)`, which updates the row in place: verified your position stays put and the roster returns exactly to its prior state. **Capped at one guest — decided 2026-08-25**, not merely a consequence of the badge. See the rule delta in the parity ledger: production allows 1 at sign-up but up to **20** afterwards |
| Out / leave — action | ✅ 🔨 | Built · removes you from the list and returns to roll call |
| **Dialog pattern** (shared) | ✅ 🔨 | Built · `Dialog` (frame 3155:9399) — black 20% scrim, card 20px from the sides and 40px from the viewport bottom, Cream/radius 24/padding 24. Optional 48px icon + optional headline (**at least one required**, warned in dev) over body copy; buttons are either cancel+confirm or a single primary. Escape and scrim-tap dismiss; page scroll locks while open. The 56px pill `Button` is now shared with the action bar |
| ↳ Out — confirm step | ✅ 🔨 | Built (frame 3050:5354) · "Are you sure?" / "If you drop out you will lose your current spot and signing up again might not guarantee a spot" · Cancel · **Yes, I'm out** → drops you and returns to roll call |
| ↳ Out — blocked while holding gear | ✅ 🔨 | Built (frame 3159:9425) · the **icon-only** variant — no headline, warning icon over a body whose bold lead-in names the gear *and its emoji* ("You're holding Goals 🥅 — …"), single **Got it** |
| ↳ Out after the 9 PM deadline — strike warning | ✅ 🔨 | Built (frame 3159:9446) · "Are you sure? If you drop, you'll receive a strike." + Cancel / **Yes, I'm out**. Gated by `isPastDropDeadline()`; preview with `?deadline=passed`. **This is the first time the 9 PM rule exists as code** — production only ever stated it as text in `Rules.jsx`. Uses the `America/New_York` zone, so 9 PM stays 9 PM local across DST |
| ↳ Strikes stay manual (**decided**) | ➖ | The app issues **no** strike — the dialog only warns. Admins read the **drops log** and assign strikes off-app. That makes the drops section load-bearing for enforcement: it must show *who* dropped and *when*, and distinguish game vs bench drops — which it does |
| Drops log ("Drops today") | ✅ 🔨 | Built · `DropsCard` (frames 3055:9097 / 3055:9199) · own Cream card below the Bench, or below Match 2 when there's no bench · newest first via `formatTimeET`, clears at the 10 AM rollover · rows are the shared `PlayerRow` with no position + a trailing time |
| ↳ Drops — game vs bench split | ✅ 🔨 | **Kept** (confirmed) — the two mean different things, so they stay separate: "From the game (N) — opened a spot" and "From the bench (N) — no game impact", divided like the Match 1/2 card. 🎨 The Figma frame shows one flat list, so the grouping reuses the roster's muted-label + divider pattern as an interim — **the split's own visual treatment still needs a frame** |
| ↳ Drops — row data requirements | 🟡 | **Confirmed intent:** an admin who drops shows the **admin flag**; rows use the **avatar**, falling back to **two-letter initials** when there's no photo; a dropping **+1 shows the "+1" badge**. Built and working on mock data. ⚠️ Production's drop record is only `{ name, deviceId, at, fromBench }` — to wire this for real the drop must carry the person's `uid` (identity is uid-keyed now) so the profile resolves at render |
| ⚠️ Gear at risk | ✅ 🔨 | **Built (2026-08-30)** as a **red badge on the nav's gear button** (frame `3317:13796`), not a card on this screen. The words stay where production puts them — inside the gear panel — so the badge is a pointer, not a duplicate. Unlike "nobody taking it home", this has no tile to sit on: it's about people who committed days ago. Same 24px badge geometry as the tile one (left 32 / top −8), red rather than orange. The nav reads **the same ledger the gear page does**, deliberately — a badge lighting up over a page insisting all is well would be worse than no badge. Preview: `?alert=bringing` (carried through the tap) |
| ⏳ Nobody taking gear home | ✅ 🔨 | **Built (2026-08-30)** as a **per-tile badge**, not a message (frame `3317:13786`). Production writes a paragraph naming the types; the redesign puts a 24px orange warning on each gear tile nobody has taken — the tile is what needs tapping, so that is where the attention belongs, and no words are needed. Same rule as production: `gearTakingAlert()`, gated to **6 PM ET**. Badge sits at left 32 / top −8, measured against the frame. **Not shown on a locked tile** (decided): balls stays shut until goals and bibs are taken, and flagging a tile you can't tap invites a tap that does nothing. Appears wherever the tiles do — game screen and roll call. Preview: `?alert=taking` |

---

## 4. Top navigation (persistent)

| Element | Status | Notes |
|---|---|---|
| Rules button (top-left) | ✅ 🔨 | Built · exact icon; frosted sticky nav |
| ↳ Back variant (detail surfaces) | ✅ 🔨 | Built · single Cream back-arrow pill; shown on `/rules`; `navigate(-1)` returns to prior screen |
| Gear detail icon(s) (top-left) | ✅ 🔨 | Built · opens `/r/gear`, which shows the **back** variant in its place (§6) |
| Profile avatar (top-right) | ✅ 🔨 | Built · photo / initials fallback; opens profile + admin |
| Admin-only affordances | ➖ | **Decided (2026-08-25): none needed.** The admin panel entry lives in the profile and that is sufficient; the nav stays the same for everyone. This row previously read as an open gap when it was really a question about whether to add something |
| Alert/unread indicators | ✅ 🔨 | Answered by the gear-at-risk badge (§3): the nav's gear button carries a red warning when nobody is bringing gear in. No other unread concept exists in the app |

---

## 5. Rules screen

| State | Status | Notes |
|---|---|---|
| Rules & code of conduct | ✅ 🔨 | Built · headline + 5 sections (Schedule & location, Roll call, What results in a strike? + sick note, Strike consequences 5×2 table, Emergency contacts) · uses the nav **back** variant · contacts list mocked (real = admin roster) |

---

## 6. Gear details (from top-nav)

**Decided (2026-08-14):** like the admin tools, this surface renders the **real production `GearManager`** as-is for now — no redesign of it yet, just the redesign's back navigation. Scope is the screenshot Cristian marked up:

| Region of today's `GearManager` | In the redesign's gear page? |
|---|---|
| ⏳ / 📥 gear alerts | ✅ yes |
| 📥 Bringing gear (day-by-day cards) | ✅ yes |
| 🎒 **Gear for {date}** — take tiles, your commitment, Cancel | ❌ **no** — moves to the home screen's gear tiles |
| 🧭 Who has the gear | ✅ yes |
| 📅 Gear schedule (next days) | ✅ yes |
| ⚙️ Gear admin — mark returned / reassign / remove / add | ✅ yes, **stays here** (decided), admin-gated as today |

**Built (2026-08-24)** at `/r/gear`, on the same actions-seam pattern as the admin tools — see `docs/gear-actions-seam.md`.

| Element / state | Status | Notes |
|---|---|---|
| ⏳ / 📥 gear alerts | ✅ 🔨 | Real `gearBringingAlert` / `gearTakingAlert`; show when a morning is uncovered |
| 📥 Bringing gear (day-by-day cards) | ✅ 🔨 | Next 3 mornings, per-type names + "needed ×N" + ✓ Ready |
| Who has gear now (current holders / out) | ✅ 🔨 | Per physical set: out / scheduled / at the field |
| Gear schedule (upcoming mornings) | ✅ 🔨 | Next 6 mornings · per-day coverage chips |
| ↳ day covered / short | ✅ 🔨 | Coverage chips read 🥅 2/2, ⚽ 0/1 … |
| ⚙️ Gear admin — returned / reassign / remove / add | ✅ 🔨 | Admin-gated, as today. All five writes verified through the mock seam |
| Take / return actions here | ➖ | **Dropped from this surface** (`showTake={false}`) — taking gear happens on the gear tiles |
| ⚠️ Port was a bigger lift than the admin one | ✅ | Resolved: `GearManager` built its Firestore doc ref at **module level** and held a live `onSnapshot`. Both now live behind `createFirestoreGearActions()`; the subscription is a seam operation (`subscribe`) like any other write |

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
| ↳ **"+1" box dropped** | ✅ 🔨 | Settled (2026-08-24): matches the account flow — one full-width **Phone number** field, no country selector. Save already validated 10 local digits, so no logic changed. The frame (`3233:12568`) still shows the pair |
| ↳ Phone change → verification | 🟡 🔨 | Change detected and surfaced ("You'll need to verify this number"). **The OTP step now exists** — `CodeInput` + the auth seam, built with the account flow (§1) — so what's left is routing the phone change into it. 🎨 It has its own frame, **`3315:12668`** ("Verify your new phone number"), which is the same screen with a different headline. The number is deliberately **not** written on save: in production it only takes effect once verified, so writing it early would show an unverified number as confirmed |
| **`InputField`** (shared component) | ✅ 🔨 | Built (frame 2666:7754) for reuse by the account-creation screens · four states — default (Tan), focused (Dark Gray + glow), error (Red + message), disabled — plus label, helper text, optional left icon and optional up/down chevron. All four verified in-browser |
| My gear commitments (+ cancel) | ➖ | **Not a profile feature** (confirmed). It exists in production but lives on the **Gear** surface (`GearManager.jsx`) — "🥅 You're bringing **Goals** back Tuesday" + Cancel. Keeping it there; tracked under §6. Note the real rule: cancel is only allowed *before* you take the gear home |
| Suspension status | ➖ | **Exists in production but not on the profile** — it's a banner on the roll-call screen (`App.jsx`: "🚫 You are suspended until … Contact an admin to appeal") and already built as the home suspended variant. Not in the profile frame, so not duplicated here |
| Profile — admin variant | ✅ 🔨 | Built (frame 3233:12618) · a 28px crown sits beside the name, and the single "Edit profile" becomes a two-button set with **Admin tools**. Preview the non-admin view with `?admin=none` |
| Admin panel entry (admins only) | ✅ 🔨 | Built · "Admin tools" → `/r/profile/admin` |
| Log out | ➖ | **Decided (2026-08-30): match production — none.** Identity is a verified phone number tied to the device, so there is nothing to log out *of*: no password, no session to end. Adding one would mean inventing what it does (forget the device? force re-verification by SMS to get back in?) — a new rule rather than a missing screen. Revisit only if shared devices become a real problem |

---

## 8. Admin panel (inside profile)

| Function / state | Status | Notes |
|---|---|---|
**Deliberately not redesigned.** The admin tools render the **real production `AdminPanel`** inside the redesign shell, so the settings and mechanisms are exactly what admins use today; the only addition is the back navigation. It runs on mock actions, so it's safe to click and works on the preview deploy. See `docs/admin-actions-seam.md`.

| Function / state | Status | Notes |
|---|---|---|
| Roll call open/close override | ✅ 🔨 | Real panel · phase-scoped override |
| Manage players (add / remove / drop) | ✅ 🔨 | Real panel · incl. bulk add, +1s, priority |
| Suspensions (suspend / unsuspend / strikes) | ✅ 🔨 | Real panel · escalating durations, undo |
| Admin badge grant / revoke | ✅ 🔨 | Real panel · by name, account-keyed |
| Verification override | ✅ 🔨 | Real panel · "Mark verified" safety valve |
| Gear ledger — assign / reassign | ✅ 🔨 | Lives in `GearManager`, not `AdminPanel` — shipped with the Gear surface (§6) |
| Gear ledger — mark returned / late / remove | ✅ 🔨 | Same as the row above — lives in `GearManager`, shipped with the Gear surface (§6). **Returned / Late / ✕ / Reassign** on every commitment row; all four verified against the running panel |
| "Someone already has it" onboarding | ✅ 🔨 | Also §6 — the gear admin's **"Assign bring"** (vs "Assign take"), i.e. seeding a set that is *already out* with someone and only needs bringing back. This is how the ledger gets started from reality rather than from future commitments |
| ↳ Admin tools — live data on merge | 🟡 | Runs on `createMockAdminActions` today; the route swaps to `createFirestoreAdminActions()` when the redesign merges |

---

## Gap summary

- **🔨 Built:** every *screen* in the app now exists. Home roll-call (4 variants), the "You're in" game screen (roster table + all Match 2 states), Rules, Profile + Edit, Admin tools, and the Gear panel — all on the mock seam.
- **Biggest missing clusters**, in the order they matter:
  1. **System states** — loading, empty list, offline, and the genuinely-closed roll-call window (Fri evening/Sat for a Monday game, which today shows a multi-hour countdown). Now the largest gap: every *flow* is built, so what's left is what happens when things are slow, empty, or shut.
  2. **Wiring** (Phases 4–5) — identity and actions are still mock across all three seams. Taking gear from a tile is inert; each ported surface swaps one line.
  3. **The verification wall** — the account flow now produces a verified number, but no screen yet *refuses* an unverified user.
  - Not clusters, but tracked: the "Tomorrow's gear takers" copy decision and the game screen's own gear-at-risk treatment.
- **~~Design-the-data-model-first item~~ → RESOLVED on main (merged 2026-08-10).** Identity is now **uid-keyed and phone-first**: `newUid()` mints a stable per-person id, `isSamePerson()` is the single matcher (uid → deviceId → name), `rosterDocId()` makes "one person = one row" true by construction, `toE164US()` canonicalizes numbers, and one phone = one account. The redesign's mock identity seam (`useCurrentUser`) should now be pointed at this real model — the proposal in `docs/data-model-proposal.md` is effectively answered. Still open for the redesign: the **first/last name split** and **profile-photo storage**, which main did not add.
- **Logic parity ledger** — what's real vs. still mocked:
  - ✅ Real: roster tiering + slicing + `+1` expansion (`buildFlatList`), Match 2 state (`getMatch2State`), roll-call windows/countdown/suspension, Friday-priority badge suppression.
  - ✅ Real: roster **mutations** too — "Out" and "Add a +1" write to local state and the list re-sorts through `buildFlatList` live.
  - 🟡 Mocked data source: `mockCommitments` (the gear ledger, in production's commitment shape) is now the single source — `mockGearRoles` is **derived** from it exactly as `App.jsx` does, and `mockPlayers` stands in for the Firestore session. `mockGearPriorityNames` is fixed so the badge is always previewable (production computes it only on Fridays). State is per-visit: it resets on reload, since there's no backend behind it yet.
  - ⬜ Not built: `player.priority` (admin per-day pin) has no UI yet — it ranks correctly but is only settable from the Admin panel.
  - ⚠️ Intentional rule delta: redesign opens gear at **10 AM**; production opens at **11 AM** (`GEAR_OPEN_HOUR_ET`). Don't "fix" this when wiring.
  - ⚠️ Intentional rule delta: **one +1 per player, full stop** (decided 2026-08-25). Production is asymmetric — the sign-up buttons offer 0 or 1, but the post-signup stepper has **no cap in the UI** and `handleSetMyPlusOnes` clamps at **20**, so one player can put 20 guests on a 36-person roster. That reads as a runaway-input guard rather than a product rule. The redesign allows exactly one, at sign-up and after. Don't wire the stepper.

**Suggested build order:** (1) ✅ design tokens → (2) 🟡 identity/data model *(proposal open — awaiting team; screens built on a mock seam)* → (3) ✅ routing skeleton + top nav → (4) ✅ home roll-call screen (all variants) → (5) ✅ game + roster (table + Match 2 states) → (6) ✅ gear tile states → (7) ✅ detail surfaces (Rules / Gear / Profile) → (8) ✅ admin panel → (9) ✅ account creation → (10) **← next: system states** (loading / empty / offline / closed) → (11) wire identity + actions.
