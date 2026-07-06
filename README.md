# ⚽ FTFC — First Touch Futebol Club roll call

The daily sign-up / roll-call web app for FTFC pickup soccer (McCarren Park, Brooklyn).
Players sign in for the next game, volunteer to bring gear, and see whether they made
the squad or the bench. Admins manage the list and issue strikes for late drops.

**Live:** https://firsttouchfc.org

---

## Tech stack

- **React 19** + **Vite** (plain JavaScript, no TypeScript)
- **Firebase Firestore** (client SDK) for all data — no backend server yet
- Hosted on **Vercel** (auto-deploys from `main`)

## Getting started

Requires **Node.js 20+**.

```bash
# 1. install dependencies
npm install

# 2. set up your environment
cp .env.example .env.local
#    then edit .env.local with the real Firebase values
#    (from the Firebase Console, `vercel env pull`, or ask the owner)

# 3. run the dev server
npm run dev          # → http://localhost:5173
```

> ⚠️ **Local dev talks to the REAL production database.** There is no separate
> dev environment yet, so anything you do locally (signing in, dropping, taking
> gear) writes to live club data. Use obvious test names (e.g. "TEST — Bob") and
> clean them up in the Admin Panel. Don't run load/stress tests against it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  App.jsx              # top-level app: state, session listener, sign-in/gear/drop actions
  components/
    PlayerList.jsx     # the roster (Match 1 / Match 2 / Bench)
    AdminPanel.jsx     # admin tools: roll call, bulk add, priority, strikes
    AdminLogin.jsx     # password login for admins
    NameEntry.jsx      # first-run name entry
    PhoneVerify.jsx    # phone verification (dormant — future phase)
    Rules.jsx          # club rules
  utils/helpers.js     # time/schedule logic, list ordering, gear, formatting
  firebase/config.js   # Firebase init (reads VITE_FIREBASE_* env vars)
```

Most of the interesting logic lives in **`src/utils/helpers.js`** (the daily schedule
and list ordering) and **`src/App.jsx`** (the read/write actions).

## How it works (daily cycle, all in US Eastern time)

| Time (ET) | What happens |
|---|---|
| **10:00 AM** | List resets to the next game; **admins** can sign up (and grab gear) |
| **12:00 noon** | **Gear Volunteers** tiles open to everyone (🥅 goals ×2, 🧺 bibs ×1, ⚽ balls ×1) |
| **3:00 PM** | Roll call **opens to everyone** |

- Each day is its own Firestore doc: `sessions/<YYYY-MM-DD>`. The "reset" is simply
  the app switching to a new, empty date doc at 10 AM ET.
- **Two matches of 18** = 36 players play; everyone after that is on the **bench**.
  Match 2 is confirmed once there are 30+ signups.
- **Gear volunteers** and **priority** players (a per-day flag admins set) pin to the
  top of the list. **Admin** status is separate and comes only from the password login.
- Writes use **Firestore transactions** so concurrent sign-ups can't clobber each other.

## Deployment

Pushing to **`main` auto-deploys to production** (firsttouchfc.org) via Vercel.
Because of that, **all changes should go through a pull request** — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributing

Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** before opening a pull request.
