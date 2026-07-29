import { useState, useEffect } from 'react';
import {
  doc, onSnapshot, runTransaction, collection, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ensureAccount } from '../utils/identity';
import { isSamePerson, rosterDocId } from '../utils/helpers';
import {
  GEAR_TYPE_ORDER, GEAR_DEFS, gearIcon, gearLabel, gearNeed,
  isGearOpen, gearTakeDate, todayKey, gameDaysAfter,
  availableReturnDates, playerReturnDates, returnSlotsLeft,
  availableToTake, takeBlockedByPriority, pickFreeSet, coverageForMorning,
  bringersFor, takersFor, gearBringingAlert, gearTakingAlert,
  myCommitments, upcomingMornings, setStatuses,
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
async function setGearRole(dateKey, { name, deviceId, uid, isAdmin }, role, type) {
  const field = role === 'bringer' ? 'gearBringer' : 'gearTaker';
  const col = collection(db, 'sessions', dateKey, 'players');
  // Find any existing roster entry for this person (by stable uid, else their
  // device-keyed doc, else a name match) so we tag the same doc rather than
  // creating a duplicate. Each person writes only their own doc, so committing
  // to gear never contends with anyone else's write.
  const snap = await getDocs(col);
  const mineDoc = snap.docs.find((d) => isSamePerson(d.data(), { uid, deviceId, name }));

  if (type == null) { // clear the role marker (leaves them on the roster)
    if (mineDoc) await updateDoc(mineDoc.ref, { [field]: null });
    return;
  }
  if (mineDoc) {
    await updateDoc(mineDoc.ref, { [field]: type });
  } else {
    // Not on this day's roster yet → auto-add them, keyed by their stable uid
    // (deviceId only until an account is resolved), matching sign-in so gear and
    // a later self-signup land on the SAME row. Committing to gear signs you up.
    await setDoc(doc(col, rosterDocId({ uid, deviceId })), {
      name, deviceId, uid: uid || null, isAdmin: !!isAdmin,
      plusOnes: 0, [field]: type, signedUpAt: Date.now(),
    });
  }
}

export default function GearManager({ playerName, deviceId, uid, amAdmin, suspended, adminName }) {
  const [commitments, setCommitments] = useState([]);
  const [loaded, setLoaded] = useState(false); // ledger has arrived from Firebase
  const [pickerType, setPickerType] = useState(null); // type mid-return-date-pick
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(LEDGER, (snap) => {
      setCommitments(snap.exists() ? (snap.data().commitments || []) : []);
      setLoaded(true);
    }, () => setLoaded(true));
    return unsub;
  }, []);

  const takeDate = gearTakeDate();
  const open = isGearOpen();
  const coverage = coverageForMorning(commitments, takeDate);
  const bringingRisk = gearBringingAlert(commitments);
  const takingRisk = gearTakingAlert(commitments);
  const mine = myCommitments(commitments, deviceId, playerName, uid);

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
            ((uid && c.takerUid === uid) ||
             c.takerDeviceId === deviceId ||
             (c.takerName || '').toLowerCase() === playerName.toLowerCase())
        );
        if (alreadyHas) return;
        if (returnSlotsLeft(cs, type, returnDate) <= 0) return; // that day already full
        const setId = pickFreeSet(cs, type, takeDate);
        if (!setId) return; // lost the race — no set free
        assignedSet = setId;
        const entry = {
          id: crypto.randomUUID(), type, setId,
          takerName: playerName, takerDeviceId: deviceId, takerUid: uid || null,
          takerIsAdmin: !!amAdmin,
          takeDate, returnDate, status: 'committed', returnedOnTime: null,
          createdAt: Date.now(), source: 'player',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      if (assignedSet) {
        const who = { name: playerName, deviceId, uid, isAdmin: amAdmin };
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
        const who = { name: c.takerName, deviceId: c.takerDeviceId, uid: c.takerUid };
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

  const reassign = async (c) => {
    const name = window.prompt(`Reassign ${gearLabel(c.type)} (currently ${c.takerName}) to:`, c.takerName);
    if (!name || !name.trim()) return;
    // Resolve to the person's account so the commitment carries their stable uid
    // (and canonical name) — it then links to their match signup by uid.
    const acct = await ensureAccount(name.trim());
    patchCommitment(c.id, {
      takerName: acct.name, takerUid: acct.uid, takerDeviceId: null, source: adminName || 'admin',
    });
  };

  // mode: 'take'  → they take it home after the upcoming game, bring back on date
  //       'held'  → they ALREADY have it (seeded starting state), brings back on date
  const addManual = async (type, takerName, backDate, mode, takeOn) => {
    if (!takerName.trim()) return;
    const held = mode === 'held';
    const useTake = held ? todayKey() : (takeOn || takeDate); // held = out now; take = chosen day
    setBusy(true);
    try {
      // Resolve the typed name to the person's account up front, so the commitment
      // (and the auto-added roster entry) carry their stable uid. That's what lets
      // "William Escobar" on the gear list link to "William" on the match list —
      // same person, one entry — instead of showing up as two.
      const acct = await ensureAccount(takerName.trim());
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
          createdAt: Date.now(), source: adminName || 'admin',
        };
        if (snap.exists()) tx.update(LEDGER, { commitments: [...cs, entry] });
        else tx.set(LEDGER, { commitments: [entry] });
      });
      if (ok) {
        const who = { name: acct.name, deviceId: `admin-gear-${crypto.randomUUID()}`, uid: acct.uid, isAdmin: !!acct.isAdmin };
        if (held) {
          await setGearRole(backDate, who, 'bringer', type);   // brings it back only
        } else {
          await setGearRole(useTake, who, 'taker', type);
          await setGearRole(backDate, who, 'bringer', type);
        }
      }
      if (dayFull) {
        window.alert(`${gearLabel(type)} already has enough coming that day — pick another bring-back date.`);
      }
    } catch (err) {
      console.error('[FTFC] manual add failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (!playerName) return null;

  // Don't flash "GEAR AT RISK / everything needed" before the ledger loads.
  if (!loaded) {
    return <div className="gear-panel"><p className="gear-note">Loading gear…</p></div>;
  }

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
          const done = coverageForMorning(commitments, m).covered;
          return (
            <div key={m} className={`gear-bring-day${done ? ' complete' : ''}`}>
              <div className="gear-bring-date">
                {fmtDay(m)}
                {done && <span className="gear-done">✓ Ready</span>}
              </div>
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
          const opts = playerReturnDates(commitments, pickerType, takeDate);
          const single = opts.length === 1;
          return (
            <div className="gear-picker">
              <p className={single ? 'gear-warn' : 'gear-note'}>
                {single ? (
                  <>⚠️ You must bring the {gearLabel(pickerType).toLowerCase()} back{' '}
                    <strong>{fmtDay(opts[0])}</strong> — the very next game. Take them home?</>
                ) : (
                  <>When will you bring the {gearLabel(pickerType).toLowerCase()} back?</>
                )}
              </p>
              <div className="gear-date-row">
                {opts.map((rd) => (
                  <button key={rd} className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => claimGear(pickerType, rd)}>
                    {single ? `Yes — I'll bring them ${fmtDay(rd)}` : fmtDay(rd)}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setPickerType(null)}>Cancel</button>
              </div>
            </div>
          );
        })()
      ) : (() => {
        return (
          <div className="gear-take-row">
            {GEAR_TYPE_ORDER.map((t) => {
              const left = availableToTake(commitments, t, takeDate);
              const openDays = playerReturnDates(commitments, t, takeDate).length;
              const owned = mine.some((c) => c.type === t);
              // Balls is lowest priority — locked until goals AND bibs are taken
              // (based on whether they still need a taker, not return-day quirks).
              const ballsBlocked = takeBlockedByPriority(commitments, t, takeDate);
              const disabled = suspended || owned || left <= 0 || openDays === 0 || ballsBlocked;
              return (
                <button key={t} className="gear-take-btn" disabled={disabled}
                  onClick={() => setPickerType(t)}>
                  <span className="gear-take-icon">{gearIcon(t)}</span>
                  <span className="gear-take-label">Take {gearLabel(t)}</span>
                  <span className="gear-take-left">
                    {owned ? 'already yours'
                      : ballsBlocked ? 'goals & bibs first'
                      : left <= 0 ? 'none left'
                      : openDays === 0 ? 'no open days'
                      : `${left} available`}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

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

      {/* Where's each set right now — who holds it and when it's due back */}
      <button className="btn btn-ghost btn-full btn-sm" onClick={() => setShowSets(!showSets)}>
        {showSets ? '▲ Hide who has the gear' : '🧭 Who has the gear'}
      </button>
      {showSets && (
        <div className="gear-sets">
          {GEAR_TYPE_ORDER.map((t) => (
            <div key={t} className="gear-sets-type">
              <div className="gear-sets-head">{gearIcon(t)} {gearLabel(t)}</div>
              {setStatuses(t, commitments).map((s) => (
                <div key={s.setId} className="gear-sets-row">
                  <span className="gear-sets-id">{s.setId}</span>
                  {s.state === 'out' && (
                    <span className="gear-sets-holder">
                      <strong>{s.holder}</strong> · back {fmtDay(s.back)}
                    </span>
                  )}
                  {s.state === 'scheduled' && (
                    <span className="gear-sets-holder">
                      {s.holder} takes {fmtDay(s.take)} · back {fmtDay(s.back)}
                    </span>
                  )}
                  {s.state === 'field' && (
                    <span className="gear-sets-field">at the field</span>
                  )}
                </div>
              ))}
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
  const [bringDate, setBringDate] = useState('');
  const [takeOn, setTakeOn] = useState(upcomingMornings(7)[0]);
  const [backDate, setBackDate] = useState('');
  const live = commitments.filter((c) => c.status === 'committed');

  // Only offer days that still have an open slot for this gear (no over-booking).
  const bringDays = upcomingMornings(7).filter((d) => returnSlotsLeft(commitments, addType, d) > 0);
  const backDays = gameDaysAfter(takeOn, 7).filter((d) => returnSlotsLeft(commitments, addType, d) > 0);
  const bringVal = bringDays.includes(bringDate) ? bringDate : bringDays[0];
  const backVal = backDays.includes(backDate) ? backDate : backDays[0];

  const changeTakeOn = (d) => { setTakeOn(d); setBackDate(''); };

  return (
    <div className="gear-admin">
      <div className="gear-admin-add">
        <select value={addType} onChange={(e) => setAddType(e.target.value)}>
          {GEAR_TYPE_ORDER.map((t) => <option key={t} value={t}>{gearLabel(t)}</option>)}
        </select>
        <input placeholder="Player name" value={addName} onChange={(e) => setAddName(e.target.value)} />
      </div>
      <div className="gear-admin-add">
        <span className="gear-admin-lbl">Bring in on:</span>
        {bringDays.length ? (
          <select value={bringVal} onChange={(e) => setBringDate(e.target.value)}>
            {bringDays.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
          </select>
        ) : <span className="gear-note">all days full</span>}
        <button className="btn btn-success btn-sm" disabled={busy || !addName.trim() || !bringDays.length}
          onClick={() => { onAdd(addType, addName, bringVal, 'held'); setAddName(''); }}>Assign bring</button>
      </div>
      <div className="gear-admin-add">
        <span className="gear-admin-lbl">Take home on:</span>
        <select value={takeOn} onChange={(e) => changeTakeOn(e.target.value)}>
          {upcomingMornings(7).map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
        </select>
        <span className="gear-admin-lbl">back:</span>
        <select value={backVal} onChange={(e) => setBackDate(e.target.value)}>
          {backDays.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" disabled={busy || !addName.trim() || !backDays.length}
          onClick={() => { onAdd(addType, addName, backVal, 'take', takeOn); setAddName(''); }}>Assign take</button>
      </div>
      <p className="gear-note">
        <strong>Assign bring</strong> = just brings a set that day (no take). <strong>Assign take</strong> = takes
        home one day, brings back another. Only days that still need that gear are shown (max 2 goals / 1 balls / 1 bibs per day).
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
