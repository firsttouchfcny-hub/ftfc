import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, getDoc, updateDoc,
  collection, addDoc, query, where, getDocs,
} from 'firebase/firestore';
import {
  normalizeName, parseNames, calculateSuspensionEnd,
  formatDateShort, getCurrentYear, buildFlatList,
  getRollCallPhase, isRollCallOpen,
} from '../utils/helpers';

export default function AdminPanel({ session, today, adminName }) {
  const [bulkAddInput, setBulkAddInput]   = useState('');
  const [strikeInput, setStrikeInput]     = useState('');
  const [strikeLog, setStrikeLog]         = useState([]);
  const [showStrikeLog, setShowStrikeLog] = useState(false);
  const [toast, setToast]                 = useState('');
  const [toastError, setToastError]       = useState(false);

  useEffect(() => {
    if (showStrikeLog) loadStrikeLog();
  }, [showStrikeLog]);

  const flash = (msg, isError = false) => {
    setToast(isError ? `❌ ${msg}` : msg);
    setToastError(isError);
    setTimeout(() => setToast(''), 5000);
  };

  const fireError = (action, err) => {
    console.error(action, err);
    const msg = err?.code === 'permission-denied'
      ? `Permission denied — check Firestore security rules in Firebase console.`
      : `${action} failed: ${err?.message || err}`;
    flash(msg, true);
  };

  const loadStrikeLog = async () => {
    const year = getCurrentYear();
    const q = query(collection(db, 'strikes'), where('year', '==', year));
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.issuedAt - a.issuedAt);
    setStrikeLog(list);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function getOrCreateSession() {
    const ref = doc(db, 'sessions', today);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        date: today,
        isOpen: false,
        players: [],
        createdAt: Date.now(),
      });
    }
    return ref;
  }

  async function updateSession(data) {
    const ref = await getOrCreateSession();
    await updateDoc(ref, data);
  }

  async function ensurePlayerProfile(name) {
    const id = normalizeName(name);
    const ref = doc(db, 'players', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name,
        isAdmin: false,
        suspendedUntil: null,
        suspensionType: null,
        createdAt: Date.now(),
      });
      return { name, isAdmin: false };
    }
    return snap.data();
  }

  // ── Roll call ─────────────────────────────────────────────────────────────

  // Roll call follows the Eastern-time schedule (opens 3 PM) unless an admin
  // overrides it for the day. Override is stored per-session, so it auto-resets.
  const setRollOverride = async (value) => {
    try {
      const ref = await getOrCreateSession();
      await updateDoc(ref, { override: value });
      flash(
        value === 'open'   ? '✅ Roll call forced open'   :
        value === 'closed' ? '🔴 Roll call forced closed' :
                             '↩️ Back to automatic schedule'
      );
    } catch (err) {
      fireError('Set roll call', err);
    }
  };

  const handleResetList = async () => {
    if (!confirm('Reset the player list for today? This cannot be undone.')) return;
    try {
      await updateSession({ players: [], isOpen: false });
      flash('List reset');
    } catch (err) {
      fireError('Reset list', err);
    }
  };

  // ── Bulk add ─────────────────────────────────────────────────────────────

  const handleBulkAdd = async () => {
    const names = parseNames(bulkAddInput);
    if (!names.length) return;

    const ref = await getOrCreateSession();
    const snap = await getDoc(ref);
    const current = snap.data()?.players || [];
    const existing = new Set(current.map((p) => p.name.toLowerCase()));

    const toAdd = [];
    for (const name of names) {
      if (existing.has(name.toLowerCase())) continue;
      const profile = await ensurePlayerProfile(name);
      toAdd.push({
        id: crypto.randomUUID(),
        name,
        deviceId: `admin-added-${crypto.randomUUID()}`,
        isAdmin: profile.isAdmin || false,
        plusOnes: 0,
        signedUpAt: Date.now(),
      });
      existing.add(name.toLowerCase());
    }

    try {
      await updateDoc(ref, { players: [...current, ...toAdd] });
      setBulkAddInput('');
      flash(`Added ${toAdd.length} player(s)`);
    } catch (err) {
      fireError('Bulk add', err);
    }
  };

  // ── Per-player controls ───────────────────────────────────────────────────

  const handleUpdatePlusOnes = async (playerId, value) => {
    try {
      const newPlayers = (session?.players || []).map((p) =>
        p.id === playerId ? { ...p, plusOnes: parseInt(value, 10) } : p
      );
      await updateSession({ players: newPlayers });
    } catch (err) {
      fireError('Update +1s', err);
    }
  };

  // Priority is per-day only: it pins the player to the top of THIS session's
  // list. It does NOT grant admin credentials (those come only from the
  // password login) and never touches the player's profile.
  const handleTogglePriority = async (playerId, current) => {
    try {
      const newPlayers = (session?.players || []).map((p) =>
        p.id === playerId ? { ...p, priority: !current } : p
      );
      await updateSession({ players: newPlayers });
    } catch (err) {
      fireError('Toggle priority', err);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      const newPlayers = (session?.players || []).filter((p) => p.id !== playerId);
      await updateSession({ players: newPlayers });
    } catch (err) {
      fireError('Remove player', err);
    }
  };

  // ── Strikes ───────────────────────────────────────────────────────────────

  const handleIssueStrikes = async () => {
    const names = parseNames(strikeInput);
    if (!names.length) return;
    try {
      const year = getCurrentYear();
      for (const name of names) {
        const playerId = normalizeName(name);
        const q = query(collection(db, 'strikes'), where('playerId', '==', playerId));
        const snap = await getDocs(q);
        const activeCount = snap.docs.filter(
          (d) => d.data().year === year && !d.data().undone
        ).length;
        const newCount = activeCount + 1;
        const suspendedUntil = calculateSuspensionEnd(newCount);
        const profileRef = doc(db, 'players', playerId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          await updateDoc(profileRef, { suspendedUntil, suspensionType: 'strike' });
        } else {
          await setDoc(profileRef, {
            name, isAdmin: false, suspendedUntil, suspensionType: 'strike', createdAt: Date.now(),
          });
        }
        await addDoc(collection(db, 'strikes'), {
          playerName: name, playerId, issuedAt: Date.now(), year,
          strikeNumber: newCount, undone: false, issuedBy: adminName || 'admin', suspendedUntil,
        });
      }
      setStrikeInput('');
      flash(`Strike(s) issued to ${names.length} player(s)`);
      if (showStrikeLog) loadStrikeLog();
    } catch (err) {
      fireError('Issue strikes', err);
    }
  };

  const handleUndoStrike = async (strike) => {
    try {
      const strikeRef = doc(db, 'strikes', strike.id);
      await updateDoc(strikeRef, { undone: true });
      const year = getCurrentYear();
      const q = query(collection(db, 'strikes'), where('playerId', '==', strike.playerId));
      const snap = await getDocs(q);
      const remaining = snap.docs.filter(
        (d) => d.id !== strike.id && d.data().year === year && !d.data().undone
      ).length;
      const profileRef = doc(db, 'players', strike.playerId);
      if (remaining === 0) {
        await updateDoc(profileRef, { suspendedUntil: null, suspensionType: null });
      } else {
        await updateDoc(profileRef, {
          suspendedUntil: calculateSuspensionEnd(remaining),
          suspensionType: 'strike',
        });
      }
      loadStrikeLog();
      flash('Strike undone');
    } catch (err) {
      fireError('Undo strike', err);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const mainPlayers = buildFlatList(session?.players || []).filter((p) => p.isMainEntry);

  const phase    = getRollCallPhase();           // closed | admins-only | open
  const rollOpen = isRollCallOpen(session);
  const override = session?.override || null;    // 'open' | 'closed' | null
  const stateLabel = rollOpen ? 'OPEN' : phase === 'admins-only' ? 'ADMINS ONLY' : 'CLOSED';

  return (
    <div className="admin-panel">
      <h3 className="admin-panel-title">⚙️ Admin Panel</h3>

      {toast && <div className={`admin-toast${toastError ? ' admin-toast-error' : ''}`}>{toast}</div>}

      {/* Roll Call */}
      <div className="admin-block">
        <h4>Roll Call</h4>
        <p className="admin-hint">
          Auto: resets 10:00 AM ET · opens to all 3:00 PM ET · now{' '}
          <strong>{stateLabel}</strong>
          {override && <span> (manual override: {override})</span>}
        </p>
        <div className="btn-row">
          {!rollOpen ? (
            <button className="btn btn-success" onClick={() => setRollOverride('open')}>
              Open Now
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => setRollOverride('closed')}>
              Close Now
            </button>
          )}
          {override && (
            <button className="btn btn-ghost" onClick={() => setRollOverride(null)}>
              Back to Auto
            </button>
          )}
          <button className="btn btn-danger" onClick={handleResetList}>
            Reset List
          </button>
        </div>
      </div>

      {/* Bulk Add */}
      <div className="admin-block">
        <h4>Bulk Add Players</h4>
        <textarea
          className="admin-textarea"
          placeholder="Names separated by commas or line breaks…"
          value={bulkAddInput}
          onChange={(e) => setBulkAddInput(e.target.value)}
          rows={4}
        />
        <button className="btn btn-primary" onClick={handleBulkAdd}>
          Add to List
        </button>
      </div>

      {/* Manage Players */}
      {mainPlayers.length > 0 && (
        <div className="admin-block">
          <h4>Manage Players <span className="count-badge">{mainPlayers.length}</span></h4>
          <div className="admin-player-list">
            {mainPlayers.map((p) => (
              <div key={p.id} className="admin-player-row">
                <span className="admin-player-name">
                  {p.name}
                  {p.isAdmin && <span className="badge badge-admin">admin</span>}
                  {p.priority && <span className="badge badge-priority">priority</span>}
                </span>
                <div className="admin-controls">
                  <label className="ctrl-label">
                    +1s
                    <select
                      className="plusone-select"
                      value={p.plusOnes || 0}
                      onChange={(e) => handleUpdatePlusOnes(p.id, e.target.value)}
                    >
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ctrl-label">
                    <input
                      type="checkbox"
                      checked={p.priority || false}
                      onChange={() => handleTogglePriority(p.id, p.priority)}
                    />
                    Priority
                  </label>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemovePlayer(p.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue Strikes */}
      <div className="admin-block">
        <h4>Issue Strikes</h4>
        <textarea
          className="admin-textarea"
          placeholder="Names separated by commas or line breaks…"
          value={strikeInput}
          onChange={(e) => setStrikeInput(e.target.value)}
          rows={3}
        />
        <button className="btn btn-warning" onClick={handleIssueStrikes}>
          ⚡ Issue Strikes
        </button>
      </div>

      {/* Strike Log */}
      <div className="admin-block">
        <button
          className="btn btn-ghost btn-full"
          onClick={() => setShowStrikeLog(!showStrikeLog)}
        >
          {showStrikeLog ? '▲ Hide Strike Log' : '▼ View Strike Log'}
        </button>

        {showStrikeLog && (
          <div className="strike-log">
            {strikeLog.length === 0 ? (
              <p className="log-empty">No strikes issued this year.</p>
            ) : (
              strikeLog.map((s) => (
                <div key={s.id} className={`strike-entry${s.undone ? ' undone' : ''}`}>
                  <div className="strike-meta">
                    <strong>{s.playerName}</strong>
                    <span className="strike-num">Strike #{s.strikeNumber}</span>
                    <span className="strike-date">{formatDateShort(s.issuedAt)}</span>
                    {!s.undone && s.suspendedUntil && (
                      <span className="strike-ban">
                        Banned until {formatDateShort(s.suspendedUntil)}
                      </span>
                    )}
                    {s.undone && <span className="badge badge-undone">Undone</span>}
                  </div>
                  {!s.undone && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleUndoStrike(s)}
                    >
                      Undo
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
