// ── Gear management logic ─────────────────────────────────────────────────
// A ledger of physical gear sets moving in and out of the club over time.
// Kept separate from the roll call: gear opens at 11 AM ET and is not tied to
// the 3 PM roll-call open/close.

import { getEasternNow, addDaysToKey, getSessionDate } from './helpers.js';

export const GEAR_OPEN_HOUR_ET  = 11; // 11 AM ET — gear volunteering opens
export const GEAR_ALERT_HOUR_ET = 18; // 6 PM ET the night before — risk flag

// The physical sets the club owns. 2 goals + 1 balls/cones + 1 bibs.
export const GEAR_SETS = [
  { id: 'goal-a', type: 'goal' },
  { id: 'goal-b', type: 'goal' },
  { id: 'balls',  type: 'balls' },
  { id: 'bibs',   type: 'bibs' },
];

// Per-type definitions. returnWindow = how many days out a return date may be.
//   goals / balls → tomorrow or the day after (2-day window)
//   bibs          → any day within the next 5 days
export const GEAR_DEFS = {
  goal:  { icon: '🥅', label: 'Goals',         need: 2, returnWindow: 2 },
  balls: { icon: '⚽', label: 'Balls & cones', need: 1, returnWindow: 2 },
  bibs:  { icon: '🧺', label: 'Bibs',          need: 1, returnWindow: 5 },
};
export const GEAR_TYPE_ORDER = ['goal', 'balls', 'bibs'];

export function gearIcon(type)  { return GEAR_DEFS[type]?.icon  || ''; }
export function gearLabel(type) { return GEAR_DEFS[type]?.label || type; }
export function gearNeed(type)  { return GEAR_DEFS[type]?.need  || 1; }
export function setsForType(type) { return GEAR_SETS.filter((s) => s.type === type); }

// Gear volunteering opens at 11 AM ET (same open-hour gate style as the roll
// call; there is no separate close — a new game's window begins each day).
export function isGearOpen() { return getEasternNow().hour >= GEAR_OPEN_HOUR_ET; }

// The next 7 AM game — the game players take gear home from.
export function gearTakeDate() { return getSessionDate(); }

// Return-date options for a take on `takeDate` of a given type.
export function returnDateOptions(takeDate, type) {
  const days = GEAR_DEFS[type]?.returnWindow || 2;
  const opts = [];
  for (let i = 1; i <= days; i++) opts.push(addDaysToKey(takeDate, i));
  return opts;
}

const isLive = (c) => c && c.status === 'committed';

// A set is "out" (with someone, not at the field) on the morning of D when a
// live commitment took it on/before D and returns it strictly after D.
function setBusyForTakeOn(commitments, setId, D) {
  return (commitments || []).some(
    (c) => isLive(c) && c.setId === setId && c.takeDate <= D && c.returnDate > D
  );
}

// How many sets of a type can still be taken home after the game on `takeDate`.
export function availableToTake(commitments, type, takeDate) {
  return setsForType(type).filter((s) => !setBusyForTakeOn(commitments, s.id, takeDate)).length;
}

// Pick a concrete free physical set of the type for a take on `takeDate`.
export function pickFreeSet(commitments, type, takeDate) {
  const s = setsForType(type).find((set) => !setBusyForTakeOn(commitments, set.id, takeDate));
  return s ? s.id : null;
}

// Coverage for a game morning M: are 2 goals / 1 balls / 1 bibs being brought in?
export function coverageForMorning(commitments, morning) {
  const status = {};
  const missing = [];
  let covered = true;
  for (const type of GEAR_TYPE_ORDER) {
    const have = (commitments || []).filter(
      (c) => isLive(c) && c.type === type && c.returnDate === morning
    ).length;
    const need = gearNeed(type);
    status[type] = { have, need, ok: have >= need };
    if (have < need) { covered = false; missing.push({ type, have, need }); }
  }
  return { covered, missing, status };
}

// Who is BRINGING gear in on morning M vs TAKING gear home after game morning M.
export function bringersFor(commitments, morning) {
  return (commitments || []).filter((c) => isLive(c) && c.returnDate === morning);
}
export function takersFor(commitments, morning) {
  return (commitments || []).filter((c) => isLive(c) && c.takeDate === morning);
}

// Prominent risk flag: from 6 PM the night before through the game morning, if
// the upcoming game's gear requirements aren't covered. An alert, not a lockout.
export function gearRiskAlert(commitments) {
  const takeDate = gearTakeDate();
  const et = getEasternNow();
  const nightBefore = addDaysToKey(takeDate, -1);
  const inWindow =
    (et.dateKey === nightBefore && et.hour >= GEAR_ALERT_HOUR_ET) ||
    et.dateKey === takeDate;
  if (!inWindow) return null;
  const cov = coverageForMorning(commitments, takeDate);
  return cov.covered ? null : cov.missing;
}

// A person's own live commitments (matched by device id or name).
export function myCommitments(commitments, deviceId, name) {
  const n = (name || '').toLowerCase();
  return (commitments || []).filter(
    (c) => isLive(c) &&
      (c.takerDeviceId === deviceId || (c.takerName || '').toLowerCase() === n)
  );
}

// The next `count` game mornings starting from the upcoming game — for the
// day-by-day gear schedule view.
export function upcomingMornings(count = 6) {
  const start = gearTakeDate();
  const out = [];
  for (let i = 0; i < count; i++) out.push(addDaysToKey(start, i));
  return out;
}
