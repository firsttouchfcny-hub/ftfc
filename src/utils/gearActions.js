// ─────────────────────────────────────────────────────────────────────────────
// Gear data operations — the seam between the gear UI and its backing store.
//
// Same move as adminActions.js, for the same reason: GearManager called
// Firestore directly, so it could only ever run against live production gear.
// Worse, it built `doc(db, 'gear', 'ledger')` at MODULE level — merely importing
// the component initialised Firebase, which is why the redesign couldn't render
// it at all.
//
//   · production   → createFirestoreGearActions()  (the default; unchanged)
//   · the redesign → a mock implementation, so the panel can be reviewed and
//                    clicked through without touching real commitments
//
// This is a pure extraction: the bodies below were moved verbatim out of
// GearManager. The split is by responsibility, not by behaviour — everything
// here is data only, returning a value or throwing. Confirmations, prompts,
// alerts and busy state stay in the component, so the UI is untouched.
//
// One addition beyond adminActions: `subscribe`. The live ledger listener is a
// data concern too, so it belongs behind the seam — the component just gets
// handed commitments and never learns where they came from.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '../firebase/config';
import {
  doc, onSnapshot, runTransaction, collection, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { ensureAccount, ensureAccountByPhone } from './identity';
import { isSamePerson, rosterDocId } from './helpers';
import { todayKey, returnSlotsLeft, pickFreeSet } from './gear';

export function createFirestoreGearActions({ adminName } = {}) {
  const LEDGER = doc(db, 'gear', 'ledger');

  // ── Internal helpers (were private to the component) ──────────────────────

  // Auto-confirm a gear person on a given day's lineup, tagged with their role:
  //   'bringer' → they carry the set IN that morning (their return date)
  //   'taker'   → they take the set HOME after that morning's game (their take date)
  // Pass type=null to clear the marker (used when a commitment is cancelled).
  async function setGearRole(dateKey, { name, deviceId, uid, isAdmin }, role, type) {
    const field = role === 'bringer' ? 'gearBringer' : 'gearTaker';
    const col = collection(db, 'sessions', dateKey, 'players');
    // Find any existing roster entry for this person (by stable uid, else their
    // device-keyed doc, else a name match) so we tag the same doc rather than
    // creating a duplicate. Each person writes only their own doc, so committing
    // to gear never contends with anyone else's write.
    const snap = await getDocs(col);
    const mineDoc = snap.docs.find((d) => isSamePerson(d.data(), { uid, deviceId, name }));

    if (type == null) { // clear the role marker
      if (!mineDoc) return;
      const d = mineDoc.data();
      const other = field === 'gearBringer' ? 'gearTaker' : 'gearBringer';
      // Once this role is cleared and no other gear role remains, the row exists for
      // NO reason unless the person actually signed up. So: keep it only for a
      // confirmed sign-up (signedUp), otherwise remove it. This means a cancelled/
      // reassigned/returned gear commitment can never leave a stranded roster row —
      // for new rows AND old ones (which have no signedUp flag).
      if (!d[other] && d.signedUp !== true) await deleteDoc(mineDoc.ref);
      else await updateDoc(mineDoc.ref, { [field]: null });
      return;
    }
    if (mineDoc) {
      await updateDoc(mineDoc.ref, { [field]: type });
    } else {
      // Not on this day's roster yet → auto-add them, keyed by their stable uid
      // (deviceId only until an account is resolved), matching sign-in so gear and
      // a later self-signup land on the SAME row. Committing to gear signs you up.
      // gearAdded marks the row as gear-created, so clearing the role can remove it.
      await setDoc(doc(col, rosterDocId({ uid, deviceId })), {
        name, deviceId, uid: uid || null, isAdmin: !!isAdmin,
        plusOnes: 0, [field]: type, gearAdded: true, signedUpAt: Date.now(),
      });
    }
  }

  // Rewrite one commitment in place. Internal rather than an exposed operation:
  // nothing outside this file needs a blind field patch, and every caller here
  // wraps it with the roster bookkeeping that has to accompany the change.
  async function patchCommitment(id, patch) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(LEDGER);
      if (!snap.exists()) return;
      const cs = snap.data().commitments || [];
      tx.update(LEDGER, {
        commitments: cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    });
  }

  // Resolve a person by PHONE first (one canonical account, however their name
  // is typed); fall back to a name only for a number that's brand-new to us.
  // This is what stops "Miguel C" vs "Miguel Cevallos" forking into two
  // identities.
  const resolvePerson = ({ e164, name }) => (
    e164 ? ensureAccountByPhone(e164, name || undefined) : ensureAccount(name)
  );

  // Clear BOTH ends of a commitment's roster presence — the take day and the
  // bring-back day. Cancel, return and reassign all do this same pair.
  const clearRoles = async (c, { skipTake = false } = {}) => {
    const who = { name: c.takerName, deviceId: c.takerDeviceId, uid: c.takerUid };
    if (!skipTake) await setGearRole(c.takeDate, who, 'taker', null);
    await setGearRole(c.returnDate, who, 'bringer', null);
  };

  return {
    // ── Live ledger ─────────────────────────────────────────────────────────
    // onNext receives the commitments array; onError fires on a listener error.
    // Returns the unsubscribe function.
    subscribe(onNext, onError) {
      return onSnapshot(
        LEDGER,
        (snap) => onNext(snap.exists() ? (snap.data().commitments || []) : []),
        (err) => onError?.(err),
      );
    },

    // ── Player: claim a set + return date (atomic) ──────────────────────────
    // Returns the assigned setId, or null if the claim didn't land (already
    // holds one, day full, or lost the race for a free set).
    async claim({ type, returnDate, addToGame = true, takeDate, player }) {
      const { name, deviceId, uid, isAdmin } = player;
      let assignedSet = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        const cs = snap.exists() ? (snap.data().commitments || []) : [];
        // One person may hold only one set of a type AT A TIME. Block only if they
        // still have it AFTER this take (returnDate > takeDate). A set they're
        // bringing back ON the take day is a continuation — they hand it in that
        // morning and take it again after the game — so that's allowed.
        const alreadyHas = cs.some(
          (c) => c.status === 'committed' && c.type === type && c.returnDate > takeDate &&
            ((uid && c.takerUid === uid) ||
             c.takerDeviceId === deviceId ||
             (c.takerName || '').toLowerCase() === name.toLowerCase())
        );
        if (alreadyHas) return;
        if (returnSlotsLeft(cs, type, returnDate) <= 0) return; // that day already full
        const setId = pickFreeSet(cs, type, takeDate);
        if (!setId) return; // lost the race — no set free
        assignedSet = setId;
        const entry = {
          id: crypto.randomUUID(), type, setId,
          takerName: name, takerDeviceId: deviceId, takerUid: uid || null,
          takerIsAdmin: !!isAdmin,
          takeDate, returnDate, status: 'committed', returnedOnTime: null,
          gearOnly: !addToGame,
          createdAt: Date.now(), source: 'player',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      // Only add them to the match roster if they're PLAYING. Someone just
      // picking up the gear (not playing) gets the commitment (tracked in the
      // gear panel) but stays off the game list.
      if (assignedSet && addToGame) {
        const who = { name, deviceId, uid, isAdmin };
        await setGearRole(takeDate, who, 'taker', type);     // playing the take day
        await setGearRole(returnDate, who, 'bringer', type); // playing the return day
      }
      return assignedSet;
    },

    // ── Cancel a commitment ─────────────────────────────────────────────────
    // The caller decides WHETHER cancelling is allowed (the "you already have
    // it" rule) and confirms with the player; this just performs it.
    async cancel(commitment) {
      const { id } = commitment;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        if (!snap.exists()) return;
        const cs = snap.data().commitments || [];
        // Mark cancelled rather than delete, so gear custody history is never
        // lost. Cancelled commitments aren't live, so coverage/the tracker ignore
        // them — but we keep a record of who touched each set.
        tx.update(LEDGER, {
          commitments: cs.map((x) => (x.id === id ? { ...x, status: 'cancelled', cancelledAt: Date.now() } : x)),
        });
      });
      await clearRoles(commitment);
    },

    // ── Admin ───────────────────────────────────────────────────────────────
    async markReturned(commitment, onTime) {
      await patchCommitment(commitment.id, {
        status: 'returned', returnedOnTime: onTime, returnedAt: Date.now(),
        returnedBy: adminName || 'admin',
      });
      // Update the list too: clear the person's gear markers (removes a gear-only
      // roster row) so the roster reflects the admin's gear update.
      await clearRoles(commitment);
    },

    // `input` is a phone number (preferred) or a name — the caller collects it.
    // Phone resolves to the one canonical account; name is the fallback. Either
    // way the commitment carries their stable uid, so it links to their signup.
    async reassign(commitment, account) {
      const c = commitment;
      // Move the roster role off the OLD person (so they aren't left stranded on
      // the list) and onto the new one, then re-point the commitment.
      await clearRoles(c, { skipTake: c.held });
      await patchCommitment(c.id, {
        takerName: account.name, takerUid: account.uid, takerDeviceId: null,
        source: adminName || 'admin',
      });
      const newWho = {
        name: account.name, deviceId: `admin-gear-${crypto.randomUUID()}`,
        uid: account.uid, isAdmin: !!account.isAdmin,
      };
      if (!c.held) await setGearRole(c.takeDate, newWho, 'taker', c.type);
      await setGearRole(c.returnDate, newWho, 'bringer', c.type);
    },

    // Exposed because the admin's "reassign" flow resolves the person first, so
    // it can hand the resulting account straight to reassign().
    resolvePerson,

    // mode: 'take'  → they take it home after the upcoming game, bring back on date
    //       'held'  → they ALREADY have it (seeded starting state), brings back on date
    // Returns { ok, dayFull } — the caller reports `dayFull` to the admin.
    async addManual({ type, e164, name, backDate, mode, takeOn, addToGame = true, takeDate }) {
      const held = mode === 'held';
      const useTake = held ? todayKey() : (takeOn || takeDate); // held = out now; take = chosen day
      const acct = await resolvePerson({ e164, name });
      let ok = false, dayFull = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        const cs = snap.exists() ? (snap.data().commitments || []) : [];
        // Don't over-book the bring-back day (max `need` bringers/day).
        if (returnSlotsLeft(cs, type, backDate) <= 0) { dayFull = true; return; }
        let setId = pickFreeSet(cs, type, useTake);
        if (!setId) {
          if (held) return;            // no free physical set to mark as held
          setId = `${type}-override`;  // admin force for a take
        }
        ok = true;
        const entry = {
          id: crypto.randomUUID(), type, setId,
          takerName: acct.name, takerDeviceId: null, takerUid: acct.uid, takerIsAdmin: !!acct.isAdmin,
          takeDate: useTake, returnDate: backDate, held,
          status: 'committed', returnedOnTime: null,
          gearOnly: !addToGame,
          createdAt: Date.now(), source: adminName || 'admin',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      // Only put them on the match roster if they're playing. Gear-only (not
      // playing) still gets the commitment — tracked in the gear panel — but no
      // roster row.
      if (ok && addToGame) {
        const who = {
          name: acct.name, deviceId: `admin-gear-${crypto.randomUUID()}`,
          uid: acct.uid, isAdmin: !!acct.isAdmin,
        };
        if (held) {
          await setGearRole(backDate, who, 'bringer', type);   // brings it back only
        } else {
          await setGearRole(useTake, who, 'taker', type);
          await setGearRole(backDate, who, 'bringer', type);
        }
      }
      return { ok, dayFull };
    },
  };
}
