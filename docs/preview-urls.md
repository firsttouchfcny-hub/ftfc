# Preview URLs

Every screen and state in the redesign, and how to reach it. Kept here so it
doesn't have to be reconstructed from memory each session.

**Two bases — same paths:**

| Where | Base |
|---|---|
| Local (this machine) | `http://localhost:5173` |
| Preview deploy (phone / team) | `https://ftfc-git-design-redesign-e-906ce0-firsttouchfcny-8302s-projects.vercel.app` |

> ⚠️ The preview deploy needs **`VITE_ENABLE_REDESIGN=true`** set on Vercel →
> Preview. Until then `/r` falls through to the production app there. Local dev
> always works.

---

## Home / roll call

| URL | Shows |
|---|---|
| `/r` | Whatever the real Eastern-time window says right now |
| `/r?state=waiting` | Before 3 PM — countdown + take-gear |
| `/r?state=open` | tap the **Lineup facepile** under the buttons | View-only lineup sheet — Match 1 / Match 2 / Bench |
| `/r?state=closed` | Fri 10 AM–Sun — **"Roll call opens Sun at 3 PM"** instead of a 40-hour countdown. Gear tiles still offered |
| `/r?state=open` | Roll call open — I'm in / +1 |
| `/r?state=suspended` | Suspended player — strike message, no actions |

## Game — "You're in"

| URL | Shows |
|---|---|
| `/r/game` | Full roster, drops log, action bar |
| `/r/game?match2=onhold` | Match 2 on hold (under 30) |
| `/r/game?match2=cancelled` | Match 2 cancelled (past 9 PM) |
| `/r/game?standing=bench` | Bench standing headline |

### Dialogs on the game screen

| URL | Then | Shows |
|---|---|---|
| `/r/game?day=today` | — | Heading reads **"Today's gear takers"** (a game morning, before the 10 AM reset) |
| `/r/game?day=tomorrow` | — | Heading reads **"Tomorrow's gear takers"** (the ordinary Sun–Thu case) |
| `/r/game?day=later` | — | Heading reads **"Thursday's gear takers"** (Friday after the reset, or Saturday, pointing at Monday) |
| `/r/game` | tap **Out** | "You're holding Goals" — blocked, you have gear |
| `/r/game?gear=none` | tap **Out** | Ordinary drop confirm |
| `/r/game?gear=none&deadline=passed` | tap **Out** | Late-drop strike warning |

## Gear tiles (on both `/r` and `/r/game`)

| URL | Then | Shows |
|---|---|---|
| `/r/game` | tap a **free `+`** | Take dialog — *already-in* variant ("Playing Friday too?") |
| `/r?state=waiting` | tap a **free `+`** | Take dialog — *not-in-yet* variant ("Are you playing both days?") |
| `/r/game` | tap **your avatar** on a tile | Your commitment + "Stop taking {gear}" |
| `/r/game` | tap **someone else's avatar** | Their commitment + "Close" |
| `/r/game?picker=1` | tap the **bibs `+`** | The rare return-date choice (day chips) |

Tile states are driven by the mock ledger, so on `/r/game` you'll currently see:
goal 1 taken (Nico, photo) · goal 2 taken (you) · **balls free** · bibs taken
(Kofi, initials). Balls is unlocked because goals and bibs are fully covered —
when they aren't, that tile shows the disabled balls-gate lock.

## Profile

| URL | Shows |
|---|---|
| `/r/profile` | Admin view — crown, Edit profile + Admin tools |
| `/r/profile?admin=none` | Non-admin view — no crown, single button |
| `/r/profile?photo=none` | Initials avatar instead of a photo |
| `/r/profile/edit` | Edit name / last name / phone |
| `/r/profile/admin` | Admin tools (the real production panel) |

On `/r/profile/edit`: clear the last name → **Save** shows the error state.

## Other

| URL | Shows |
|---|---|
| `/r/rules` | Rules & code of conduct |
## Account creation

Five routes, one per step. Any of them opens directly; the flow's shared state
lives in memory, so a step opened cold falls back to the start where it must.

| URL | What you get |
|---|---|
| `/r/create-account` | Step 1 — phone entry |
| `/r/create-account/verify` | Step 2 — 6-box SMS code (needs a number sent first, else it bounces to step 1) |
| `/r/create-account/name` | Step 3 — first / last name |
| `/r/create-account/photo` | Step 4 — profile pic, empty and filled |
| `/r/create-account/welcome` | Step 5 — welcome, then auto-advances to roll call |

**The code is always `123456`.** These numbers force a specific outcome, so
every designed state has a way in:

| Enter this number | What happens |
|---|---|
| any 10 digits | New player — the full flow through to Welcome |
| `5555550100` | **Returning player** — number already has an account, skips to roll call |
| `5555550188` | **One-word name (Elle)** — routes to "Add your last name" with the first name filled |
| `5550000000` | **Send fails** — the error state under the phone field |
| `5550000001` | **Expired code** — the code step's error, whatever you type |
| `123` (or any short number) | "Enter a 10-digit US phone number." |
| any number, wrong code | "That code isn't right" — the attempt stays live, correct it in place |

---

| `/r/gear` | The real production gear panel on mock data — alerts, bringing-gear day cards, who has the gear, the schedule, and (as an admin) the gear admin tools. Taking gear is deliberately absent: that lives on the gear tiles |
| `/r/create-account` | Scaffold — account flow isn't built yet |
| `/?tokens` | Design token specimen — **local only** (dev build) |

---

## Known rough edges (not bugs to report)

- **Home may show a long countdown** — the "closed" state (2+ days from the next
  game) has no design yet, so it falls back to the waiting screen.
- **"Tomorrow's gear takers"** is literally "Tomorrow" — wrong when the next game
  is more than a day out.
- **Nothing saves.** A full page reload resets everything; clicking around keeps
  it. Gear take/cancel don't persist at all yet.
