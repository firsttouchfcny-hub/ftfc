import { useState, useEffect } from 'react';
import {
  doc, onSnapshot, runTransaction, collection, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ensureAccount, ensureAccountByPhone } from '../utils/identity';
import { isSamePerson, rosterDocId, toE164US } from '../utils/helpers';
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

  if (type == null) { // clear the role marker
    if (!mineDoc) return;
    const d = mineDoc.data();
    const other = field === 'gearBringer' ? 'gearTaker' : 'gearBringer';
    // Once this role is cleared and no other gear role remains, the row exists for
    // NO reason unless the person actually signed up. So: keep it only for a
    // confirmed sign-up (signedUp), otherwise remove it. This means a cancelled/
    // reassigned/returned gear commitment can never leave a stranded roster row —
    // for new rows AND old ones (which have no signedUp flag).
    if (!d[other] && d.signedUp !== true) await deleteDoc(mineDoc.ref);
    else await updateDoc(mineDoc.ref, { [field]: null });
    return;
  }
  if (mineDoc) {
    await updateDoc(mineDoc.ref, { [field]: type });
  } else {
    // Not on this day's roster yet → auto-add them, keyed by their stable uid
    // (deviceId only until an account is resolved), matching sign-in so gear and
    // a later self-signup land on the SAME row. Committing to gear signs you up.
    // gearAdded marks the row as gear-created, so clearing the role can remove it.
    await setDoc(doc(col, rosterDocId({ uid, deviceId })), {
      name, deviceId, uid: uid || null, isAdmin: !!isAdmin,
      plusOnes: 0, [field]: type, gearAdded: true, signedUpAt: Date.now(),
    });
  }
}

export default function GearManager({ playerName, deviceId, uid, amAdmin, suspended, adminName, namesByUid = {} }) {
  // Show the CURRENT name for a commitment by its uid, falling back to the stored
  // snapshot — so a rename reflects on the gear panel without re-writing history.
  const nameFor = (u, fallback) => (u && namesByUid[u]) || fallback;
  const [commitments, setCommitments] = useState([]);
  const [loaded, setLoaded] = useState(false); // ledger has arrived from Firebase
  const [pickerType, setPickerType] = useState(null); // type mid-return-date-pick
  const [pickedDate, setPickedDate] = useState(null); // chosen return date, awaiting play/not choice
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSets, setShowSets] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    // Don't spin on "Loading gear…" forever if the connection is slow/flaky
    // (e.g. an in-app browser). Render the panel after 6s regardless; the
    // snapshot updates it whenever it arrives.
    const timeout = setTimeout(() => setLoaded(true), 6000);
    const unsub = onSnapshot(LEDGER, (snap) => {
      clearTimeout(timeout);
      setCommitments(snap.exists() ? (snap.data().commitments || []) : []);
      setLoaded(true);
    }, () => { clearTimeout(timeout); setLoaded(true); });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const takeDate = gearTakeDate();
  const open = isGearOpen(amAdmin);
  const coverage = coverageForMorning(commitments, takeDate);
  const bringingRisk = gearBringingAlert(commitments);
  const takingRisk = gearTakingAlert(commitments);
  // takeDate = the upcoming game we're taking gear for. Any commitment due back
  // before it has already been returned (game's at 7 AM, gear opens 11 AM), so it
  // auto-drops from "mine" — no manual "returned" needed.
  const mine = myCommitments(commitments, deviceId, playerName, uid, takeDate);

  // ── Player: claim a set + return date (atomic) ────────────────────────────
  const claimGear = async (type, returnDate, addToGame = true) => {
    if (!playerName || suspended || !isGearOpen(amAdmin) || busy) return;
    setBusy(true);
    try {
      let assignedSet = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        const cs = snap.exists() ? (snap.data().commitments || []) : [];
        // One person may hold only one set of a type AT A TIME. Block only if they
        // still have it AFTER this take (returnDate > takeDate). A set they're
        // bringing back ON the take day is a continuation — they hand it in that
        // morning and take it again after the game — so that's allowed.
        const alreadyHas = cs.some(
          (c) => c.status === 'committed' && c.type === type && c.returnDate > takeDate &&
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
      // Only add them to the match roster if they're PLAYING. Someone just
      // picking up the gear (not playing) gets the commitment (tracked in the
      // gear panel) but stays off the game list.
      if (assignedSet && addToGame) {
        const who = { name: playerName, deviceId, uid, isAdmin: amAdmin };
        await setGearRole(takeDate, who, 'taker', type);     // playing the take day
        await setGearRole(returnDate, who, 'bringer', type); // playing the return day
      }
    } catch (err) {
      console.error('[FTFC] claim gear failed:', err);
    } finally {
      setBusy(false);
      setPickerType(null);
      setPickedDate(null);
    }
  };

  // You've "got the gear" once you've taken it home (a held set, or the take-day
  // game has passed). After that you can't cancel — it clears when you bring it
  // back on game day, or an admin reassigns it.
  const hasGear = (c) => c.held || c.takeDate < takeDate;

  const cancelCommitment = async (id) => {
    if (busy) return;
    const c = commitments.find((x) => x.id === id);
    if (c && hasGear(c)) {
      window.alert('You already have this gear, so it can\'t be cancelled. Bring it back on game day (it clears itself), or ask an admin to reassign it.');
      return;
    }
    if (!window.confirm('Cancel this gear commitment?')) return;
    setBusy(true);
    try {
      const c = commitments.find((x) => x.id === id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER);
        if (!snap.exists()) return;
        const cs = snap.data().commitments || [];
        // Mark cancelled rather than delete, so gear custody history is never
        // lost. Cancelled commitments aren't live, so coverage/the tracker ignore
        // them — but we keep a record of who touched each set.
        tx.update(LEDGER, {
          commitments: cs.map((x) => (x.id === id ? { ...x, status: 'cancelled', cancelledAt: Date.now() } : x)),
        });
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

  const markReturned = async (id, onTime) => {
    await patchCommitment(id, {
      status: 'returned', returnedOnTime: onTime, returnedAt: Date.now(),
      returnedBy: adminName || 'admin',
    });
    // Update the list too: clear the person's gear markers (removes a gear-only
    // roster row) so the roster reflects the admin's gear update.
    const c = commitments.find((x) => x.id === id);
    if (c) {
      const who = { name: c.takerName, deviceId: c.takerDeviceId, uid: c.takerUid };
      await setGearRole(c.takeDate, who, 'taker', null);
      await setGearRole(c.returnDate, who, 'bringer', null);
    }
  };

  const reassign = async (c) => {
    const input = window.prompt(
      `Reassign ${gearLabel(c.type)} (currently ${c.takerName}) — enter a phone number (preferred) or a name:`, '');
    if (!input || !input.trim()) return;
    // Phone resolves to the one canonical account; name is the fallback. Either
    // way the commitment carries their stable uid, so it links to their signup.
    const e164 = toE164US(input.trim());
    const acct = e164 ? await ensureAccountByPhone(e164) : await ensureAccount(input.trim());
    // Move the roster role off the OLD person (so they aren't left stranded on the
    // list) and onto the new one, then re-point the commitment.
    const oldWho = { name: c.takerName, deviceId: c.takerDeviceId, uid: c.takerUid };
    if (!c.held) await setGearRole(c.takeDate, oldWho, 'taker', null);
    await setGearRole(c.returnDate, oldWho, 'bringer', null);
    await patchCommitment(c.id, {
      takerName: acct.name, takerUid: acct.uid, takerDeviceId: null, source: adminName || 'admin',
    });
    const newWho = { name: acct.name, deviceId: `admin-gear-${crypto.randomUUID()}`, uid: acct.uid, isAdmin: !!acct.isAdmin };
    if (!c.held) await setGearRole(c.takeDate, newWho, 'taker', c.type);
    await setGearRole(c.returnDate, newWho, 'bringer', c.type);
  };

  // mode: 'take'  → they take it home after the upcoming game, bring back on date
  //       'held'  → they ALREADY have it (seeded starting state), brings back on date
  const addManual = async (type, ident, backDate, mode, takeOn, addToGame = true) => {
    // Identify the person by PHONE first (resolves to their one canonical account,
    // no matter how their name is typed); fall back to a name only for a number
    // that's brand-new to us. This is what stops "Miguel C" vs "Miguel Cevallos"
    // from ever forking into two identities again.
    const phone = (ident.phone || '').trim();
    const name  = (ident.name  || '').trim();
    const e164  = phone ? toE164US(phone) : null;
    if (phone && !e164) { window.alert('Enter a valid 10-digit US number, or leave phone blank and use a name.'); return; }
    if (!e164 && !name) return; // nothing to identify the person by
    const held = mode === 'held';
    const useTake = held ? todayKey() : (takeOn || takeDate); // held = out now; take = chosen day
    setBusy(true);
    try {
      // Phone → the person's account (created & vouched if the number is new);
      // else resolve the typed name. Either way the commitment + auto-added roster
      // entry carry their stable uid, so gear and a match signup converge on one
      // row instead of forking.
      const acct = e164 ? await ensureAccountByPhone(e164, name) : await ensureAccount(name);
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
      // Only put them on the match roster if they're playing. Gear-only (not
      // playing) still gets the commitment — tracked in the gear panel — but no
      // roster row.
      if (ok && addToGame) {
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
                  const names = bring.filter((c) => c.type === t).map((c) => nameFor(c.takerUid, c.takerName));
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
          const label = gearLabel(pickerType).toLowerCase();
          const cancel = () => { setPickerType(null); setPickedDate(null); };
          // Step 1 — pick the return date (auto-picked when there's only one).
          const chosen = pickedDate || (single ? opts[0] : null);
          if (!chosen) {
            return (
              <div className="gear-picker">
                <p className="gear-note">When will you bring the {label} back?</p>
                <div className="gear-date-row">
                  {opts.map((rd) => (
                    <button key={rd} className="btn btn-primary btn-sm" disabled={busy}
                      onClick={() => setPickedDate(rd)}>{fmtDay(rd)}</button>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
                </div>
              </div>
            );
          }
          // Step 2 — are they playing, or just picking the gear up?
          return (
            <div className="gear-picker">
              <p className="gear-note">
                Taking {label} home, back <strong>{fmtDay(chosen)}</strong>. Are you playing?
              </p>
              <div className="gear-date-row">
                <button className="btn btn-primary btn-sm" disabled={busy}
                  onClick={() => claimGear(pickerType, chosen, true)}>Take &amp; join the game</button>
                <button className="btn btn-success btn-sm" disabled={busy}
                  onClick={() => claimGear(pickerType, chosen, false)}>Just take the gear</button>
                <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel</button>
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
              // "Yours" only blocks a re-take if you'd still hold it after this take
              // (return date is past the take day). A set you bring back that day is
              // a continuation → you can take it again.
              const owned = mine.some((c) => c.type === t && c.returnDate > takeDate);
              // Balls is lowest priority — locked until goals AND bibs are taken
              // (based on whether they still need a taker, not return-day quirks).
              // Admins are exempt: they can take balls & cones anytime.
              const ballsBlocked = !amAdmin && takeBlockedByPriority(commitments, t, takeDate);
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
              {/* Cancel only before you've taken it home; once you have it, only
                  bringing it back on game day (auto) or an admin clears it. */}
              {!hasGear(c)
                ? <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => cancelCommitment(c.id)}>Cancel</button>
                : <span className="gear-note">bring back on game day</span>}
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
                      <strong>{nameFor(s.holderUid, s.holder)}</strong> · back {fmtDay(s.back)}
                    </span>
                  )}
                  {s.state === 'scheduled' && (
                    <span className="gear-sets-holder">
                      {nameFor(s.holderUid, s.holder)} takes {fmtDay(s.take)} · back {fmtDay(s.back)}
                    </span>
                  )}
                  {s.state === 'field' && (
                    <span className="gear-sets-field">
                      at the field{s.holder ? <> · last had by <strong>{nameFor(s.holderUid, s.holder)}</strong></> : ''}
                    </span>
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
                    {bring.length ? bring.map((c) => `${gearIcon(c.type)} ${nameFor(c.takerUid, c.takerName)}`).join(', ') : '—'}
                  </div>
                  <div><span className="gear-role">Taking home:</span>{' '}
                    {take.length ? take.map((c) => `${gearIcon(c.type)} ${nameFor(c.takerUid, c.takerName)}`).join(', ') : '—'}
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
              onRemove={cancelCommitment} onAdd={addManual} nameFor={nameFor}
            />
          )}
        </>
      )}
    </div>
  );
}

function GearAdmin({ commitments, busy, takeDate, onMarkReturned, onReassign, onRemove, onAdd, nameFor }) {
  const [addType, setAddType] = useState('goal');
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');
  const [addToGame, setAddToGame] = useState(true); // also put them on the match list?
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
        <input placeholder="Player phone (10-digit)" type="tel" inputMode="numeric"
          value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
        <input placeholder="Name (only if new number)" value={addName} onChange={(e) => setAddName(e.target.value)} />
      </div>
      <div className="gear-admin-add">
        <span className="gear-admin-lbl">Bring in on:</span>
        {bringDays.length ? (
          <select value={bringVal} onChange={(e) => setBringDate(e.target.value)}>
            {bringDays.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
          </select>
        ) : <span className="gear-note">all days full</span>}
        <button className="btn btn-success btn-sm" disabled={busy || (!addPhone.trim() && !addName.trim()) || !bringDays.length}
          onClick={() => { onAdd(addType, { phone: addPhone, name: addName }, bringVal, 'held', undefined, addToGame); setAddPhone(''); setAddName(''); }}>Assign bring</button>
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
        <button className="btn btn-primary btn-sm" disabled={busy || (!addPhone.trim() && !addName.trim()) || !backDays.length}
          onClick={() => { onAdd(addType, { phone: addPhone, name: addName }, backVal, 'take', takeOn, addToGame); setAddPhone(''); setAddName(''); }}>Assign take</button>
      </div>
      <label className="gear-admin-add gear-admin-check">
        <input type="checkbox" checked={addToGame} onChange={(e) => setAddToGame(e.target.checked)} />
        Also add them to the game list (uncheck if they're only picking up gear, not playing)
      </label>
      <p className="gear-note">
        <strong>Assign bring</strong> = just brings a set that day (no take). <strong>Assign take</strong> = takes
        home one day, brings back another. Only days that still need that gear are shown (max 2 goals / 1 balls / 1 bibs per day).
      </p>

      {live.length === 0 ? (
        <p className="gear-note">No active gear commitments.</p>
      ) : live.map((c) => (
        <div key={c.id} className="gear-admin-row">
          <span className="gear-admin-info">
            {gearIcon(c.type)} <strong>{nameFor(c.takerUid, c.takerName)}</strong> · take {fmtDay(c.takeDate)} → back {fmtDay(c.returnDate)}
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
