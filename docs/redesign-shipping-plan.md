# Redesign shipping plan

How the redesign on `design/redesign-exploration` gets into production without
breaking the app people use before a 7 AM game.

**This document is the proposal.** Nothing in it has been executed. It's here as a PR so it
can be argued with before any code moves.

---

## What we need from Ivo

Five questions, roughly in order of how much each would change the plan:

1. **Can you spend ~2.5 hours reviewing five small PRs**, mostly on Saturdays? (~5 hours across
   the whole rollout.)
2. **Are you OK being the required reviewer** once branch protection is on? Today `CODEOWNERS`
   names you but nothing enforces it.
3. **Test database** — Firebase emulator, a second free Firebase project, or neither? This is
   the single biggest lever on how long everything takes.
4. **Photo storage** — data URLs in Firestore, or pay for the Blaze plan and use Firebase
   Storage? (Storage now requires a paid plan.)
5. **Does Saturday-only merging work for you?**

### Three things worth knowing regardless of this plan

- **`main` has no branch protection.** Public repo, auto-deploys to production. Verified — the
  GitHub API returns 404 for the protection endpoint.
- **`gear/ledger` is a single document** holding every gear commitment in one array. No backup,
  no history. One bad write replaces all of it.
- **There is a live defect on the redesign branch.** `src/App.jsx:814` builds the admin actions
  object inline on every render, so while an admin has the panel open the app re-queries
  Firestore **every 30 seconds** instead of once on mount. It's fixed in this plan (PR-C), and
  it's also the evidence for why the branch needs splitting: it sat unreviewed for weeks
  because it's one line, 85 files down in a 112-file PR.

---

| Stage | In one sentence |
|---|---|
| **0 — Rails** | Put the safety net in place — CI, branch protection, backups — before anything merges |
| **1 — Split and land** | Break the 112-file PR into five reviewable ones and merge them, redesign still switched off |
| **2 — Rule change** | Ship the one +1-per-player change to production, announced to the club |
| **3 — Wiring** | Connect the redesign to the real database, replacing its mock data |
| **4 — The flip** | Move players across one group at a time, with a kill switch that works from a phone |

---

## Context

The redesign is design-complete: 100 states built, 0 outstanding (see
[`redesign-inventory.md`](./redesign-inventory.md)). It all lives on one branch behind a
**draft PR** — 71 commits, 112 files, +7,482 / −522.

That PR can't ship as it stands. Of its 112 files, **13 can affect the live app**; the other
99 are redesign-only and unreachable in production. Those 13 are invisible inside it.

Up to 36 people play each morning, and this app is how they find out whether they're in. A bad
merge is discovered at dawn. So: land the work in pieces small enough that the risky parts get
read, and make sure it can be turned off from a phone.

**Already decided:** the kill switch is a field in Firebase, not a Vercel setting. Gear stays
at 11 AM — the redesign's "10 AM" was only ever a note, never implemented.

---

## What gets replaced — and what doesn't

**Every player-facing screen becomes the redesign**: roll call, the game screen and roster,
profile, rules, and account creation.

**Two surfaces keep production's existing UI**, decided 2026-08-14 — *"same settings we have
today, no UI changes or mechanism"*: **admin tools** (`AdminToolsScreen` renders the real
`AdminPanel`) and **the gear detail page** (`GearScreen` renders the real `GearManager`). A
player sees an entirely new app; an admin opening those two sees the old UI inside the new
navigation.

**Phone verification stays.** What eventually goes is `PhoneVerify.jsx` — *the old screen*, not
the feature. The redesign's account flow makes the same Firebase calls (`RecaptchaVerifier`,
`signInWithPhoneNumber`) via `authActions.js`; same SMS, new screens.
⚠️ `PhoneVerify` has **two** modes — new account *and* changing your number. Only the first is
built, so it can't be removed until the phone-change path lands (Stage 3, step 8).

---

## What is NOT changing: the database

**Nothing is migrated, rebuilt, or touched.** The five collections — `accounts`, `sessions`,
`players`, `gear`, `strikes` — stay exactly as they are. Someone who took goals home Thursday
still shows as holding them Friday, whichever front end they open.

That's structural, not a promise. **The redesign has no logic of its own.** It imports
production's — `utils/helpers.js` in 10 places, `utils/gear.js` in 6. The roster is ordered by
production's `buildFlatList`; the gear tiles read `takersFor`. The seams contain production's
own Firestore code moved verbatim, writing the same fields to the same documents. It's a new
front end on the same database — which is why three of the four connections are one-line swaps.

**The name split looks like a schema change and isn't.** Production stores one `name`; the
redesign splits it for display and `joinName()` rejoins it before saving.

Three things get *added*, none disturbing what exists:

| Addition | Effect on existing data |
|---|---|
| `uid` on new drop records | None — old records lack it, and drops clear at the 10 AM reset, so it heals within a day |
| A `photos/{uid}` collection | None — brand new; nobody has a photo today |
| A `config/app` document (kill switch) | None — one new document |

**The real risk isn't migration, it's a bad write.** `gear/ledger` is a single document holding
every commitment in one array. During wiring one faulty write could replace the lot, and no
flag rollback undoes that. Hence the backup script in Stage 0.

---

## Why the stages are in this order

**Dependency, with risk as the tiebreaker — not importance.** Stage 0 first because the rest
needs the safety net. Stage 1 before Stage 3 because code must be in `main` before it's wired.
Stage 2 runs alongside — an independent club rule change, deliberately off the critical path.
Stage 4 overlaps Stage 3 so the redesign is in real use before it's finished.

The same rule applies inside a stage, which is why two items look misplaced and aren't: the
**riskiest** thing in the plan (extracting the sign-up transaction) is *second* in Stage 3
because everything after depends on it, and the most **trivial** thing (the `uid` one-liner)
is *first* because its data needs weeks to accumulate.

---

## What sets the pace

**There is no test database** — local dev and preview both read and write the live Firestore
(README and CONTRIBUTING say so). So anything risky lands on a **Saturday**: games run Mon–Fri,
`getRollCallPhase()` returns `closed` all Saturday, and a Saturday merge leaves ~40 hours
before the next game. A bad Wednesday merge is found at dawn Thursday.

That means **one risky step per safe merge window**, and there are about eight.

**The one lever that compresses this is a test database** — the Firebase emulator or a second
free Firebase project. A day or two of setup, and most steps stop needing a Saturday, cutting
the calendar close to half. Worth deciding now rather than at Stage 3.

---

## Stage 0 — Rails

None of it changes how the app behaves.

| # | What | Who |
|---|---|---|
| 1 | **CI** — GitHub Action running lint + tests + build on every PR | PR-A |
| 2 | **Branch protection on `main`** — require PR, review, CI green | Cristian, 5 min |
| 3 | **Backup script** (`scripts/backup.mjs`) → accounts / sessions / gear / strikes to JSON | PR |
| 4 | `VITE_FIREBASE_*` on Vercel → **Preview** | Cristian, 10 min |
| 5 | `VITE_ENABLE_REDESIGN=true` on Vercel → **Preview only** | Cristian, 2 min |
| 6 | **Rollback drill** — Vercel "Promote to Production" on an old deploy, once | Cristian, 10 min |

**CI isn't there to catch bugs.** `.github/CODEOWNERS` names Ivo as required reviewer, but with
no branch protection that's a comment in a file on a public repo that auto-deploys. CI plus
three checkboxes turns "Ivo should review" into "main cannot change without Ivo."

**Gate:** branch protection on, CI green, first backup taken.

---

## Stage 1 — Split the PR and land it

| PR | Contains | Review | Time |
|---|---|---|---|
| **A** `chore/ci` | The CI workflow | Sanity-check | 5 min |
| **B** `ship/redesign-source` | All `src/redesign/`, `docs/`, `tokens.css`, `ErrorBoundary`, `TokenGallery`, `authActions.js`, `helpers.js` additions, `package.json` | **Don't read it** — one grep proving production imports none of it | 10 min |
| **C** `refactor/admin-seam` | `adminActions.js` + `AdminPanel.jsx` + the `App.jsx` call site **with the `useMemo` fix** | Equivalence table + call site | ~1 hr |
| **D** `refactor/gear-seam` | `gearActions.js` + `GearManager.jsx` + its call site | Equivalence table + call site | ~1 hr |
| **F** `feat/redesign-route` | `src/main.jsx` only (~50 lines) | Read line by line | 15 min |

**A and B are inert and can land together. C and D each get their own Saturday, never shared**
— if something breaks you need to know which. F can ride with D. B goes first because the seam
tests import the redesign's mock files.

**The split avoids history surgery.** There's a merge commit in the 71 and the production files
were touched across non-adjacent commits, so rebasing will fight us. Instead the files are
copied **by path from the final tree** onto fresh branches off `main`, building and testing
each. `design/redesign-exploration` is never rebased or force-pushed, and **PR #2 gets closed,
not merged**, with a comment listing its five replacements — keeping every review comment.
*(GitHub will then show the old branch as "71 commits ahead" forever. Expected.)*

### Defects fixed along the way

- **`App.jsx:814`** → `useMemo` on `[adminDate, displayName]`, matching gear at line 266. **PR-C.**
- **`main.jsx`** → `App` is `lazy()` inside `<Suspense fallback={null}>`, giving every
  production user a two-stage load with a **blank screen** between. Setting the Firebase vars
  on Preview (Stage 0 #4) lets `App` return to a static import; only the redesign stays lazy.
  **PR-F.**
- **Fonts** → move the Plus Jakarta Sans import from `main.jsx` into `RedesignApp.jsx`; 3.6 KB
  of unused `@font-face` rules stop loading for production. **PR-B.**
- **Deliberately not fixed:** the redesign chunk is emitted to `dist` even when the flag is off.
  Never downloaded by a user; a conditional build adds complexity for none, and it disappears
  when the flag is deleted.

### Proving the refactor is faithful

458 lines of Firestore logic touching **strikes, suspensions and gear custody** were moved, and
**nothing tests whether they still behave the same** — the existing seam tests only prove both
implementations expose the same method names, and they exercise the *mocks*.

1. **Equivalence table.** Every moved function: whitespace-normalised diff of old body vs new,
   marked *identical* or *changed, because…*. Review a 20-line table instead of 458 lines —
   this is what makes the 1-hour estimate real.
2. **Emulator tests, strikes only.** Strikes are uniquely irreversible for a player (a wrong
   suspension keeps someone out for weeks), algorithmically tricky (dual-key counting across
   uid *and* legacy name, escalation, recount-on-undo), and rare enough to hide for weeks.
   Everything else in the seam is a one-line write whose failure is obvious and instantly
   fixable by an admin. Second reason: the current seam tests die with the mocks after the flip
   — **the emulator tests are the ones that survive.**
3. **A Saturday QA script**, tap-by-tap. Because QA runs on live data it uses test names
   (`TEST — QA1`), strikes go only against a test name and are undone immediately, and
   `resetList` is Saturday-only.

**Gate:** five PRs merged, PR #2 closed, one clean Saturday QA pass.

---

## Stage 2 — One rule change, announced

Runs alongside Stage 3; blocks nothing.

**One +1 per player** (`App.jsx:514`, `Math.min(n, 20)` → `Math.min(n, 1)`, plus the signup
path). Production currently lets a signed-up player add **20** guests to a 36-person roster.

Ship it separately and tell the club first — it takes something away from anyone who brings two
friends, and shipping it separately means it doesn't roll back if the flip does. A rule change
is a club decision, not a UI decision.

---

## Stage 3 — Wiring

The largest stage. Today **20 redesign files read mock data**, and tapping "I'm in" at `/r` only
changes the URL. Each risky step gets its own Saturday and a backup taken first.

1. **Drops `uid`** — one line at `App.jsx:501`, additive and self-healing. **First despite being
   trivial**, so the data has been flowing for weeks before the redesign needs it.
2. **Extract `App.jsx`'s data layer** into a shared hook — **the riskiest item in the plan**,
   here because 3–6 depend on it. It holds the sign-up transaction everyone uses every morning,
   and **14 direct database calls still live in that 949-line file**. Same treatment as C and
   D; give it a whole merge window.
3. **Identity** — `useCurrentUser` mock → real account.
4. **Roster** — `mockRoster` → live subscription. → *Stage 4 begins here.*
5. **Gear tiles + admin tools** → the existing `createFirestore*Actions`. **Genuine one-line
   swaps**; can share a window.
6. **Account flow** → `createFirebaseAuthActions`, the verification gate, the name-split prompt.
7. **Photo storage** — a `photos/{uid}` collection holding a client-side 256px JPEG data URL
   (~20 KB), *not* Firebase Storage, which now needs a paid plan. A **separate** collection
   because `identity.js` already scans all ~520 `accounts` documents in a loop, and photos on
   those would make each scan megabytes. Needs a size cap in `firestore.rules`.
8. **Remaining partials** — gear cancel, phone-change → OTP (unblocks removing `PhoneVerify`),
   admin toggling, suspended states.

---

## Stage 4 — The flip

Begins at Stage 3 step 4 and overlaps the rest. **Not by moving files — by moving the route.**
Both apps stay in the bundle throughout.

**The kill switch:** a `config/app` document with `{ redesign: false }`, read once at startup
behind the spinner that already exists, cached in `localStorage` so a cold read never delays
first paint. Rollback becomes **editing one field in the Firebase console from a phone** —
about a second, no deploy, no laptop. ~30 lines.

| Rung | Who sees it | Move on when |
|---|---|---|
| 1 | Cristian and Ivo, via an opt-in link | Both have signed up for real games without incident |
| 2 | Three or four friendly players, announced in the chat | A week of real mornings, no reports |
| 3 | Everyone — flip the default | The link inverts to "go back to the old app" |
| 4 | Delete the old app, the flag, and `PhoneVerify.jsx` | Nobody would go back |

**Nothing old is deleted until rung 4.** While the old app is the rollback target, deleting it
removes the thing you'd roll back *to*.

**`AdminPanel` and `GearManager` are shared** — the redesign renders the real ones, and they
survive the flip as redesign components. Until then: **any PR touching those two files gets
checked on both `/` and `/r`.**

**Four layers of rollback:** the player's opt-out link · the Firebase field · Vercel's "Promote
to Production" · and for data corruption, **nothing** — hence the backup script.

---

## Who does what

**Cristian decides:** whether to add a test database · whether one +1 per player is the club
rule and when the club hears it · who gets the early link · when each rung is earned · when the
old app gets deleted · whether Saturday-only merges are a standing rule.

**Cristian does (no code):** branch protection · Vercel variables · the rollback drill · the
Saturday QA scripts · announcing the rule change · editing the Firebase flag.

**Ivo reviews (~2.5 hrs for the merge, ~5 total):** PR-C and PR-D are where the attention
matters; the `App.jsx` extraction in Stage 3 is the other. **PR-B is 90+ files and should not
be read** — one grep replaces it.

---

## Verification

- **Every PR**, automatic once CI lands: `npx eslint .` · `npm test` · `npm run build`.
- **PR-B:** build before and after — `dist/assets/index-*.js` should be byte-identical, proving
  the redesign is tree-shaken out of production. Two minutes, replacing 5,000 lines of reading.
- **PR-C / PR-D:** equivalence table + strikes emulator suite + a Saturday pass through Roll
  Call, Bulk Add, Admins & Verification, Manage Players, Issue Strikes (test name, undone
  immediately), and gear take / cancel / mark returned / reassign / add.
- **PR-F:** `/` on Preview loads in one stage with no blank flash; `/r` works; `/r` on
  production with the flag off silently shows the old app.
- **Every Stage 3 merge:** run the backup script first.

---

## Risks

| | Risk | Mitigation |
|---|---|---|
| 🔴 | `gear/ledger` is **one document with no backup** — a bad write destroys every commitment and no flag undoes it | Backup script is a **hard prerequisite** for Stage 3 |
| 🔴 | **No test database** — previews and local dev write live club data, and this sets the pace | Emulator mandatory by the `App.jsx` extraction; adding one in Stage 0 roughly halves the calendar |
| 🟠 | `main` **unprotected** on a public auto-deploying repo | Branch protection, Stage 0 |
| 🟠 | Schedule pressure eating the safety work | Progress is visible early — the redesign is in real use from mid-Stage 3 |
| 🟡 | Weekday merges | Saturday-only merge window |
