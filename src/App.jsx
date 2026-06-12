import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase/config';
import {
  doc, onSnapshot, setDoc, getDoc, updateDoc,
} from 'firebase/firestore';
import NameEntry   from './components/NameEntry';
import AdminLogin  from './components/AdminLogin';
import PlayerList  from './components/PlayerList';
import AdminPanel  from './components/AdminPanel';
import Rules       from './components/Rules';
import {
  getSessionDate, getTomorrow, getDeviceId, normalizeName,
  isSuspended, formatDate,
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
  const [showAdminLogin,  setShowAdminLogin]  = useState(false);
  const [showAdminPanel,  setShowAdminPanel]  = useState(false);

  // ── Firebase state ────────────────────────────────────────────────────────
  const [session,       setSession]       = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [loading,       setLoading]       = useState(true);

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

  // ── Actions ───────────────────────────────────────────────────────────────

  const ensureSession = useCallback(async () => {
    const ref = doc(db, 'sessions', today);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { date: today, isOpen: false, players: [], createdAt: Date.now() });
    }
    return ref;
  }, [today]);

  const handleSignIn = useCallback(async (plusOnes = 0) => {
    if (!session?.isOpen || !playerName || suspended) return;

    const profile = playerProfile;
    const playerIsAdmin = isAdmin || profile?.isAdmin || false;

    const entry = {
      id: crypto.randomUUID(),
      name: playerName,
      deviceId,
      isAdmin: playerIsAdmin,
      plusOnes,
      signedUpAt: Date.now(),
    };

    const currentPlayers = session.players || [];
    // Prevent duplicate by deviceId or name
    if (currentPlayers.some(
      (p) => p.deviceId === deviceId || p.name.toLowerCase() === playerName.toLowerCase()
    )) return;

    const ref = await ensureSession();
    await updateDoc(ref, { players: [...currentPlayers, entry] });
  }, [session, playerName, deviceId, suspended, isAdmin, playerProfile, ensureSession]);

  const handleSignOut = useCallback(async () => {
    if (!session || !playerName) return;
    const ref = doc(db, 'sessions', today);
    const newPlayers = (session.players || []).filter(
      (p) => p.deviceId !== deviceId && p.name.toLowerCase() !== playerName.toLowerCase()
    );
    await updateDoc(ref, { players: newPlayers });
  }, [session, playerName, deviceId, today]);

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
              <span className={`roll-status ${session?.isOpen ? 'open' : 'closed'}`}>
                {session?.isOpen ? '🟢 Roll call open' : '🔴 Roll call closed'}
              </span>
            </div>

            {/* Signed-in identity */}
            {playerName && (
              <div className="you-row">
                <span className="you-row-label">
                  Signed in as <strong>{playerName}</strong>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowEditName(true)}
                >
                  Edit
                </button>
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

            {/* Signup buttons */}
            {playerName && (
              <div className="action-bar">
                {!isOnList ? (
                  <>
                    <button
                      className="btn btn-in"
                      onClick={() => handleSignIn(0)}
                      disabled={!session?.isOpen || suspended}
                    >
                      In
                    </button>
                    <button
                      className="btn btn-in-plus"
                      onClick={() => handleSignIn(1)}
                      disabled={!session?.isOpen || suspended}
                    >
                      In +1
                    </button>
                  </>
                ) : (
                  <button className="btn btn-out" onClick={handleSignOut}>
                    Out
                  </button>
                )}
                {!session?.isOpen && !isOnList && (
                  <p className="action-hint">Roll call opens at 3:00 PM</p>
                )}
              </div>
            )}

            {/* Player list */}
            <PlayerList
              session={session}
              deviceId={deviceId}
              playerName={playerName}
            />

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
      {showAdminLogin && (
        <AdminLogin onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />
      )}
    </div>
  );
}
