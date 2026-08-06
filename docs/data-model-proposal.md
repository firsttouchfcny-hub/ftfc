# FTFC — Identity & Data Model Proposal

> **Status: PROPOSAL — for team review. Nothing here is implemented.**
> This exists so the team can decide *how* accounts should work before the
> redesign wires them up. The visual redesign proceeds in parallel against a
> mock identity layer, so approving/changing this does not block design work.

**Context:** the redesign introduces real accounts (phone number → first/last
name → profile photo). The current app has **no accounts** — this proposal is
about the model that replaces that. See also `docs/redesign-inventory.md`.

---

## TL;DR

Move from **anonymous device-based identity** (a `deviceId` in local storage +
a typed name) to **phone-verified accounts** keyed by a stable Firebase Auth
`uid`. Name and photo become *attributes* of the account rather than the
identity itself.

**Decisions we need from the team** (details below):
1. ⚠️ **Migration** — how existing players move onto accounts (the big one).
2. **Photo storage** — Firebase Storage (recommended) vs Vercel Blob.
3. **Denormalization** — snapshot name/photo onto roster rows for fast reads? (recommended: yes).
4. **Phone privacy** — who can see phone numbers (recommended: admins only).

---

## Why change identity at all

Today a person is identified by a random `deviceId` (local storage) **plus a
free-typed `name`**, and the profile record is keyed by that name:
`players/{normalizeName(name)}`. "Is this me?" is decided by matching `deviceId`
**or** `name` across the roster and gear ledger.

That model has three real weaknesses the redesign is a good moment to fix:

| Weakness today | Consequence | Fixed by accounts |
|---|---|---|
| **Name is the database key** | Renames break the record; two similar names collide | Stable `uid` key |
| **Identity is per-device** | New phone = new identity; lose your standing/history | Account follows the person |
| **Admin = a shared PIN + device flag** | PIN can leak the admin badge (already patched once) | Admin is a property of the account |

---

## Current model (as-is)

```
sessions/{dateKey}
  { date, isOpen, createdAt,
    players: [ { id, name, deviceId, isAdmin, plusOnes, signedUpAt,
                 gearTaker?, gearBringer? } ],
    drops:   [ { name, deviceId, at, fromBench } ],
    override?, overridePhase? }

players/{normalizeName(name)}          ← keyed by NAME
  { name, isAdmin, suspendedUntil, suspensionType, createdAt }

gear/ledger
  { commitments: [ { id, type, setId,
                     takerName, takerDeviceId, takerIsAdmin,
                     takeDate, returnDate, status, returnedOnTime,
                     createdAt, source, held? } ] }
```

Firebase Auth is already initialized and `PhoneVerify.jsx` has working phone-auth
code (`signInWithPhoneNumber`) — but it is **dormant** (never triggered). So the
plumbing exists; the model does not.

---

## Proposed model

A new **`users/{uid}`** collection (replaces `players/{name}`), and roster/gear
entries reference `uid` instead of `deviceId` + name.

```
users/{uid}                            ← keyed by Firebase Auth uid (stable)
  { uid, phone,                        // phone in E.164, e.g. +17185551234
    firstName, lastName, displayName,  // displayName derived "First Last"
    photoURL,                          // nullable → initials fallback in UI
    isAdmin,
    suspendedUntil, suspensionType,
    createdAt }

sessions/{dateKey}.players[]
  { uid,                               // ← join key (was deviceId + name)
    displayName, photoURL, isAdmin,    // ← snapshot for fast list render
    plusOnes, signedUpAt,
    gearTaker?, gearBringer? }

gear/ledger.commitments[]
  { takerUid,                          // ← join key (was takerName + takerDeviceId)
    takerName,                         // ← snapshot, for display + history
    type, setId, takeDate, returnDate,
    status, returnedOnTime, createdAt, source, held? }
```

**`+1` guests are unchanged** — `plusOnes` stays a count under the host's `uid`;
guests are not accounts. No change needed there.

---

## Field-by-field mapping (current → proposed)

| Concept | Today | Proposed |
|---|---|---|
| Person's key | `normalizeName(name)` | `uid` (Firebase Auth) |
| Identity match | `deviceId` OR `name` | `uid` |
| Name | single `name` | `firstName` + `lastName` (+ derived `displayName`) |
| Photo | — | `photoURL` (nullable) |
| Phone | — | `phone` (E.164) |
| Admin | `isAdmin` flag + shared PIN | `isAdmin` on `users/{uid}`, gated by auth |
| Roster row | `{ name, deviceId, ... }` | `{ uid, displayName, photoURL, ... }` |
| Gear commitment owner | `takerName` + `takerDeviceId` | `takerUid` (+ `takerName` snapshot) |

---

## Storage — profile photos

**Recommendation: Firebase Storage** (`profilePhotos/{uid}`), with the resulting
URL saved to `users/{uid}.photoURL`.

- We already use Firebase (Auth + Firestore) — one less integration, and Storage
  security rules tie cleanly to the signed-in `uid`.
- Vercel Blob is the alternative (per repo conventions) but adds a second system
  for one feature.
- No photo → initials fallback in the UI (already shown in the roster mockup, e.g. "JC").

---

## What "me" means (auth ripple)

Identity detection moves from `deviceId`/name matching to **`auth.currentUser.uid`**.
This touches, at build time: sign-in/out and roster membership (`App.jsx`), gear
"my commitments" matching (`GearManager.jsx`), and admin checks. The shared admin
PIN can be retired once admin is an account property.

---

## ⚠️ Migration — the decision that needs the team

This is a **live club with real data keyed by name**. When someone signs in with
their phone for the first time, what happens to their existing standing (suspension
state, gear history)?

| Option | What it means | Trade-off |
|---|---|---|
| **A. Clean cutover** | Everyone re-registers with phone; old data archived | Simplest to build; everyone re-onboards, history reset |
| **B. Claim on first login** *(recommended)* | First phone sign-in, user confirms their existing name → link `uid` to the old record | Preserves suspensions + gear history; more logic + an edge-case: two people claiming one name |
| **C. Admin pre-seed** | Admins map known members to phone numbers ahead of time | Most controlled; most admin effort up front |

**Recommendation: B**, because in-flight **suspensions** and **gear history**
have real operational weight and shouldn't silently reset. But this is a call
about *your players' data*, so it's the team's to make.

Sub-questions to settle with whichever option:
- What happens to **active suspensions** at cutover?
- What about **gear commitments mid-cycle** (someone holding gear during the switch)?
- Who can **see phone numbers** — admins only? (privacy)
- How is the **first admin** bootstrapped (manually in the Firebase console)?

---

## Decision checklist for the team

- [ ] **Migration approach:** A / B / C  →  _______
- [ ] **Photo storage:** Firebase Storage (rec.) / Vercel Blob  →  _______
- [ ] **Denormalize name+photo onto roster rows** for read speed? (rec. yes; accept updating snapshots on change)  →  _______
- [ ] **Phone visibility:** admins only? (rec. yes)  →  _______
- [ ] Active-suspension handling at cutover  →  _______
- [ ] First-admin bootstrap process  →  _______

---

## What this unblocks

None of the above blocks the redesign. Screens are built against a **thin mock
identity layer** (a stubbed "current user" + fake roster), so the team can review
running design directions *and* this proposal in parallel. Whatever is approved
here slots into that seam as a localized change — the screens don't hardcode
identity assumptions.
