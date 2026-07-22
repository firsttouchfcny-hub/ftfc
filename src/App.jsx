import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase/config';
import {
  doc, onSnapshot, setDoc, getDoc, updateDoc, runTransaction,
} from 'firebase/firestore';
import NameEntry   from './components/NameEntry';
import AdminLogin  from './components/AdminLogin';
import PlayerList  from './components/PlayerList';
import AdminPanel  from './components/AdminPanel';
import Rules       from './components/Rules';
import PhoneVerify from './components/PhoneVerify';
import GearManager from './components/GearManager';
import { fridayGearPriorityNames, bringersFor, takersFor } from './utils/gear';
import {
  getSessionDate, getTomorrow, getDeviceId, normalizeName,
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
  const [showEditName,    setShowEditName]    = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [showAdminLogin,  setShowAdminLogin]  = useState(false);
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);

  // ── Firebase state ────────────────────────────────────────────────────────
  const [session,       setSession]       = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [gearLedger,    setGearLedger]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [, setClockTick] = useState(0); // re-render so time-based open/close updates live

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

  // Listen to the player-facing session (today before noon, tomorrow after)
  useEffect(() => {
    const ref = doc(db, 'sessions', today);
    const timeout = setTimeout(() => setLoading(false), 5000);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        clearTimeout(timeout);
        setSession(snap.exists() ? snap.data() : { date: today, isOpen: false, players: [] });
        setLoading(false);
      },
      () => {
        clearTimeout(timeout);
        setSession({ date: today, isOpen: false, players: [] });
        setLoading(false);
      }
    );
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
  const myEntry       = session?.players?.find((p) => p.deviceId === deviceId);
  const onListByName  = session?.players?.some(
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

  const flatList = buildFlatList(session?.players || [], { gearPriorityNames, gearRoles });
  const myFlatIndex = flatList.findIndex(
    (p) => p.isMainEntry &&
      (p.deviceId === deviceId || p.name.toLowerCase() === playerName.toLowerCase())
  );
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

  const handleSignIn = useCallback(async (plusOnes = 0) => {
    const playerCanSignUp = (isAdmin || playerProfile?.isAdmin)
      ? canAdminSignUp(session)
      : isRollCallOpen(session);
    if (!playerCanSignUp || !playerName || suspended) return;

    const playerIsAdmin = isAdmin || playerProfile?.isAdmin || false;
    const ref = doc(db, 'sessions', today);
    try {
      // Atomic: read the live list inside a transaction so we never clobber
      // concurrent sign-ups with a stale in-browser copy.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const players = snap.exists() ? (snap.data().players || []) : [];
        if (players.some(
          (p) => p.deviceId === deviceId || p.name.toLowerCase() === playerName.toLowerCase()
        )) return; // already on the list
        const entry = {
          id: crypto.randomUUID(), name: playerName, deviceId,
          isAdmin: playerIsAdmin, plusOnes, signedUpAt: Date.now(),
        };
        if (snap.exists()) tx.update(ref, { players: [...players, entry] });
        else tx.set(ref, { date: today, isOpen: false, players: [entry], createdAt: Date.now() });
      });
    } catch (err) {
      console.error('[FTFC] sign-in failed:', err);
    }
  }, [session, playerName, deviceId, suspended, isAdmin, playerProfile, today]);

  const handleSignOut = useCallback(async () => {
    if (!playerName) return;
    // #5 — confirm before dropping
    if (!window.confirm('Out — are you sure? This removes you from the list.')) return;

    const ref = doc(db, 'sessions', today);
    try {
      // Atomic: remove only self against the live list, and log the drop.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const players = data.players || [];
        const removed = players.filter(
          (p) => p.deviceId === deviceId || p.name.toLowerCase() === playerName.toLowerCase()
        );
        if (removed.length === 0) return;
        const newPlayers = players.filter(
          (p) => p.deviceId !== deviceId && p.name.toLowerCase() !== playerName.toLowerCase()
        );
        tx.update(ref, {
          players: newPlayers,
          // #7 — record the drop (clears when the session rolls over at 10 AM)
          drops: [...(data.drops || []), { name: removed[0].name, deviceId, at: Date.now() }],
        });
      });
    } catch (err) {
      console.error('[FTFC] sign-out failed:', err);
    }
  }, [playerName, deviceId, today]);

  const handleNameSave = async (name) => {
    const previousName = playerName;
    const isRename = previousName && previousName !== name;

    localStorage.setItem('ftfc_player_name', name);
    setPlayerName(name);
    setShowNameEntry(false);
    setShowEditName(false);

    // If renaming and signed up for today's session, update the on-list entry.
    if (isRename && session?.players?.some((p) => p.deviceId === deviceId)) {
      const sessionRef = doc(db, 'sessions', today);
      const updatedPlayers = session.players.map((p) =>
        p.deviceId === deviceId ? { ...p, name } : p
      );
      await updateDoc(sessionRef, { players: updatedPlayers });
    }

    // Ensure a profile exists for the new name, carrying over old status if any.
    const newProfileRef = doc(db, 'players', normalizeName(name));
    const newSnap = await getDoc(newProfileRef);
    if (!newSnap.exists()) {
      let carryOver = {};
      if (isRename) {
        const oldSnap = await getDoc(doc(db, 'players', normalizeName(previousName)));
        if (oldSnap.exists()) {
          const old = oldSnap.data();
          carryOver = {
            isAdmin: old.isAdmin ?? false,
            suspendedUntil: old.suspendedUntil ?? null,
            suspensionType: old.suspensionType ?? null,
          };
        }
      }
      await setDoc(newProfileRef, {
        name,
        isAdmin: carryOver.isAdmin ?? false,
        suspendedUntil: carryOver.suspendedUntil ?? null,
        suspensionType: carryOver.suspensionType ?? null,
        createdAt: Date.now(),
      });
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
                  {/* Phone verification hidden until the phone-auth phase (PhoneVerify.jsx kept in tree) */}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowEditName(true)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

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
              amAdmin={amAdmin}
              suspended={suspended}
              adminName={playerName}
            />

            {/* Signup buttons */}
            {playerName && (
              <div className="action-bar">
                {!isOnList ? (
                  <>
                    <button
                      className="btn btn-in"
                      onClick={() => handleSignIn(0)}
                      disabled={!iCanSignUp || suspended}
                    >
                      In
                    </button>
                    <button
                      className="btn btn-in-plus"
                      onClick={() => handleSignIn(1)}
                      disabled={!iCanSignUp || suspended}
                    >
                      In +1
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
              session={session}
              deviceId={deviceId}
              playerName={playerName}
              isOpen={rollOpen}
              gearPriorityNames={gearPriorityNames}
              gearRoles={gearRoles}
            />

            {/* Drops today (#7) */}
            {session?.drops?.length > 0 && (
              <div className="drops-log">
                <div className="drops-log-title">
                  📤 Drops today <span className="count-badge">{session.drops.length}</span>
                </div>
                {[...session.drops].sort((a, b) => b.at - a.at).map((d, i) => (
                  <div key={`${d.deviceId}-${d.at}-${i}`} className="drops-log-row">
                    <span className="drops-log-name">{d.name}</span>
                    <span className="drops-log-time">{formatTimeET(d.at)}</span>
                  </div>
                ))}
              </div>
            )}

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
                  today={adminDate}
                  adminName={playerName}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showNameEntry && <NameEntry onSave={handleNameSave} />}
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
          onClose={() => setShowPhoneVerify(false)}
        />
      )}
      {showAdminLogin && (
        <AdminLogin onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />
      )}
    </div>
  );
}
