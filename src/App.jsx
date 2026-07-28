import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase/config';
import {
  doc, onSnapshot, setDoc, getDoc, updateDoc, deleteDoc,
  collection, arrayUnion,
} from 'firebase/firestore';
import NameEntry   from './components/NameEntry';
import AdminLogin  from './components/AdminLogin';
import PlayerList  from './components/PlayerList';
import AdminPanel  from './components/AdminPanel';
import Rules       from './components/Rules';
import PhoneVerify from './components/PhoneVerify';
import GearManager from './components/GearManager';
import PushSetup   from './components/PushSetup';
import { registerServiceWorker } from './utils/push';
import { fridayGearPriorityNames, bringersFor, takersFor } from './utils/gear';
import {
  getSessionDate, getDeviceId, normalizeName, newUid,
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
  const [cachedUid] = useState(() => localStorage.getItem('ftfc_uid'));
  const [showEditName,    setShowEditName]    = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  // When the verify screen is opened by a blocked join, remember the +1s so we
  // can finish that exact sign-up once the phone is verified.
  const [pendingPlusOnes, setPendingPlusOnes] = useState(null);
  const [showAdminLogin,  setShowAdminLogin]  = useState(false);
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);
  // Which sign-in is in flight (null = none, 0 = "In", 1 = "In +1") — drives the
  // button's submitting state and blocks double taps while the write is pending.
  const [signingIn,       setSigningIn]       = useState(null);

  // ── Firebase state ────────────────────────────────────────────────────────
  const [session,       setSession]       = useState(null);
  const [players,       setPlayers]       = useState([]);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [gearLedger,    setGearLedger]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [, setClockTick] = useState(0); // re-render so time-based open/close updates live

  // Register the service worker once so the app is installable and can receive push.
  useEffect(() => { registerServiceWorker(); }, []);

  // Cache the stable uid locally so records can be stamped before the profile loads.
  useEffect(() => {
    if (playerProfile?.uid) localStorage.setItem('ftfc_uid', playerProfile.uid);
  }, [playerProfile?.uid]);

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
    const col = collection(db, 'sessions', today, 'players');
    const unsub = onSnapshot(
      col,
      (snap) => setPlayers(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => setPlayers([])
    );
    return unsub;
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

  // Listen to this player's profile (suspension, admin flag)
  useEffect(() => {
    if (!playerName) return;
    const ref = doc(db, 'players', normalizeName(playerName));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) { setPlayerProfile(null); return; }
        const data = snap.data();
        setPlayerProfile(data);
        // Sync admin status from Firestore profile
        if (data.isAdmin && !isAdmin) {
          setIsAdmin(true);
          localStorage.setItem('ftfc_is_admin', 'true');
        }
      },
      () => setPlayerProfile(null)
    );
    return unsub;
  }, [playerName]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const suspended     = isSuspended(playerProfile?.suspendedUntil);
  // Stable identity anchor (from the profile; cached locally for immediate use).
  const uid           = playerProfile?.uid || cachedUid || null;
  // A roster entry is "me" if the stable uid matches, else fall back to device/name.
  const isMe = (p) => (uid && p.uid === uid) || p.deviceId === deviceId ||
    (p.name || '').toLowerCase() === playerName.toLowerCase();
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

  // ── My standing (so players don't scan the whole list) ─────────────────────
  const gearPriorityNames = fridayGearPriorityNames(gearLedger, today);

  // Gear roles for the shown day, derived from the ledger (single source of
  // truth) so roster badges/order can never drift from the coverage figures.
  const gearRoles = {};
  const addRole = (name, kind, type) => {
    const k = (name || '').toLowerCase().trim();
    if (!gearRoles[k]) gearRoles[k] = { bring: [], take: [] };
    if (!gearRoles[k][kind].includes(type)) gearRoles[k][kind].push(type);
  };
  bringersFor(gearLedger, today).forEach((c) => addRole(c.takerName, 'bring', c.type));
  takersFor(gearLedger, today).forEach((c) => addRole(c.takerName, 'take', c.type));

  const flatList = buildFlatList(players, { gearPriorityNames, gearRoles });
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

    // Everyone must verify their phone before joining. Admins are exempt (they
    // hold the PIN). If not yet verified, open the verify screen and remember
    // the +1s so onVerified can finish this exact join.
    if (!amAdmin && !assumeVerified && !playerProfile?.phoneVerified) {
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

    // One roster document per device, keyed by the always-present deviceId (uid
    // is stored as a field, not used as the key: it can be absent on an early
    // sign-in and present later, which would split one device across two docs).
    // A plain setDoc with no read-modify-write means concurrent sign-ins each
    // touch a different doc and never collide; re-tapping overwrites the same
    // doc (idempotent), so it can never create a duplicate.
    const ref = doc(db, 'sessions', today, 'players', deviceId);
    setSigningIn(plusOnes); // show the submitting state and block further taps
    try {
      // merge:true so signing in only sets the identity/+1 fields and preserves
      // anything another writer put on this same doc — an admin's `priority` or
      // GearManager's `gearBringer`/`gearTaker` markers. Without merge, a plain
      // setDoc replaces the whole doc and would silently wipe those.
      await setDoc(ref, {
        name: playerName, deviceId, uid,
        isAdmin: playerIsAdmin, plusOnes, signedUpAt: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.error('[FTFC] sign-in failed:', err);
    } finally {
      // Clear on both success and failure: on success the snapshot flips the UI
      // to "Out"; on failure the buttons re-enable so the player can retry.
      setSigningIn(null);
    }
  }, [signingIn, session, players, playerName, deviceId, uid, suspended, isAdmin, amAdmin, playerProfile, today]);

  const handleSignOut = useCallback(async () => {
    if (!playerName) return;
    // #5 — confirm before dropping
    if (!window.confirm('Out — are you sure? This removes you from the list.')) return;

    // Act only on THIS device's own entry — match by device id, never by name or
    // uid. Name would risk deleting a same-named stranger; uid would risk
    // deleting the same person's doc created on a *different* device. deviceId is
    // exactly the key sign-in wrote, so we delete precisely our own doc.
    const mine = players.find((p) => p.deviceId === deviceId);
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
  }, [playerName, players, deviceId, today]);

  const handleNameSave = async (name, verifiedPhone = null) => {
    const previousName = playerName;
    const isRename = previousName && previousName !== name;

    localStorage.setItem('ftfc_player_name', name);
    setPlayerName(name);
    setShowNameEntry(false);
    setShowEditName(false);
    setOnboardPhone(null);

    // If renaming and signed up for today's session, update the on-list entry.
    if (isRename) {
      const mine = players.find((p) => p.deviceId === deviceId);
      if (mine) {
        await updateDoc(doc(db, 'sessions', today, 'players', mine.id), { name });
      }
    }

    // Ensure a profile exists for this name, carrying the STABLE identity (uid +
    // phone) forward on a rename so history/gear never detaches from the person.
    const newProfileRef = doc(db, 'players', normalizeName(name));
    const newSnap = await getDoc(newProfileRef);
    if (!newSnap.exists()) {
      let carry = {};
      let oldRef = null;
      if (isRename) {
        oldRef = doc(db, 'players', normalizeName(previousName));
        const oldSnap = await getDoc(oldRef);
        if (oldSnap.exists()) {
          const old = oldSnap.data();
          carry = {
            uid: old.uid ?? null,
            phone: old.phone ?? null,
            phoneVerified: old.phoneVerified ?? false,
            phoneVerifiedAt: old.phoneVerifiedAt ?? null,
            isAdmin: old.isAdmin ?? false,
            suspendedUntil: old.suspendedUntil ?? null,
            suspensionType: old.suspensionType ?? null,
          };
        }
      }
      const uidToUse = carry.uid || newUid();
      await setDoc(newProfileRef, {
        name,
        uid: uidToUse,
        phone: verifiedPhone ?? carry.phone ?? null,
        phoneVerified: verifiedPhone ? true : (carry.phoneVerified ?? false),
        phoneVerifiedAt: verifiedPhone ? Date.now() : (carry.phoneVerifiedAt ?? null),
        isAdmin: carry.isAdmin ?? false,
        suspendedUntil: carry.suspendedUntil ?? null,
        suspensionType: carry.suspensionType ?? null,
        createdAt: Date.now(),
      });
      // A number must live on exactly one name — move it off the old profile.
      if (oldRef && carry.phone) {
        await updateDoc(oldRef, { phone: null, phoneVerified: false });
      }
      localStorage.setItem('ftfc_uid', uidToUse);
    } else {
      // Profile already exists — ensure a uid, and if we just verified a phone
      // during onboarding, stamp it (reuniting a returning player with their old
      // profile). Don't overwrite a profile already verified by someone else.
      const data = newSnap.data();
      const uidToUse = data.uid || newUid();
      const patch = {};
      if (!data.uid) patch.uid = uidToUse;
      if (verifiedPhone && !data.phoneVerified) {
        patch.phone = verifiedPhone;
        patch.phoneVerified = true;
        patch.phoneVerifiedAt = Date.now();
      }
      if (Object.keys(patch).length) await updateDoc(newProfileRef, patch);
      localStorage.setItem('ftfc_uid', uidToUse);
    }
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('ftfc_is_admin', 'true');
    setShowAdminLogin(false);
    setShowAdminPanel(true);
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    localStorage.removeItem('ftfc_is_admin');
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
                  Signed in as <strong>{playerName}</strong>
                  {playerProfile?.phoneVerified && (
                    <span className="badge badge-verified" title="Phone verified">✓ verified</span>
                  )}
                </span>
                <div className="you-row-actions">
                  {/* Shown until the player has verified their phone. */}
                  {!playerProfile?.phoneVerified && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowPhoneVerify(true)}
                    >
                      Verify phone
                    </button>
                  )}
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
              playerName={playerName}
              deviceId={deviceId}
              uid={uid}
              amAdmin={amAdmin}
              suspended={suspended}
              adminName={playerName}
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
                  <button className="btn btn-out" onClick={handleSignOut}>
                    Out
                  </button>
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
              players={players}
              deviceId={deviceId}
              playerName={playerName}
              isOpen={rollOpen}
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

            {/* Admin section */}
            <div className="admin-footer">
              {!isAdmin ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAdminLogin(true)}
                >
                  Admin Login
                </button>
              ) : (
                <div className="admin-controls-bar">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                  >
                    {showAdminPanel ? 'Hide Admin Panel' : '⚙️ Admin Panel'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleAdminLogout}
                  >
                    Log out
                  </button>
                </div>
              )}

              {isAdmin && showAdminPanel && (
                <AdminPanel
                  session={session}
                  players={players}
                  today={adminDate}
                  adminName={playerName}
                />
              )}
            </div>
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
              if (result.uid) localStorage.setItem('ftfc_uid', result.uid);
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
          initialName={playerName}
          onClose={() => setShowEditName(false)}
        />
      )}
      {showPhoneVerify && (
        <PhoneVerify
          playerName={playerName}
          onClose={() => { setShowPhoneVerify(false); setPendingPlusOnes(null); }}
          onVerified={(result) => {
            setShowPhoneVerify(false);
            // Phone already belongs to a registered player → adopt that canonical
            // name so gear/roster/history all match (they re-tap join as themselves).
            if (result?.adoptedName) {
              if (result.uid) localStorage.setItem('ftfc_uid', result.uid);
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
      {showAdminLogin && (
        <AdminLogin onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />
      )}
    </div>
  );
}
