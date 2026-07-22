import { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  GEAR_TYPE_ORDER, GEAR_DEFS, gearIcon, gearLabel, gearNeed,
  isGearOpen, gearTakeDate, returnDateOptions, todayKey,
  availableReturnDates, returnSlotsLeft,
  availableToTake, pickFreeSet, coverageForMorning,
  bringersFor, takersFor, gearBringingAlert, gearTakingAlert,
  myCommitments, upcomingMornings,
} from '../utils/gear';

const LEDGER = doc(db, 'gear', 'ledger');

function fmtDay(key) {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Auto-confirm a gear person on a given day's lineup, tagged with their role:
//   'bringer' → they carry the set IN that morning (their return date)
//   'taker'   → they take the set HOME after that morning's game (their take date)
// Pass type=null to clear the marker (used when a commitment is cancelled).
async function setGearRole(dateKey, { name, deviceId, isAdmin }, role, type) {
  const field = role === 'bringer' ? 'gearBringer' : 'gearTaker';
  const ref = doc(db, 'sessions', dateKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const players = snap.exists() ? (snap.data().players || []) : [];
    const mine = players.find(
      (p) => p.deviceId === deviceId || p.name.toLowerCase() === name.toLowerCase()
    );
    if (type == null) { // clear
      if (!mine || !mine[field]) return;
      tx.update(ref, { players: players.map((p) => (p === mine ? { ...p, [field]: null } : p)) });
      return;
    }
    let next;
    if (mine) {
      next = players.map((p) => (p === mine ? { ...p, [field]: type } : p));
    } else {
      next = [...players, {
        id: crypto.randomUUID(), name, deviceId, isAdmin: !!isAdmin,
        plusOnes: 0, [field]: type, signedUpAt: Date.now(),
      }];
    }
    if (snap.exists()) tx.update(ref, { players: next });
    else tx.set(ref, { date: dateKey, isOpen: false, players: next, createdAt: Date.now() });
  });
}

export default function GearManager({ playerName, deviceId, amAdmin, suspended, adminName }) {
  const [commitments, setCommitments] = useState([]);
  const [pickerType, setPickerType] = useState(null); // type mid-return-date-pick
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(LEDGER, (snap) => {
      setCommitments(snap.exists() ? (snap.data().commitments || []) : []);
    }, () => setCommitments([]));
    return unsub;
  }, []);

  const takeDate = gearTakeDate();
  const open = isGearOpen();
  const coverage = coverageForMorning(commitments, takeDate);
  const bringingRisk = gearBringingAlert(commitments);
  const takingRisk = gearTakingAlert(commitments);
  const mine = myCommitments(commitments, deviceId, playerName);

  // ── Player: claim a set + return date (atomic) ────────────────────────────
  const claimGear = async (type, returnDate) => {
    if (!playerName || suspended || !isGearOpen() || busy) return;
    setBusy(true);
    try {
      let assignedSet = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        const cs = snap.exists() ? (snap.data().commitments || []) : [];
        // One person may hold only one set of a given type (e.g. not both goals).
        const alreadyHas = cs.some(
          (c) => c.status === 'committed' && c.type === type &&
            (c.takerDeviceId === deviceId ||
             (c.takerName || '').toLowerCase() === playerName.toLowerCase())
        );
        if (alreadyHas) return;
        if (returnSlotsLeft(cs, type, returnDate) <= 0) return; // that day filled up
        const setId = pickFreeSet(cs, type, takeDate);
        if (!setId) return; // lost the race — no set free
        assignedSet = setId;
        const entry = {
          id: crypto.randomUUID(), type, setId,
          takerName: playerName, takerDeviceId: deviceId, takerIsAdmin: !!amAdmin,
          takeDate, returnDate, status: 'committed', returnedOnTime: null,
          createdAt: Date.now(), source: 'player',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      if (assignedSet) {
        const who = { name: playerName, deviceId, isAdmin: amAdmin };
        await setGearRole(takeDate, who, 'taker', type);     // playing the take day
        await setGearRole(returnDate, who, 'bringer', type); // playing the return day
      }
    } catch (err) {
      console.error('[FTFC] claim gear failed:', err);
    } finally {
      setBusy(false);
      setPickerType(null);
    }
  };

  const cancelCommitment = async (id) => {
    if (busy) return;
    if (!window.confirm('Cancel this gear commitment?')) return;
    setBusy(true);
    try {
      const c = commitments.find((x) => x.id === id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        if (!snap.exists()) return;
        const cs = snap.data().commitments || [];
        tx.update(LEDGER, { commitments: cs.filter((x) => x.id !== id) });
      });
      if (c) {
        const who = { name: c.takerName, deviceId: c.takerDeviceId };
        await setGearRole(c.takeDate, who, 'taker', null);
        await setGearRole(c.returnDate, who, 'bringer', null);
      }
    } catch (err) {
      console.error('[FTFC] cancel gear failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // ── Admin actions (#6) ────────────────────────────────────────────────────
  const patchCommitment = async (id, patch) => {
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        if (!snap.exists()) return;
        const cs = snap.data().commitments || [];
        tx.update(LEDGER, {
          commitments: cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        });
      });
    } catch (err) {
      console.error('[FTFC] admin gear update failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const markReturned = (id, onTime) =>
    patchCommitment(id, {
      status: 'returned', returnedOnTime: onTime, returnedAt: Date.now(),
      returnedBy: adminName || 'admin',
    });

  const reassign = (c) => {
    const name = window.prompt(`Reassign ${gearLabel(c.type)} (currently ${c.takerName}) to:`, c.takerName);
    if (!name || !name.trim()) return;
    patchCommitment(c.id, { takerName: name.trim(), takerDeviceId: null, source: adminName || 'admin' });
  };

  // mode: 'take'  → they take it home after the upcoming game, bring back on date
  //       'held'  → they ALREADY have it (seeded starting state), brings back on date
  const addManual = async (type, takerName, date, mode) => {
    if (!takerName.trim()) return;
    const held = mode === 'held';
    setBusy(true);
    try {
      let ok = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        const cs = snap.exists() ? (snap.data().commitments || []) : [];
        let setId = pickFreeSet(cs, type, held ? todayKey() : takeDate);
        if (!setId) {
          if (held) return;            // no free physical set to mark as held
          setId = `${type}-override`;  // admin force for a take
        }
        ok = true;
        const entry = {
          id: crypto.randomUUID(), type, setId,
          takerName: takerName.trim(), takerDeviceId: null, takerIsAdmin: false,
          takeDate: held ? todayKey() : takeDate, returnDate: date, held,
          status: 'committed', returnedOnTime: null,
          createdAt: Date.now(), source: adminName || 'admin',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      if (ok) {
        const who = { name: takerName.trim(), deviceId: `admin-gear-${crypto.randomUUID()}`, isAdmin: false };
        if (held) {
          await setGearRole(date, who, 'bringer', type);   // brings it back only
        } else {
          await setGearRole(takeDate, who, 'taker', type);
          await setGearRole(date, who, 'bringer', type);
        }
      }
    } catch (err) {
      console.error('[FTFC] manual add failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (!playerName) return null;

  return (
    <div className="gear-panel">
      {/* Bringing alert — from the 10 AM list reset (#5) */}
      {bringingRisk && (
        <div className="gear-risk">
          ⚠️ <strong>GEAR AT RISK</strong> for {fmtDay(bringingRisk.date)} — no one bringing{' '}
          {bringingRisk.missing.map((m) => `${gearIcon(m.type)} ${gearLabel(m.type)} (${m.have}/${m.need})`).join(', ')}.
        </div>
      )}
      {/* Taking alert — from 6 PM: gear not being carried to the next game */}
      {takingRisk && (
        <div className="gear-risk gear-risk-take">
          ⏳ <strong>NOBODY TAKING GEAR HOME</strong> after {fmtDay(takingRisk.date)} —{' '}
          {takingRisk.missing.map((m) => `${gearIcon(m.type)} ${gearLabel(m.type)} (${m.have}/${m.need})`).join(', ')}{' '}
          won't reach the next game.
        </div>
      )}

      {/* Who's bringing gear over the next game days */}
      <div className="gear-bring-banner">
        <div className="gear-bring-title">📥 Bringing gear</div>
        {upcomingMornings(3).map((m) => {
          const bring = bringersFor(commitments, m);
          return (
            <div key={m} className="gear-bring-day">
              <div className="gear-bring-date">{fmtDay(m)}</div>
              <div className="gear-bring-types">
                {GEAR_TYPE_ORDER.map((t) => {
                  const names = bring.filter((c) => c.type === t).map((c) => c.takerName);
                  const short = gearNeed(t) - names.length;
                  return (
                    <div key={t} className="gear-bring-type">
                      <span className="gear-bring-ticon">{gearIcon(t)}</span>
                      <span className="gear-bring-names">
                        {short > 0 && (
                          <span className="gear-bring-missing">needed{short > 1 ? ` ×${short}` : ''}</span>
                        )}
                        {names.length > 0 && <span className="gear-bring-name">{names.join(' · ')}</span>}
                        {names.length === 0 && short <= 0 && <span className="gear-bring-none">—</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="gear-panel-head">
        <span className="gear-panel-title">🎒 Gear for {fmtDay(takeDate)}</span>
        <span className="gear-coverage">
          {GEAR_TYPE_ORDER.map((t) => (
            <span key={t} className={`gear-chip ${coverage.status[t].ok ? 'ok' : 'short'}`}>
              {gearIcon(t)} {coverage.status[t].have}/{coverage.status[t].need}
            </span>
          ))}
        </span>
      </div>

      {/* Volunteer to take (#1, #4) */}
      {!open ? (
        <p className="gear-note">Gear sign-up opens at 11:00 AM.</p>
      ) : pickerType ? (
        (() => {
          const opts = availableReturnDates(commitments, pickerType, takeDate);
          return (
            <div className="gear-picker">
              <p className="gear-note">
                When will you bring the {gearLabel(pickerType).toLowerCase()} back?
                {opts.length === 1 &&
                  <strong> Only {fmtDay(opts[0])} is open — the other days are full, so you'll need to bring it back then.</strong>}
              </p>
              <div className="gear-date-row">
                {opts.map((rd) => (
                  <button key={rd} className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => claimGear(pickerType, rd)}>
                    {fmtDay(rd)}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setPickerType(null)}>Cancel</button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="gear-take-row">
          {GEAR_TYPE_ORDER.map((t) => {
            const left = availableToTake(commitments, t, takeDate);
            const openDays = availableReturnDates(commitments, t, takeDate).length;
            const owned = mine.some((c) => c.type === t);
            const disabled = suspended || owned || left <= 0 || openDays === 0;
            return (
              <button key={t} className="gear-take-btn" disabled={disabled}
                onClick={() => setPickerType(t)}>
                <span className="gear-take-icon">{gearIcon(t)}</span>
                <span className="gear-take-label">Take {gearLabel(t)}</span>
                <span className="gear-take-left">
                  {owned ? 'already yours'
                    : left <= 0 ? 'none left'
                    : openDays === 0 ? 'no open days'
                    : `${left} available`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* My commitments */}
      {mine.length > 0 && (
        <div className="gear-mine">
          {mine.map((c) => (
            <div key={c.id} className="gear-mine-row">
              <span>{gearIcon(c.type)} You're bringing <strong>{gearLabel(c.type)}</strong> back {fmtDay(c.returnDate)}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => cancelCommitment(c.id)}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      {/* Daily schedule (#3) */}
      <button className="btn btn-ghost btn-full btn-sm" onClick={() => setShowSchedule(!showSchedule)}>
        {showSchedule ? '▲ Hide gear schedule' : '📅 Gear schedule (next days)'}
      </button>
      {showSchedule && (
        <div className="gear-schedule">
          {upcomingMornings(6).map((m) => {
            const bring = bringersFor(commitments, m);
            const take = takersFor(commitments, m);
            const cov = coverageForMorning(commitments, m);
            return (
              <div key={m} className="gear-day">
                <div className="gear-day-head">
                  <strong>{fmtDay(m)}</strong>
                  {GEAR_TYPE_ORDER.map((t) => (
                    <span key={t} className={`gear-chip sm ${cov.status[t].ok ? 'ok' : 'short'}`}>
                      {gearIcon(t)}{cov.status[t].have}/{cov.status[t].need}
                    </span>
                  ))}
                </div>
                <div className="gear-day-body">
                  <div><span className="gear-role">Bringing in:</span>{' '}
                    {bring.length ? bring.map((c) => `${gearIcon(c.type)} ${c.takerName}`).join(', ') : '—'}
                  </div>
                  <div><span className="gear-role">Taking home:</span>{' '}
                    {take.length ? take.map((c) => `${gearIcon(c.type)} ${c.takerName}`).join(', ') : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin management (#6) */}
      {amAdmin && (
        <>
          <button className="btn btn-ghost btn-full btn-sm" onClick={() => setShowAdmin(!showAdmin)}>
            {showAdmin ? '▲ Hide gear admin' : '⚙️ Gear admin'}
          </button>
          {showAdmin && (
            <GearAdmin
              commitments={commitments} busy={busy} takeDate={takeDate}
              onMarkReturned={markReturned} onReassign={reassign}
              onRemove={cancelCommitment} onAdd={addManual}
            />
          )}
        </>
      )}
    </div>
  );
}

function GearAdmin({ commitments, busy, takeDate, onMarkReturned, onReassign, onRemove, onAdd }) {
  const [addType, setAddType] = useState('goal');
  const [addName, setAddName] = useState('');
  const openDays = availableReturnDates(commitments, addType, takeDate);
  const [addReturn, setAddReturn] = useState(returnDateOptions(takeDate, 'goal')[0]);
  const live = commitments.filter((c) => c.status === 'committed');
  const dateChoices = openDays.length ? openDays : returnDateOptions(takeDate, addType);

  return (
    <div className="gear-admin">
      <div className="gear-admin-add">
        <select value={addType} onChange={(e) => {
          setAddType(e.target.value);
          const next = availableReturnDates(commitments, e.target.value, takeDate);
          setAddReturn((next[0] || returnDateOptions(takeDate, e.target.value)[0]));
        }}>
          {GEAR_TYPE_ORDER.map((t) => <option key={t} value={t}>{gearLabel(t)}</option>)}
        </select>
        <input placeholder="Player name" value={addName} onChange={(e) => setAddName(e.target.value)} />
        <select value={addReturn} onChange={(e) => setAddReturn(e.target.value)}>
          {dateChoices.map((rd) => <option key={rd} value={rd}>{fmtDay(rd)}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" disabled={busy || !addName.trim()}
          onClick={() => { onAdd(addType, addName, addReturn, 'take'); setAddName(''); }}>Assign (takes)</button>
        <button className="btn btn-success btn-sm" disabled={busy || !addName.trim()}
          onClick={() => { onAdd(addType, addName, addReturn, 'held'); setAddName(''); }}>Has it (brings back)</button>
      </div>
      <p className="gear-note">
        <strong>Assign</strong> = they'll take it home after the next game.{' '}
        <strong>Has it</strong> = they already hold it — seeds the set as out, they bring it back on the date.
      </p>

      {live.length === 0 ? (
        <p className="gear-note">No active gear commitments.</p>
      ) : live.map((c) => (
        <div key={c.id} className="gear-admin-row">
          <span className="gear-admin-info">
            {gearIcon(c.type)} <strong>{c.takerName}</strong> · take {fmtDay(c.takeDate)} → back {fmtDay(c.returnDate)}
            <span className="gear-admin-set"> [{c.setId}]</span>
          </span>
          <div className="gear-admin-actions">
            <button className="btn btn-sm btn-success" disabled={busy} onClick={() => onMarkReturned(c.id, true)}>Returned</button>
            <button className="btn btn-sm btn-warning" disabled={busy} onClick={() => onMarkReturned(c.id, false)}>Late</button>
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onReassign(c)}>Reassign</button>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => onRemove(c.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
