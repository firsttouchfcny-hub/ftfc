import { useState, useEffect } from 'react';
import { toE164US } from '../utils/helpers';
import {
  GEAR_TYPE_ORDER, gearIcon, gearLabel, gearNeed,
  isGearOpen, gearTakeDate, gameDaysAfter,
  playerReturnDates, returnSlotsLeft,
  availableToTake, takeBlockedByPriority, coverageForMorning,
  bringersFor, takersFor, gearBringingAlert, gearTakingAlert,
  myCommitments, upcomingMornings, setStatuses,
} from '../utils/gear';

function fmtDay(key) {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function GearManager({
  // adminName is no longer a prop: it stamps who performed an admin write,
  // which is now the actions factory's business, not the panel's.
  playerName, deviceId, uid, amAdmin, suspended, namesByUid = {},
  // Every read and write goes through this seam — see utils/gearActions.js.
  // Required on purpose (no default): a component that reaches for Firestore on
  // its own is exactly what the seam exists to prevent, and a default would let
  // that creep back in silently. Production passes the Firestore implementation
  // from App.jsx; the redesign passes a mock.
  //
  // Must be a STABLE object — the ledger subscription is keyed on it, so a
  // factory called inline in render would tear down and re-subscribe every
  // frame. Both call sites wrap it in useMemo.
  actions,
  // The redesign hides the "take gear" block: choosing a set moved onto the
  // gear tiles on the game screen, so repeating it here would be two doors to
  // the same room. Everything else on this panel is unchanged.
  showTake = true,
}) {
  // Show the CURRENT name for a commitment by its uid, falling back to the stored
  // snapshot — so a rename reflects on the gear panel without re-writing history.
  const nameFor = (u, fallback) => (u && namesByUid[u]) || fallback;
  const [commitments, setCommitments] = useState([]);
  const [loaded, setLoaded] = useState(false); // ledger has arrived from the store
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
    const unsub = actions.subscribe(
      (cs) => { clearTimeout(timeout); setCommitments(cs); setLoaded(true); },
      () => { clearTimeout(timeout); setLoaded(true); },
    );
    return () => { unsub(); clearTimeout(timeout); };
  }, [actions]);

  const takeDate = gearTakeDate();
  const open = isGearOpen(amAdmin);
  const coverage = coverageForMorning(commitments, takeDate);
  const bringingRisk = gearBringingAlert(commitments);
  const takingRisk = gearTakingAlert(commitments);
  // takeDate = the upcoming game we're taking gear for. Any commitment due back
  // before it has already been returned (game's at 7 AM, gear opens 11 AM), so it
  // auto-drops from "mine" — no manual "returned" needed.
  const mine = myCommitments(commitments, deviceId, playerName, uid, takeDate);

  // ── Player: claim a set + return date ─────────────────────────────────────
  const claimGear = async (type, returnDate, addToGame = true) => {
    if (!playerName || suspended || !isGearOpen(amAdmin) || busy) return;
    setBusy(true);
    try {
      await actions.claim({
        type, returnDate, addToGame, takeDate,
        player: { name: playerName, deviceId, uid, isAdmin: !!amAdmin },
      });
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
    if (!c) return;
    if (hasGear(c)) {
      window.alert('You already have this gear, so it can\'t be cancelled. Bring it back on game day (it clears itself), or ask an admin to reassign it.');
      return;
    }
    if (!window.confirm('Cancel this gear commitment?')) return;
    setBusy(true);
    try {
      await actions.cancel(c);
    } catch (err) {
      console.error('[FTFC] cancel gear failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // ── Admin actions (#6) ────────────────────────────────────────────────────
  const markReturned = async (id, onTime) => {
    const c = commitments.find((x) => x.id === id);
    if (!c) return;
    setBusy(true);
    try {
      await actions.markReturned(c, onTime);
    } catch (err) {
      console.error('[FTFC] mark returned failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const reassign = async (c) => {
    const input = window.prompt(
      `Reassign ${gearLabel(c.type)} (currently ${c.takerName}) — enter a phone number (preferred) or a name:`, '');
    if (!input || !input.trim()) return;
    setBusy(true);
    try {
      // Phone resolves to the one canonical account; name is the fallback. Either
      // way the commitment carries their stable uid, so it links to their signup.
      const e164 = toE164US(input.trim());
      const acct = await actions.resolvePerson({ e164, name: e164 ? '' : input.trim() });
      await actions.reassign(c, acct);
    } catch (err) {
      console.error('[FTFC] reassign gear failed:', err);
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    try {
      const { dayFull } = await actions.addManual({
        type, e164, name, backDate, mode, takeOn, addToGame, takeDate,
      });
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

      {/* Taking gear for the next game. Hidden in the redesign (showTake),
          where choosing a set happens on the gear tiles of the game screen —
          two doors to the same room would be worse than one. */}
      {showTake && (
        <>
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
        </>
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
  // Only current/upcoming gear — a commitment whose return game has passed has
  // auto-returned, so it's not "active" to manage. Keeps the old schedule out.
  const live = commitments.filter((c) => c.status === 'committed' && c.returnDate >= takeDate);

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
