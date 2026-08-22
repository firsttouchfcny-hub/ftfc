// ─────────────────────────────────────────────────────────────────────────────
// Admin data operations — the seam between the admin UI and its backing store.
//
// AdminPanel used to call Firestore directly, which meant the component could
// only ever run against live production data. Every operation now lives here
// behind a factory, so the same component can be pointed at a different store:
//
//   · production  → createFirestoreAdminActions()  (the default; unchanged)
//   · the redesign → a mock implementation, so the panel can be reviewed and
//                    clicked through without touching real players
//
// This is a pure extraction. The logic below was moved verbatim out of
// AdminPanel; nothing about WHAT these operations do has changed. The split is
// deliberate about responsibility: everything here is data only — it returns a
// value or throws. Toasts, confirmations and form state stay in the component,
// so the UI is untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '../firebase/config';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch,
  collection, addDoc, query, where, getDocs,
} from 'firebase/firestore';
import {
  normalizeName, calculateSuspensionEnd, getCurrentYear,
  getRollCallPhase, toE164US,
} from './helpers';
import { accountRef, findAccountByName, ensureAccount, ensureAccountByPhone } from './identity';

export function createFirestoreAdminActions({ today, adminName }) {
  // ── Internal helpers (were private to the component) ──────────────────────

  async function getOrCreateSession() {
    const ref = doc(db, 'sessions', today);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { date: today, isOpen: false, createdAt: Date.now() });
    }
    return ref;
  }

  async function updateSession(data) {
    const ref = await getOrCreateSession();
    await updateDoc(ref, data);
  }

  // A player is its own document in the session's players subcollection.
  const playerDoc = (id) => doc(db, 'sessions', today, 'players', id);

  // Every active strike this year for a person — counted across BOTH the new uid
  // key and the legacy normalized-name key, so switching the key never loses
  // history and a person's escalation count can't be split by a name variant.
  async function activeStrikesFor(acct, year, excludeId = null) {
    const seen = new Map();
    for (const key of [acct.uid, normalizeName(acct.name || '')]) {
      if (!key) continue;
      const snap = await getDocs(query(collection(db, 'strikes'), where('playerId', '==', key)));
      snap.docs.forEach((d) => seen.set(d.id, d.data()));
    }
    return [...seen.entries()]
      .filter(([id, s]) => id !== excludeId && s.year === year && !s.undone)
      .map(([id, s]) => ({ id, ...s }));
  }

  return {
    // ── Reads ───────────────────────────────────────────────────────────────

    async loadAdmins() {
      const snap = await getDocs(query(collection(db, 'accounts'), where('isAdmin', '==', true)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    },

    async loadStrikeLog() {
      const year = getCurrentYear();
      const snap = await getDocs(query(collection(db, 'strikes'), where('year', '==', year)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.issuedAt - a.issuedAt);
    },

    // ── Roll call ───────────────────────────────────────────────────────────

    // Tag the override with the current phase so it auto-expires at the next
    // scheduled transition (a morning "Close" won't block the 3 PM open).
    async setRollOverride(value) {
      const ref = await getOrCreateSession();
      await updateDoc(ref, { override: value, overridePhase: value ? getRollCallPhase() : null });
    },

    // Delete every player doc in one atomic batch (batching is the right tool
    // here: one admin clearing many docs at once, not many clients contending).
    async resetList() {
      const snap = await getDocs(collection(db, 'sessions', today, 'players'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await updateSession({ isOpen: false, drops: [] });
    },

    // ── Bulk add ────────────────────────────────────────────────────────────

    // Returns how many were actually added (duplicates are skipped).
    async bulkAdd(names, players) {
      await getOrCreateSession();
      const existingNames = new Set((players || []).map((p) => p.name.toLowerCase()));
      const existingUids = new Set((players || []).map((p) => p.uid).filter(Boolean));

      const batch = writeBatch(db);
      let added = 0;
      for (const name of names) {
        if (existingNames.has(name.toLowerCase())) continue;
        // Resolve (or create) the person's account so the row ties to a real
        // identity by uid, carries any existing admin flag, and shows the
        // canonical name.
        const acct = await ensureAccount(name);
        // Already on today's list under a different name? Same person → skip.
        if (existingUids.has(acct.uid)) continue;
        // Key the row by the person's uid (not the typed name), so if they later
        // self-sign-up it lands on THIS row instead of forking a duplicate.
        batch.set(playerDoc(acct.uid), {
          name: acct.name,
          deviceId: `admin-${normalizeName(acct.name)}`,
          uid: acct.uid,
          isAdmin: acct.isAdmin || false,
          plusOnes: 0,
          priority: false,
          signedUp: true, // admin put them on the list → a real entry, not gear-only
          // +added keeps a stable signup order within one batch (same-ms writes).
          signedUpAt: Date.now() + added,
        }, { merge: true });
        existingNames.add(acct.name.toLowerCase());
        existingUids.add(acct.uid);
        added++;
      }
      await batch.commit();
      return added;
    },

    // ── Per-player controls ─────────────────────────────────────────────────

    // Keep per-guest add-times: existing +1s keep theirs (backfilled to signup
    // time), newly added ones get "now" so they fall to the back of the list.
    async updatePlusOnes(playerId, value, player) {
      const val = Math.max(0, parseInt(value, 10) || 0);
      const cur = player?.plusOnes || 0;
      const hts = player?.signedUpAt || 0;
      const times = Array.isArray(player?.plusOnesAt) ? player.plusOnesAt.slice(0, cur) : [];
      while (times.length < cur) times.push(hts);
      if (val > times.length) { const now = Date.now(); while (times.length < val) times.push(now); }
      else times.length = val;
      await updateDoc(playerDoc(playerId), { plusOnes: val, plusOnesAt: times });
    },

    // Priority is per-day only: it pins the player to the top of THIS session's
    // list. It does NOT grant admin credentials and never touches their profile.
    async togglePriority(playerId, current) {
      await updateDoc(playerDoc(playerId), { priority: !current });
    },

    // Admin is a flag on the person's ACCOUNT (keyed by uid) — so it follows them
    // across name/phone changes and can't be lost to a duplicate. We also tag the
    // roster entry so the badge shows immediately on today's list.
    async toggleAdmin(playerId, uid, name, current) {
      const newVal = !current;
      await updateDoc(playerDoc(playerId), { isAdmin: newVal });
      const acct = uid ? { uid } : await ensureAccount(name);
      await setDoc(accountRef(acct.uid), { isAdmin: newVal }, { merge: true });
    },

    // ── Admins & verification, BY NAME ──────────────────────────────────────
    // Resolves the name to the person's account (creating one if they've never
    // signed up) and flags THAT — the single source of truth for admin power
    // and the verify override.

    async grantAdminByName(name) {
      const acct = await ensureAccount(name);
      await setDoc(accountRef(acct.uid), { isAdmin: true }, { merge: true });
    },

    async revokeAdmin(uid) {
      await setDoc(accountRef(uid), { isAdmin: false }, { merge: true });
    },

    // Safety valve: manually mark a player verified when their phone can't
    // complete SMS verification, so the gate never permanently locks anyone out.
    async markVerifiedByName(name) {
      const acct = await ensureAccount(name);
      await setDoc(accountRef(acct.uid), {
        phoneVerified: true, phoneVerifiedByAdmin: true, phoneVerifiedAt: Date.now(),
      }, { merge: true });
    },

    async removePlayer(playerId) {
      await deleteDoc(playerDoc(playerId));
    },

    // ── Strikes ─────────────────────────────────────────────────────────────

    // Returns how many entries were struck.
    async issueStrikes(entries) {
      const year = getCurrentYear();
      for (const entry of entries) {
        // Resolve to the ONE canonical account by phone (preferred) or name, so a
        // strike always attaches to the right person — "Miguel C", "Miguel
        // Cevallos", or his number all land on the same account and never split.
        const e164 = toE164US(entry);
        const acct = e164 ? await ensureAccountByPhone(e164) : await ensureAccount(entry);
        const newCount = (await activeStrikesFor(acct, year)).length + 1;
        const suspendedUntil = calculateSuspensionEnd(newCount);
        // The suspension lives on the person's ACCOUNT (what the app reads).
        await setDoc(accountRef(acct.uid), { suspendedUntil, suspensionType: 'strike' }, { merge: true });
        // Key the strike by the stable uid; keep the canonical name for the log.
        await addDoc(collection(db, 'strikes'), {
          playerName: acct.name, playerId: acct.uid, playerUid: acct.uid, issuedAt: Date.now(), year,
          strikeNumber: newCount, undone: false, issuedBy: adminName || 'admin', suspendedUntil,
        });
      }
      return entries.length;
    },

    async undoStrike(strike) {
      await updateDoc(doc(db, 'strikes', strike.id), { undone: true });
      const year = getCurrentYear();
      // Resolve the struck person's account: prefer the uid the strike carries
      // (new strikes) and fall back to the name (legacy strikes).
      const acct = strike.playerUid
        ? { uid: strike.playerUid, name: strike.playerName }
        : await findAccountByName(strike.playerName);
      if (acct) {
        // Recount across both keys, excluding the one we just undid.
        const remaining = (await activeStrikesFor(acct, year, strike.id)).length;
        await setDoc(accountRef(acct.uid), remaining === 0
          ? { suspendedUntil: null, suspensionType: null }
          : { suspendedUntil: calculateSuspensionEnd(remaining), suspensionType: 'strike' },
          { merge: true });
      }
    },
  };
}
