import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch,
  collection, addDoc, query, where, getDocs,
} from 'firebase/firestore';
import {
  normalizeName, parseNames, calculateSuspensionEnd,
  formatDateShort, getCurrentYear, buildFlatList,
  getRollCallPhase, isRollCallOpen, toE164US,
} from '../utils/helpers';
import { accountRef, findAccountByName, ensureAccount, ensureAccountByPhone } from '../utils/identity';

export default function AdminPanel({ session, players, today, adminName }) {
  const [bulkAddInput, setBulkAddInput]   = useState('');
  const [strikeInput, setStrikeInput]     = useState('');
  const [strikeLog, setStrikeLog]         = useState([]);
  const [showStrikeLog, setShowStrikeLog] = useState(false);
  const [toast, setToast]                 = useState('');
  const [toastError, setToastError]       = useState(false);
  const [manageInput, setManageInput]     = useState('');
  const [admins, setAdmins]               = useState([]);

  useEffect(() => {
    if (showStrikeLog) loadStrikeLog();
  }, [showStrikeLog]);

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'accounts'), where('isAdmin', '==', true)));
      setAdmins(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
      );
    } catch (err) {
      console.error('load admins', err);
    }
  };

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
        createdAt: Date.now(),
      });
    }
    return ref;
  }

  async function updateSession(data) {
    const ref = await getOrCreateSession();
    await updateDoc(ref, data);
  }

  // A player is now its own document in the session's players subcollection.
  const playerDoc = (id) => doc(db, 'sessions', today, 'players', id);

  // ── Roll call ─────────────────────────────────────────────────────────────

  // Roll call follows the Eastern-time schedule (opens 3 PM) unless an admin
  // overrides it for the day. Override is stored per-session, so it auto-resets.
  const setRollOverride = async (value) => {
    try {
      const ref = await getOrCreateSession();
      // Tag the override with the current phase so it auto-expires at the next
      // scheduled transition (a morning "Close" won't block the 3 PM open).
      await updateDoc(ref, { override: value, overridePhase: value ? getRollCallPhase() : null });
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
      // Delete every player doc in one atomic batch (batching is the right tool
      // here: one admin clearing many docs at once, not many clients contending).
      const snap = await getDocs(collection(db, 'sessions', today, 'players'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await updateSession({ isOpen: false, drops: [] });
      flash('List reset');
    } catch (err) {
      fireError('Reset list', err);
    }
  };

  // ── Bulk add ─────────────────────────────────────────────────────────────

  const handleBulkAdd = async () => {
    const names = parseNames(bulkAddInput);
    if (!names.length) return;

    await getOrCreateSession();
    const existingNames = new Set((players || []).map((p) => p.name.toLowerCase()));
    const existingUids  = new Set((players || []).map((p) => p.uid).filter(Boolean));

    try {
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
        const id = acct.uid;
        batch.set(playerDoc(id), {
          name: acct.name,
          deviceId: `admin-${normalizeName(acct.name)}`,
          uid: acct.uid,
          isAdmin: acct.isAdmin || false,
          plusOnes: 0,
          priority: false,
          // +added keeps a stable signup order within one batch (same-ms writes).
          signedUpAt: Date.now() + added,
        }, { merge: true });
        existingNames.add(acct.name.toLowerCase());
        existingUids.add(acct.uid);
        added++;
      }
      await batch.commit();
      setBulkAddInput('');
      flash(`Added ${added} player(s)`);
    } catch (err) {
      fireError('Bulk add', err);
    }
  };

  // ── Per-player controls ───────────────────────────────────────────────────

  const handleUpdatePlusOnes = async (playerId, value) => {
    try {
      await updateDoc(playerDoc(playerId), { plusOnes: parseInt(value, 10) });
    } catch (err) {
      fireError('Update +1s', err);
    }
  };

  // Priority is per-day only: it pins the player to the top of THIS session's
  // list. It does NOT grant admin credentials (those come only from the
  // password login) and never touches the player's profile.
  const handleTogglePriority = async (playerId, current) => {
    try {
      await updateDoc(playerDoc(playerId), { priority: !current });
    } catch (err) {
      fireError('Toggle priority', err);
    }
  };

  // Admin is a flag on the person's ACCOUNT (keyed by uid) — so it follows them
  // across name/phone changes and can't be lost to a duplicate. We also tag the
  // roster entry so the badge shows immediately on today's list.
  const handleToggleAdmin = async (playerId, uid, name, current) => {
    try {
      const newVal = !current;
      await updateDoc(playerDoc(playerId), { isAdmin: newVal });
      const acct = uid ? { uid } : await ensureAccount(name);
      await setDoc(accountRef(acct.uid), { isAdmin: newVal }, { merge: true });
      loadAdmins();
    } catch (err) {
      fireError('Toggle admin', err);
    }
  };

  // ── Manage admins & verification BY NAME. Resolves the name to the person's
  // account (creating one if they've never signed up) and flags THAT — the
  // single source of truth for admin power and the verify override. ────────────
  const handleGrantAdminByName = async () => {
    const name = manageInput.trim();
    if (!name) return;
    try {
      const acct = await ensureAccount(name);
      await setDoc(accountRef(acct.uid), { isAdmin: true }, { merge: true });
      setManageInput('');
      flash(`${name} is now an admin.`);
      loadAdmins();
    } catch (err) {
      fireError('Make admin', err);
    }
  };

  const handleRevokeAdmin = async (uid, name) => {
    try {
      await setDoc(accountRef(uid), { isAdmin: false }, { merge: true });
      flash(`Removed admin from ${name || uid}.`);
      loadAdmins();
    } catch (err) {
      fireError('Remove admin', err);
    }
  };

  // Safety valve: manually mark a player verified when their phone can't complete
  // SMS verification, so the sign-up gate never permanently locks anyone out.
  const handleMarkVerifiedByName = async () => {
    const name = manageInput.trim();
    if (!name) return;
    try {
      const acct = await ensureAccount(name);
      await setDoc(accountRef(acct.uid), {
        phoneVerified: true, phoneVerifiedByAdmin: true, phoneVerifiedAt: Date.now(),
      }, { merge: true });
      setManageInput('');
      flash(`${name} marked verified (admin override).`);
    } catch (err) {
      fireError('Mark verified', err);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await deleteDoc(playerDoc(playerId));
    } catch (err) {
      fireError('Remove player', err);
    }
  };

  // ── Strikes ───────────────────────────────────────────────────────────────

  // Every active strike this year for a person — counted across BOTH the new uid
  // key and the legacy normalized-name key, so switching the key never loses
  // history and a person's escalation count can't be split by a name variant.
  // Returns the raw strike docs (id + data), deduped.
  const activeStrikesFor = async (acct, year, excludeId = null) => {
    const seen = new Map();
    for (const key of [acct.uid, normalizeName(acct.name || '')]) {
      if (!key) continue;
      const snap = await getDocs(query(collection(db, 'strikes'), where('playerId', '==', key)));
      snap.docs.forEach((d) => seen.set(d.id, d.data()));
    }
    return [...seen.entries()]
      .filter(([id, s]) => id !== excludeId && s.year === year && !s.undone)
      .map(([id, s]) => ({ id, ...s }));
  };

  const handleIssueStrikes = async () => {
    const entries = parseNames(strikeInput);
    if (!entries.length) return;
    try {
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
      setStrikeInput('');
      flash(`Strike(s) issued to ${entries.length} player(s)`);
      if (showStrikeLog) loadStrikeLog();
    } catch (err) {
      fireError('Issue strikes', err);
    }
  };

  const handleUndoStrike = async (strike) => {
    try {
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
      loadStrikeLog();
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
