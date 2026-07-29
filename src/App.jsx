import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase/config';
import {
  doc, onSnapshot, setDoc, updateDoc, deleteDoc, runTransaction,
  collection, arrayUnion, getDocs, query, where, documentId,
} from 'firebase/firestore';
import NameEntry   from './components/NameEntry';
import PlayerList  from './components/PlayerList';
import AdminPanel  from './components/AdminPanel';
import Rules       from './components/Rules';
import PhoneVerify from './components/PhoneVerify';
import GearManager from './components/GearManager';
import PushSetup   from './components/PushSetup';
import { registerServiceWorker } from './utils/push';
import { accountRef } from './utils/identity';
import { fridayGearPriorityNames, bringersFor, takersFor } from './utils/gear';
import {
  getSessionDate, getDeviceId, normalizeName, newUid,
  isSamePerson, rosterDocId, getEasternNow, isGameDay, formatDateShort,
  isSuspended, formatDate, formatTimeET,
  getRollCallPhase, isRollCallOpen, canAdminSignUp,
  buildFlatList, MATCH1_MAX, MATCH2_MAX, MATCH2_MIN_CONFIRM, getMatch2State,
} from './utils/helpers';

export default function App() {
  const today      = getSessionDate(); // before noon = today's game, after noon = tomorrow's game
  const adminDate  = today;            // admin panel always matches the displayed session
  const deviceId   = getDeviceId();

  // ── Persisted state (localStorage) ───────────────────────────────────────
  const [playerName,    setPlayerName]    = useState(() => localStorage.getItem('ftfc_player_name') || '');
  const [isAdmin,       setIsAdmin]       = useState(() => localStorage.getItem('ftfc_is_admin') === 'true');
  const [showNameEntry, setShowNameEntry] = useState(() => !localStorage.getItem('ftfc_player_name'));
  // During first-time onboarding, a brand-new (unrecognized) verified number waiting for a name.
  const [onboardPhone, setOnboardPhone] = useState(null);
  // Locally-cached stable uid (read once) — a fallback before the profile loads.
  // The stable identity anchor. Everything about a person hangs off this — their
  // account lives at accounts/<uid>; name and phone are just fields on it.
  const [uid, setUid] = useState(() => localStorage.getItem('ftfc_uid') || null);
  const [showEditName,    setShowEditName]    = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  // When the verify screen is opened by a blocked join, remember the +1s so we
  // can finish that exact sign-up once the phone is verified.
  const [pendingPlusOnes, setPendingPlusOnes] = useState(null);
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);
  // Which sign-in is in flight (null = none, 0 = "In", 1 = "In +1") — drives the
  // button's submitting state and blocks double taps while the write is pending.
  const [signingIn,       setSigningIn]       = useState(null);

  // ── Firebase state ────────────────────────────────────────────────────────
  const [session,       setSession]       = useState(null);
  const [players,       setPlayers]       = useState([]);
  const [playerProfile, setPlayerProfile] = useState(null);
  // uid → canonical account name, for everyone shown on the list / gear panel.
  // The source of truth for DISPLAY: a roster row or gear commitment stores a
  // name snapshot that can go stale after a rename; we resolve the current name
  // by uid at render instead of trusting the snapshot.
  const [namesByUid, setNamesByUid] = useState({});
  const inFlightUids = useRef(new Set()); // uids whose name fetch is in flight
  // This morning's game roster, shown to admins after the list rolls to the next
  // game (10 AM) until 6 PM, so they can still review who played at 7 AM.
  const [prevPlayers, setPrevPlayers] = useState([]);
  const [showPrevRoster, setShowPrevRoster] = useState(false);
  // Whether the profile listener has returned at least once. Until it has, we
  // don't KNOW if this person is phone-verified — so we must not pop the verify
  // screen on a fast "In" tap (that's the "asked me again" bug).
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [gearLedger,    setGearLedger]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [playersLoaded, setPlayersLoaded] = useState(false); // first roster snapshot in
  const [, setClockTick] = useState(0); // re-render so time-based open/close updates live

  // Register the service worker once so the app is installable and can receive push.
  useEffect(() => { registerServiceWorker(); }, []);

  // Keep the cached uid in sync with the identity anchor.
  useEffect(() => {
    if (uid) localStorage.setItem('ftfc_uid', uid);
  }, [uid]);

  // Keep my roster entry's display name in sync with my account name, so the list
  // never shows a stale snapshot (e.g. after a rename, or when I'm recognized on
  // a new device). Matches my entry by uid.
  useEffect(() => {
    if (!uid || !playerProfile?.name || !players.length) return;
    const mine = players.find((p) => p.uid === uid);
    if (mine && mine.name !== playerProfile.name) {
      updateDoc(doc(db, 'sessions', today, 'players', mine.id), { name: playerProfile.name })
        .catch((e) => console.error('[FTFC] name sync failed', e));
    }
  }, [uid, playerProfile?.name, players, today]);

  // Keep my GEAR commitments' display name in sync with my account name too, so a
  // rename shows the same name on the gear list + badges as on the roster (no
  // stale "William Escobar" vs "Escobar"). Matches my commitments by uid; a
  // transaction avoids clobbering a concurrent gear write.
  useEffect(() => {
    if (!uid || !playerProfile?.name) return;
    const myName = playerProfile.name;
    const stale = (c) => c.takerUid === uid && c.takerName !== myName;
    if (!gearLedger.some(stale)) return;
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'gear', 'ledger');
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const cs = snap.data().commitments || [];
      if (!cs.some(stale)) return;
      tx.update(ref, { commitments: cs.map((c) => (stale(c) ? { ...c, takerName: myName } : c)) });
    }).catch((e) => console.error('[FTFC] gear name sync failed', e));
  }, [uid, playerProfile?.name, gearLedger]);

  // Re-evaluate Eastern-time state (10 AM reset, 3 PM open) without a manual refresh.
  // The interval covers foreground; visibility/focus covers phones returning from
  // the background (where mobile browsers pause timers) so they flip immediately.
  useEffect(() => {
    const tick = () => setClockTick((t) => t + 1);
    const id = setInterval(tick, 30000);
    const onWake = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);

  // Listen to the session meta doc (isOpen / override / drops). The roster no
  // longer lives here — it's the players subcollection below.
  useEffect(() => {
    const ref = doc(db, 'sessions', today);
    const timeout = setTimeout(() => setLoading(false), 5000);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        clearTimeout(timeout);
        setSession(snap.exists() ? snap.data() : { date: today, isOpen: false });
        setLoading(false);
      },
      () => {
        clearTimeout(timeout);
        setSession({ date: today, isOpen: false });
        setLoading(false);
      }
    );
    return () => { unsub(); clearTimeout(timeout); };
  }, [today]);

  // Listen to this session's players subcollection. Each player is their own
  // document (keyed by device id), so simultaneous sign-ins each write a
  // different doc and never contend on a shared roster array.
  useEffect(() => {
    setPlayersLoaded(false); // reset when the session date changes
    const col = collection(db, 'sessions', today, 'players');
    const unsub = onSnapshot(
      col,
      (snap) => { setPlayers(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); setPlayersLoaded(true); },
      () => { setPlayers([]); setPlayersLoaded(true); }
    );
    // Don't leave the roster on a loading state forever on a slow connection.
    const timeout = setTimeout(() => setPlayersLoaded(true), 6000);
    return () => { unsub(); clearTimeout(timeout); };
  }, [today]);

  // Listen to the gear ledger (drives Friday gear-priority ordering).
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'gear', 'ledger'),
      (snap) => setGearLedger(snap.exists() ? (snap.data().commitments || []) : []),
      () => setGearLedger([])
    );
    return unsub;
  }, []);

  // Fetch the canonical account name for every uid shown (today's roster + gear
  // ledger) that we haven't resolved yet, so display always shows the current
  // name by uid. Targeted (only the shown uids, in `in` chunks of 30) and each
  // requested uid is recorded — null if missing — so we never re-fetch it.
  useEffect(() => {
    const wanted = new Set();
    players.forEach((p) => { if (p.uid) wanted.add(p.uid); });
    gearLedger.forEach((c) => { if (c.takerUid) wanted.add(c.takerUid); });
    prevPlayers.forEach((p) => { if (p.uid) wanted.add(p.uid); });
    // Skip uids already resolved OR currently in flight (the ref guards against
    // duplicate concurrent fetches and, on error, a per-snapshot retry storm).
    const need = [...wanted].filter((u) => !(u in namesByUid) && !inFlightUids.current.has(u));
    if (!need.length) return;
    need.forEach((u) => inFlightUids.current.add(u));
    const chunks = [];
    for (let i = 0; i < need.length; i += 30) chunks.push(need.slice(i, i + 30));
    Promise.all(chunks.map((ch) =>
      getDocs(query(collection(db, 'accounts'), where(documentId(), 'in', ch)))))
      .then((snaps) => {
        const found = {};
        snaps.forEach((s) => s.forEach((d) => { found[d.id] = d.data()?.name || null; }));
        setNamesByUid((m) => {
          const next = { ...m };
          need.forEach((u) => { next[u] = found[u] ?? null; }); // mark attempted
          return next;
        });
      })
      .catch((e) => console.error('[FTFC] name map fetch failed', e))
      .finally(() => { need.forEach((u) => inFlightUids.current.delete(u)); });
  }, [players, gearLedger, prevPlayers, namesByUid]);

  // Listen to this person's ACCOUNT (keyed by their stable uid). Suspension,
  // admin flag, name, phone all live there. If we don't know the uid yet
  // (a legacy/new device), fall back to the old name-keyed profile just long
  // enough to LEARN the uid, then this effect re-runs on the account.
  useEffect(() => {
    // Admin follows the person's verified ACCOUNT — there is no password login.
    // Grant when the account is flagged admin; from the account listener also
    // REVOKE a stale local flag (e.g. left over from the retired PIN) when it
    // isn't. Never clears on a missing/still-loading profile.
    const syncAdmin = (data, allowClear) => {
      if (!data) return;
      if (data.isAdmin) {
        if (!isAdmin) { setIsAdmin(true); localStorage.setItem('ftfc_is_admin', 'true'); }
      } else if (allowClear && isAdmin) {
        setIsAdmin(false);
        localStorage.removeItem('ftfc_is_admin');
      }
    };
    if (uid) {
      const unsub = onSnapshot(
        accountRef(uid),
        (snap) => {
          const data = snap.exists() ? { uid, ...snap.data() } : null;
          setPlayerProfile(data);
          setProfileLoaded(true);
          syncAdmin(data, true); // account is source of truth — may grant or revoke
        },
        () => { setPlayerProfile(null); setProfileLoaded(true); }
      );
      return unsub;
    }
    // Transition fallback: no uid known → read the legacy name profile to resolve it.
    if (!playerName) { setProfileLoaded(true); return; } // nothing to load
    const unsub = onSnapshot(
      doc(db, 'players', normalizeName(playerName)),
      (snap) => {
        if (!snap.exists()) { setPlayerProfile(null); setProfileLoaded(true); return; }
        const data = snap.data();
        setPlayerProfile(data);
        setProfileLoaded(true);
        if (data.uid) setUid(data.uid); // switches this effect to the account listener
        syncAdmin(data, false); // legacy doc: only grant, don't revoke mid-transition
      },
      () => { setPlayerProfile(null); setProfileLoaded(true); }
    );
    return unsub;
  }, [uid, playerName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ─────────────────────────────────────────────────────────
  const suspended     = isSuspended(playerProfile?.suspendedUntil);
  // The account name is the source of truth for display — the locally-stored
  // name can be stale (e.g. renamed on another device). Fall back to it only
  // until the account loads.
  const displayName   = playerProfile?.name || playerName;
  // A roster entry is "me" if the stable uid matches, else fall back to device/name.
  const isMe = (p) => isSamePerson(p, { uid, deviceId, name: playerName });
  const myEntry       = players.find(isMe);
  const onListByName  = players.some(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  );
  const isOnList      = !!myEntry || onListByName;

  // ── Time-based roll-call state (Eastern) ───────────────────────────────────
  const phase    = getRollCallPhase();                       // closed | admins-only | open
  const amAdmin  = isAdmin || playerProfile?.isAdmin || false;
  const rollOpen = isRollCallOpen(session);                  // open to everyone?
  const iCanSignUp = amAdmin ? canAdminSignUp(session) : rollOpen;

  // This morning's game date to show admins at the bottom of the page: once the
  // main list has rolled to the next game (10 AM), today's 7 AM roster stays
  // available for review until 6 PM ET. Only on game days, admins only.
  const etNow = getEasternNow();
  const prevDate = (amAdmin && isGameDay(etNow.dateKey) && today !== etNow.dateKey && etNow.hour < 18)
    ? etNow.dateKey : null;

  // Subscribe to this morning's roster while it's on view for admins.
  useEffect(() => {
    if (!prevDate) { setPrevPlayers([]); return; }
    const unsub = onSnapshot(
      collection(db, 'sessions', prevDate, 'players'),
      (snap) => setPrevPlayers(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => setPrevPlayers([])
    );
    return unsub;
  }, [prevDate]);

  // ── My standing (so players don't scan the whole list) ─────────────────────
  const gearPriorityNames = fridayGearPriorityNames(gearLedger, today);

  // Gear roles for the shown day, derived from the ledger (single source of
  // truth) so roster badges/order can never drift from the coverage figures.
  // Keyed by the person's uid (falling back to their normalized name only when a
  // commitment has no uid) so a badge lands on the right row even if the stored
  // names differ — buildFlatList looks up by uid first.
  const gearRoles = {};
  const addRole = (key, kind, type) => {
    if (!key) return;
    if (!gearRoles[key]) gearRoles[key] = { bring: [], take: [] };
    if (!gearRoles[key][kind].includes(type)) gearRoles[key][kind].push(type);
  };
  // Index each role under BOTH the person's uid and their normalized name, so a
  // roster row matches whether or not it carries a uid (buildFlatList tries uid
  // first, then falls back to name).
  const addRoleFor = (c, kind) => {
    if (c.takerUid) addRole(c.takerUid, kind, c.type);
    addRole((c.takerName || '').toLowerCase().trim(), kind, c.type);
  };
  bringersFor(gearLedger, today).forEach((c) => addRoleFor(c, 'bring'));
  takersFor(gearLedger, today).forEach((c) => addRoleFor(c, 'take'));

  // Resolve the current name for anyone shown from their account (by uid),
  // falling back to the stored snapshot until it loads. Display uses this so a
  // rename shows everywhere at once, without waiting on per-row name syncs.
  const nameOf = (uid, fallback) => (uid && namesByUid[uid]) || fallback;
  const displayPlayers = players.map((p) => ({ ...p, name: nameOf(p.uid, p.name) }));
  const prevDisplayPlayers = prevPlayers.map((p) => ({ ...p, name: nameOf(p.uid, p.name) }));

  const flatList = buildFlatList(displayPlayers, { gearPriorityNames, gearRoles });
  const myFlatIndex = flatList.findIndex((p) => p.isMainEntry && isMe(p));
  const myPosition = myFlatIndex >= 0 ? myFlatIndex + 1 : null;

  let myStatus = null;
  if (myPosition != null) {
    if (myPosition <= MATCH1_MAX) {
      myStatus = { cls: 'playing', main: "✅ YOU'RE PLAYING",
        sub: `Match 1 · #${myPosition} of ${MATCH2_MAX}` };
    } else if (myPosition <= MATCH2_MAX) {
      const m2 = getMatch2State(flatList.length);
      if (m2 === 'confirmed') {
        myStatus = { cls: 'playing', main: "✅ YOU'RE PLAYING", sub: `Match 2 · #${myPosition} of ${MATCH2_MAX}` };
      } else if (m2 === 'off') {
        myStatus = { cls: 'off', main: '⛔ NO MATCH 2 — NOT PLAYING',
          sub: "Match 2 didn't reach enough players" };
      } else {
        const need = MATCH2_MIN_CONFIRM - flatList.length;
        myStatus = { cls: 'pending', main: '🟡 MATCH 2 ON HOLD',
          sub: `waiting for ${need} more player${need === 1 ? '' : 's'} · decides at 9 PM` };
      }
    } else {
      myStatus = { cls: 'bench', main: '🪑 BENCH',
        sub: `#${myPosition - MATCH2_MAX} in line — waiting for a spot` };
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSignIn = useCallback(async (plusOnes = 0, assumeVerified = false) => {
    if (signingIn !== null) return; // a sign-in is already in flight — ignore
    const playerCanSignUp = (isAdmin || playerProfile?.isAdmin)
      ? canAdminSignUp(session)
      : isRollCallOpen(session);
    if (!playerCanSignUp || !playerName || suspended) return;

    // Wait until we actually know this person's verification status. Tapping "In"
    // in the split-second before the profile loads used to read as "not verified"
    // and wrongly pop the verify screen at an already-verified player.
    if (!assumeVerified && !profileLoaded) return;

    // EVERYONE — admins included — must verify their phone before joining, so
    // every roster entry resolves to one verified identity (no anonymous/unlinked
    // sign-ups, which is what created duplicate names). The PIN still grants admin
    // powers; it just no longer bypasses identity. If not yet verified, open the
    // verify screen and remember the +1s so onVerified can finish this exact join.
    if (!assumeVerified && !playerProfile?.phoneVerified) {
      setPendingPlusOnes(plusOnes);
      setShowPhoneVerify(true);
      return;
    }

    // Best-effort guard against a duplicate NAME held by someone else (a
    // different uid/device). Not transactional: each person writes their own
    // doc, so the worst case is a rare duplicate an admin can remove — never a
    // lost or clobbered sign-in.
    const nameHeldByOther = players.some(
      (p) => (p.name || '').toLowerCase() === playerName.toLowerCase() &&
        !(p.deviceId === deviceId || (uid && p.uid === uid))
    );
    if (nameHeldByOther) return;

    // Admin badge comes from the profile only — NOT from the device having
    // entered the shared PIN (which would leak the badge to anyone who logs in).
    const playerIsAdmin = playerProfile?.isAdmin || false;

    // One roster document per PERSON. Reuse the row I already own (found by uid,
    // else device/name) so a re-tap — even from a second device, or onto a row an
    // admin pre-added for me — updates that single row instead of forking a new
    // one; otherwise key by my stable uid (deviceId only until an account is
    // resolved). Different people have different keys, so concurrent sign-ins
    // still touch different docs and never collide. This is what makes a
    // duplicate structurally impossible rather than something we clean up after.
    const existing = players.find((p) => isSamePerson(p, { uid, deviceId, name: playerName }));
    const ref = doc(db, 'sessions', today, 'players',
      rosterDocId({ existingId: existing?.id, uid, deviceId }));
    setSigningIn(plusOnes); // show the submitting state and block further taps
    try {
      // merge:true so signing in only sets the identity/+1 fields and preserves
      // anything another writer put on this same doc — an admin's `priority` or
      // GearManager's `gearBringer`/`gearTaker` markers. Without merge, a plain
      // setDoc replaces the whole doc and would silently wipe those.
      await setDoc(ref, {
        name: playerProfile?.name || playerName, deviceId, uid,
        isAdmin: playerIsAdmin, plusOnes, signedUpAt: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error('[FTFC] sign-in failed:', err);
    } finally {
      // Clear on both success and failure: on success the snapshot flips the UI
      // to "Out"; on failure the buttons re-enable so the player can retry.
      setSigningIn(null);
    }
  }, [signingIn, session, players, playerName, deviceId, uid, suspended, isAdmin, playerProfile, profileLoaded, today]);

  const handleSignOut = useCallback(async () => {
    if (!playerName) return;
    // #5 — confirm before dropping
    if (!window.confirm('Out — are you sure? This removes you from the list.')) return;

    // Act on MY entry — match by uid (the person) first, so OUT works even from a
    // different device than the one that signed in; deviceId is the fallback for
    // entries with no uid. (One person only ever has one entry per session, so
    // this can't hit a stranger.)
    const mine = players.find((p) => (uid && p.uid === uid) || p.deviceId === deviceId);
    if (!mine) return;

    // Position at drop time → was this a playing spot (top 36) or the bench?
    // Match our own row by its doc id (not name) for the same reason.
    const flat = buildFlatList(players);
    const idx = flat.findIndex((p) => p.isMainEntry && p.id === mine.id);
    const fromBench = idx >= 0 && idx + 1 > MATCH2_MAX;

    try {
      // Delete only my own player doc, then append the drop to the session meta
      // doc. arrayUnion + merge is a single atomic field op (no read-back), and
      // drops are far too rare to contend the way sign-ins did.
      await deleteDoc(doc(db, 'sessions', today, 'players', mine.id));
      await setDoc(
        doc(db, 'sessions', today),
        // #7 — record the drop (clears when the session rolls over at 10 AM)
        { date: today, drops: arrayUnion({ name: mine.name, deviceId, at: Date.now(), fromBench }) },
        { merge: true }
      );
    } catch (err) {
      console.error('[FTFC] sign-out failed:', err);
    }
  }, [playerName, players, deviceId, uid, today]);

  // Adjust my +1 guest count AFTER I'm already signed up — updates my own roster
  // doc in place, so my signup time (and list position) never changes.
  const handleSetMyPlusOnes = useCallback(async (n) => {
    if (!myEntry) return;
    const val = Math.max(0, Math.min(n, 20)); // clamp to a sane range
    if (val === (myEntry.plusOnes || 0)) return;
    try {
      await updateDoc(doc(db, 'sessions', today, 'players', myEntry.id), { plusOnes: val });
    } catch (err) {
      console.error('[FTFC] update +1 failed:', err);
    }
  }, [myEntry, today]);

  const handleNameSave = async (name, verifiedPhone = null) => {
    const previousName = playerName;
    const isRename = previousName && previousName !== name;

    localStorage.setItem('ftfc_player_name', name);
    setPlayerName(name);
    setShowNameEntry(false);
    setShowEditName(false);
    setOnboardPhone(null);

    // If renaming and signed up today, update my roster entry's display name in
    // place. Match by uid (the person) first, so it works even when the entry was
    // created on a different device — deviceId as a fallback for unverified rows.
    if (isRename) {
      const mine = players.find((p) => (uid && p.uid === uid) || p.deviceId === deviceId);
      if (mine) {
        await updateDoc(doc(db, 'sessions', today, 'players', mine.id), { name });
      }
    }

    // Write my identity to my ACCOUNT (keyed by uid). A rename is just a name
    // change on the same account — no orphaned doc, no duplicate. A brand-new
    // person (no uid yet) gets a fresh account, stamping the verified phone if
    // onboarding just captured one.
    let myUid = uid;
    if (myUid) {
      const patch = { name };
      if (verifiedPhone) {
        patch.phone = verifiedPhone;
        patch.phoneVerified = true;
        patch.phoneVerifiedAt = Date.now();
      }
      await setDoc(accountRef(myUid), patch, { merge: true });
    } else {
      myUid = newUid();
      await setDoc(accountRef(myUid), {
        uid: myUid,
        name,
        phone: verifiedPhone ?? null,
        phoneVerified: !!verifiedPhone,
        phoneVerifiedAt: verifiedPhone ? Date.now() : null,
        isAdmin: false,
        suspendedUntil: null,
        suspensionType: null,
        createdAt: Date.now(),
      });
      localStorage.setItem('ftfc_uid', myUid);
      setUid(myUid);
    }
  };


  // ── Render ────────────────────────────────────────────────────────────────

  const gameDate = new Date(today + 'T12:00:00'); // noon avoids DST edge cases
  const todayLabel = gameDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">⚽</div>
        <h1 className="header-title">FTFC</h1>
        <p className="header-sub">First Touch Futebol Club</p>
        <p className="header-location">McCarren Park · Brooklyn · 7:00 AM</p>
        <p className="header-motto">Don't be late. Help set up.</p>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {/* Status bar */}
            <div className="status-bar">
              <span className="date-label">{todayLabel}</span>
              <span className={`roll-status ${rollOpen ? 'open' : phase === 'admins-only' ? 'admins' : 'closed'}`}>
                {rollOpen
                  ? '🟢 Roll call open'
                  : phase === 'admins-only'
                    ? '🟡 Admins only · opens 3:00 PM'
                    : '🔴 Roll call closed'}
              </span>
            </div>

            {/* Signed-in identity */}
            {playerName && (
              <div className="you-row">
                <span className="you-row-label">
                  Signed in as <strong>{displayName}</strong>
                  {playerProfile?.phoneVerified && (
                    <span className="badge badge-verified" title="Phone verified">✓ verified</span>
                  )}
                </span>
                <div className="you-row-actions">
                  {/* Verify (first time) or update (got a new number) — both open
                      the same flow; verifying a new number just re-points this
                      account's phone, keeping the same identity. */}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowPhoneVerify(true)}
                    title={playerProfile?.phoneVerified ? 'Got a new number? Update it here.' : undefined}
                  >
                    {playerProfile?.phoneVerified ? 'Update phone' : 'Verify phone'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowEditName(true)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {playerName && <PushSetup />}

            {/* Suspension banner */}
            {suspended && (
              <div className="suspension-banner">
                🚫 You are suspended until{' '}
                <strong>{formatDate(playerProfile.suspendedUntil)}</strong>.
                Contact an admin to appeal.
              </div>
            )}

            {/* Gear management */}
            <GearManager
              playerName={displayName}
              deviceId={deviceId}
              uid={uid}
              amAdmin={amAdmin}
              suspended={suspended}
              adminName={displayName}
              namesByUid={namesByUid}
            />

            {/* Signup buttons */}
            {playerName && (
              <div className="action-bar">
                {/* Keep showing the In/In+1 controls while a sign-in is in flight
                    (signingIn !== null), even though Firestore optimistically adds
                    us to the roster the instant setDoc is called. Otherwise the
                    buttons would flip to "Out" before the write is confirmed,
                    reducing the submitting state to a sub-frame flash — and a
                    failed write would flash "Out" then snap back. */}
                {(!isOnList || signingIn !== null) ? (
                  <>
                    <button
                      className="btn btn-in"
                      onClick={() => handleSignIn(0)}
                      disabled={!iCanSignUp || suspended || signingIn !== null}
                      aria-busy={signingIn === 0}
                    >
                      {signingIn === 0 ? 'Signing in…' : 'In'}
                    </button>
                    <button
                      className="btn btn-in-plus"
                      onClick={() => handleSignIn(1)}
                      disabled={!iCanSignUp || suspended || signingIn !== null}
                      aria-busy={signingIn === 1}
                    >
                      {signingIn === 1 ? 'Signing in…' : 'In +1'}
                    </button>
                  </>
                ) : (
                  <div className="signed-in-row">
                    <button className="btn btn-out" onClick={handleSignOut}>
                      Out
                    </button>
                    {/* Add/remove a +1 guest without dropping — keeps your spot. */}
                    <div className="plus-stepper">
                      <button
                        className="btn btn-sm plus-btn"
                        onClick={() => handleSetMyPlusOnes((myEntry?.plusOnes || 0) - 1)}
                        disabled={(myEntry?.plusOnes || 0) <= 0}
                        aria-label="Remove a guest"
                      >–</button>
                      <span className="plus-stepper-count">
                        +{myEntry?.plusOnes || 0} guest{(myEntry?.plusOnes || 0) === 1 ? '' : 's'}
                      </span>
                      <button
                        className="btn btn-sm plus-btn btn-in-plus"
                        onClick={() => handleSetMyPlusOnes((myEntry?.plusOnes || 0) + 1)}
                        aria-label="Add a guest"
                      >+1</button>
                    </div>
                  </div>
                )}
                {!iCanSignUp && !isOnList && (
                  <p className="action-hint">
                    {phase === 'admins-only'
                      ? 'Opens to everyone at 3:00 PM'
                      : phase === 'closed'
                        ? 'Sign-up opens at 10:00 AM'
                        : 'Roll call is closed'}
                  </p>
                )}
              </div>
            )}

            {/* My standing */}
            {myStatus && (
              <div className={`my-status my-status-${myStatus.cls}`}>
                <span className="my-status-main">{myStatus.main}</span>
                <span className="my-status-sub">{myStatus.sub}</span>
              </div>
            )}

            {/* Player list */}
            <PlayerList
              players={displayPlayers}
              deviceId={deviceId}
              playerName={displayName}
              isOpen={rollOpen}
              loaded={playersLoaded}
              gearPriorityNames={gearPriorityNames}
              gearRoles={gearRoles}
            />

            {/* Drops today (#7) — game drops (matter) vs bench drops (harmless) */}
            {session?.drops?.length > 0 && (() => {
              const sorted = [...session.drops].sort((a, b) => b.at - a.at);
              const gameDrops = sorted.filter((d) => !d.fromBench);
              const benchDrops = sorted.filter((d) => d.fromBench);
              return (
                <div className="drops-log">
                  <div className="drops-log-title">
                    📤 Drops today <span className="count-badge">{session.drops.length}</span>
                  </div>
                  {gameDrops.length > 0 && (
                    <div className="drops-group drops-game">
                      <div className="drops-group-title">⚠️ From the game ({gameDrops.length}) — opened a spot</div>
                      {gameDrops.map((d, i) => (
                        <div key={`g-${d.deviceId}-${d.at}-${i}`} className="drops-log-row">
                          <span className="drops-log-name">{d.name}</span>
                          <span className="drops-log-time">{formatTimeET(d.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {benchDrops.length > 0 && (
                    <div className="drops-group drops-bench">
                      <div className="drops-group-title">🪑 From the bench ({benchDrops.length}) — no game impact</div>
                      {benchDrops.map((d, i) => (
                        <div key={`b-${d.deviceId}-${d.at}-${i}`} className="drops-log-row">
                          <span className="drops-log-name">{d.name}</span>
                          <span className="drops-log-time">{formatTimeET(d.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Rules */}
            <Rules />

            {/* Admin section — admins are recognized by their verified ACCOUNT
                (granted in Manage Admins). No password login. */}
            {amAdmin && (
              <div className="admin-footer">
                <div className="admin-controls-bar">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                  >
                    {showAdminPanel ? 'Hide Admin Panel' : '⚙️ Admin Panel'}
                  </button>
                </div>

                {showAdminPanel && (
                  <AdminPanel
                    session={session}
                    players={displayPlayers}
                    today={adminDate}
                    adminName={displayName}
                  />
                )}
              </div>
            )}

            {/* This morning's game roster — admins only, after the list has
                rolled to the next game (10 AM) and until 6 PM ET. Collapsed by
                default; a read-only look at who played at 7 AM. */}
            {prevDate && (
              <div className="admin-footer prev-roster">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowPrevRoster(!showPrevRoster)}
                >
                  {showPrevRoster
                    ? '▲ Hide this morning’s roster'
                    : `▼ This morning’s roster · ${formatDateShort(new Date(prevDate + 'T12:00:00').getTime())}`}
                </button>
                {showPrevRoster && (
                  prevDisplayPlayers.length ? (
                    <PlayerList
                      players={prevDisplayPlayers}
                      deviceId={deviceId}
                      playerName={displayName}
                      isOpen={false}
                      gearPriorityNames={new Set()}
                      gearRoles={{}}
                    />
                  ) : (
                    <p className="gear-note">No one was on this morning’s list.</p>
                  )
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {/* First-time onboarding — verify phone FIRST so names can't be messed up.
          A recognized number loads that person's identity; a brand-new number
          then asks for a name (which becomes a verified profile). */}
      {showNameEntry && !onboardPhone && (
        <PhoneVerify
          onboarding
          onVerified={(result) => {
            if (result?.adoptedName) {
              if (result.uid) { localStorage.setItem('ftfc_uid', result.uid); setUid(result.uid); }
              localStorage.setItem('ftfc_player_name', result.adoptedName);
              setPlayerName(result.adoptedName);
              setShowNameEntry(false);
            } else if (result?.newPhone) {
              setOnboardPhone(result.newPhone);
            }
          }}
        />
      )}
      {showNameEntry && onboardPhone && (
        <NameEntry onSave={(name) => handleNameSave(name, onboardPhone)} />
      )}
      {showEditName && (
        <NameEntry
          onSave={handleNameSave}
          initialName={displayName}
          onClose={() => setShowEditName(false)}
        />
      )}
      {showPhoneVerify && (
        <PhoneVerify
          uid={uid}
          updating={!!playerProfile?.phoneVerified}
          onClose={() => { setShowPhoneVerify(false); setPendingPlusOnes(null); }}
          onVerified={(result) => {
            setShowPhoneVerify(false);
            // Phone already belongs to a registered player → adopt that canonical
            // name so gear/roster/history all match (they re-tap join as themselves).
            if (result?.adoptedName) {
              if (result.uid) { localStorage.setItem('ftfc_uid', result.uid); setUid(result.uid); }
              if (result.adoptedName !== playerName) {
                localStorage.setItem('ftfc_player_name', result.adoptedName);
                setPlayerName(result.adoptedName);
              }
              setPendingPlusOnes(null);
              return;
            }
            if (pendingPlusOnes !== null) {
              const n = pendingPlusOnes;
              setPendingPlusOnes(null);
              handleSignIn(n, true); // finish the join now that they're verified
            }
          }}
        />
      )}
    </div>
  );
}
