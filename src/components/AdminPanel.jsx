import { useState, useEffect, useCallback } from 'react';
import {
  parseNames, formatDateShort, buildFlatList,
  getRollCallPhase, isRollCallOpen,
} from '../utils/helpers';

// `actions` is the seam to the backing store, and is REQUIRED: the panel itself
// knows nothing about Firestore, so whoever renders it chooses the store.
// Production passes createFirestoreAdminActions() (see App.jsx); the redesign
// passes a mock, so the panel can be clicked through without touching real
// players. Keeping the import out of this file is what lets the redesign — which
// has no Firebase config — render the panel at all. See utils/adminActions.js.
export default function AdminPanel({ session, players, actions }) {
  const [bulkAddInput, setBulkAddInput]   = useState('');
  const [strikeInput, setStrikeInput]     = useState('');
  const [strikeLog, setStrikeLog]         = useState([]);
  const [showStrikeLog, setShowStrikeLog] = useState(false);
  const [toast, setToast]                 = useState('');
  const [toastError, setToastError]       = useState(false);
  const [manageInput, setManageInput]     = useState('');
  const [admins, setAdmins]               = useState([]);

  const api = actions;

  const flash = useCallback((msg, isError = false) => {
    setToast(isError ? `❌ ${msg}` : msg);
    setToastError(isError);
    setTimeout(() => setToast(''), 5000);
  }, []);

  const fireError = useCallback((action, err) => {
    console.error(action, err);
    const msg = err?.code === 'permission-denied'
      ? `Permission denied — check Firestore security rules in Firebase console.`
      : `${action} failed: ${err?.message || err}`;
    flash(msg, true);
  }, [flash]);

  const refreshAdmins = useCallback(async () => {
    try {
      setAdmins(await api.loadAdmins());
    } catch (err) {
      console.error('load admins', err);
    }
  }, [api]);

  const refreshStrikeLog = useCallback(async () => {
    try {
      setStrikeLog(await api.loadStrikeLog());
    } catch (err) {
      fireError('Load strike log', err);
    }
  }, [api, fireError]);

  // Declared above the effects that call them, so nothing is referenced before
  // it exists and the dependency lists can be honest.
  //
  // set-state-in-effect is disabled on both: these load data asynchronously, so
  // the setState lands after an await rather than synchronously during the
  // effect. The rule can't see through the async boundary.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showStrikeLog) refreshStrikeLog();
  }, [showStrikeLog, refreshStrikeLog]);

  useEffect(() => { refreshAdmins(); }, [refreshAdmins]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Roll call ─────────────────────────────────────────────────────────────

  // Roll call follows the Eastern-time schedule (opens 3 PM) unless an admin
  // overrides it for the day. Override is stored per-session, so it auto-resets.
  const setRollOverride = async (value) => {
    try {
      await api.setRollOverride(value);
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
      await api.resetList();
      flash('List reset');
    } catch (err) {
      fireError('Reset list', err);
    }
  };

  // ── Bulk add ─────────────────────────────────────────────────────────────

  const handleBulkAdd = async () => {
    const names = parseNames(bulkAddInput);
    if (!names.length) return;
    try {
      const added = await api.bulkAdd(names, players);
      setBulkAddInput('');
      flash(`Added ${added} player(s)`);
    } catch (err) {
      fireError('Bulk add', err);
    }
  };

  // ── Per-player controls ───────────────────────────────────────────────────

  const handleUpdatePlusOnes = async (playerId, value) => {
    try {
      const player = (players || []).find((x) => x.id === playerId);
      await api.updatePlusOnes(playerId, value, player);
    } catch (err) {
      fireError('Update +1s', err);
    }
  };

  const handleTogglePriority = async (playerId, current) => {
    try {
      await api.togglePriority(playerId, current);
    } catch (err) {
      fireError('Toggle priority', err);
    }
  };

  const handleToggleAdmin = async (playerId, uid, name, current) => {
    try {
      await api.toggleAdmin(playerId, uid, name, current);
      refreshAdmins();
    } catch (err) {
      fireError('Toggle admin', err);
    }
  };

  // ── Manage admins & verification BY NAME ─────────────────────────────────

  const handleGrantAdminByName = async () => {
    const name = manageInput.trim();
    if (!name) return;
    try {
      await api.grantAdminByName(name);
      setManageInput('');
      flash(`${name} is now an admin.`);
      refreshAdmins();
    } catch (err) {
      fireError('Make admin', err);
    }
  };

  const handleRevokeAdmin = async (uid, name) => {
    try {
      await api.revokeAdmin(uid, name);
      flash(`Removed admin from ${name || uid}.`);
      refreshAdmins();
    } catch (err) {
      fireError('Remove admin', err);
    }
  };

  const handleMarkVerifiedByName = async () => {
    const name = manageInput.trim();
    if (!name) return;
    try {
      await api.markVerifiedByName(name);
      setManageInput('');
      flash(`${name} marked verified (admin override).`);
    } catch (err) {
      fireError('Mark verified', err);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await api.removePlayer(playerId);
    } catch (err) {
      fireError('Remove player', err);
    }
  };

  // ── Strikes ───────────────────────────────────────────────────────────────

  const handleIssueStrikes = async () => {
    const entries = parseNames(strikeInput);
    if (!entries.length) return;
    try {
      const count = await api.issueStrikes(entries);
      setStrikeInput('');
      flash(`Strike(s) issued to ${count} player(s)`);
      if (showStrikeLog) refreshStrikeLog();
    } catch (err) {
      fireError('Issue strikes', err);
    }
  };

  const handleUndoStrike = async (strike) => {
    try {
      await api.undoStrike(strike);
      refreshStrikeLog();
      flash('Strike undone');
    } catch (err) {
      fireError('Undo strike', err);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const mainPlayers = buildFlatList(players || []).filter((p) => p.isMainEntry);

  const phase    = getRollCallPhase();           // closed | admins-only | open
  const rollOpen = isRollCallOpen(session);
  // An override only counts while we're still in the phase it was set in.
  const overrideActive = session?.override && session?.overridePhase === phase
    ? session.override : null;                   // 'open' | 'closed' | null
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
          {overrideActive && <span> (manual override: {overrideActive})</span>}
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
          {overrideActive && (
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

      {/* Manage Admins & Verification */}
      <div className="admin-block">
        <h4>Admins &amp; Verification</h4>
        <p className="admin-hint">
          Assign admin roles, or manually mark a player verified (safety valve if
          their phone can’t get the SMS code). Works by name — even if they’re not
          on today’s list.
        </p>
        <input
          className="form-input"
          placeholder="Player’s name…"
          value={manageInput}
          onChange={(e) => setManageInput(e.target.value)}
        />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleGrantAdminByName}>
            Make admin
          </button>
          <button className="btn btn-success" onClick={handleMarkVerifiedByName}>
            Mark verified
          </button>
        </div>
        {admins.length > 0 && (
          <div className="admin-player-list" style={{ marginTop: 10 }}>
            {admins.map((a) => (
              <div key={a.id} className="admin-player-row">
                <span className="admin-player-name">
                  {a.name || a.id}
                  <span className="badge badge-admin">admin</span>
                  {a.phoneVerified && (
                    <span className="badge badge-verified">✓ verified</span>
                  )}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRevokeAdmin(a.id, a.name)}
                >
                  Remove admin
                </button>
              </div>
            ))}
          </div>
        )}
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
                  <label className="ctrl-label">
                    <input
                      type="checkbox"
                      checked={p.isAdmin || false}
                      onChange={() => handleToggleAdmin(p.id, p.uid, p.name, p.isAdmin)}
                    />
                    Admin
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
          placeholder="Phone numbers (best) or names, comma/line separated…"
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
