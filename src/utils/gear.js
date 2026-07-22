// ── Gear management logic ─────────────────────────────────────────────────
// A ledger of physical gear sets moving in and out of the club over time.
// Kept separate from the roll call: gear opens at 11 AM ET and is not tied to
// the 3 PM roll-call open/close.

import {
  getEasternNow, addDaysToKey, getSessionDate,
  isGameDay, nextGameDay, addGameDays,
} from './helpers.js';

export const GEAR_OPEN_HOUR_ET  = 11; // 11 AM ET — gear volunteering opens
export const GEAR_ALERT_HOUR_ET = 18; // 6 PM ET the night before — risk flag

// The physical sets the club owns: 4 goals + 2 balls/cones + 5 rotating bib sets.
// Per-game need is set in GEAR_DEFS (goals 2, balls 1, bibs 1); the spare sets
// (goals 4>2, balls 2>1, bibs 5>1) are the slack that lets sets skip games.
export const GEAR_SETS = [
  { id: 'goal-1',  type: 'goal' },
  { id: 'goal-2',  type: 'goal' },
  { id: 'goal-3',  type: 'goal' },
  { id: 'goal-4',  type: 'goal' },
  { id: 'balls-1', type: 'balls' },
  { id: 'balls-2', type: 'balls' },
  { id: 'bibs-1',  type: 'bibs' },
  { id: 'bibs-2',  type: 'bibs' },
  { id: 'bibs-3',  type: 'bibs' },
  { id: 'bibs-4',  type: 'bibs' },
  { id: 'bibs-5',  type: 'bibs' },
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

// Today's date key in Eastern time (used to mark already-held gear as out now).
export function todayKey() { return getEasternNow().dateKey; }

// The next 7 AM game (Mon–Fri) — the game players take gear home from.
export function gearTakeDate() {
  const base = getSessionDate();
  return isGameDay(base) ? base : nextGameDay(base);
}

// Return-date options for a take on `takeDate` of a given type. The window is
// counted in GAME DAYS (skips weekends) — goals/balls give the next 2 game days,
// bibs the next 5.
export function returnDateOptions(takeDate, type) {
  const days = GEAR_DEFS[type]?.returnWindow || 2;
  const opts = [];
  for (let i = 1; i <= days; i++) opts.push(addGameDays(takeDate, i));
  return opts;
}

// How many more people may still choose `morning` as a bring-back date for this
// type — capped at the daily need (goals 2/day, balls & bibs 1/day). A day is
// "full" at 0 slots left.
export function returnSlotsLeft(commitments, type, morning) {
  const brought = (commitments || []).filter(
    (c) => isLive(c) && c.type === type && c.returnDate === morning
  ).length;
  return gearNeed(type) - brought;
}

// The bring-back dates still open for a take on `takeDate`: window days that
// aren't already full. None selected → full window; days fill up → fewer options.
export function availableReturnDates(commitments, type, takeDate) {
  return returnDateOptions(takeDate, type)
    .filter((r) => returnSlotsLeft(commitments, type, r) > 0);
}

// Bring-back dates for gear ALREADY held (admin "has it" onboarding): unlike a
// fresh take, it can come back as early as the very next game (`fromGame`),
// then across the window — capped at need/day.
export function availableBringDates(commitments, type, fromGame) {
  const days = GEAR_DEFS[type]?.returnWindow || 2;
  const out = [];
  let d = fromGame;
  for (let i = 0; i < days && d; i++) {
    if (returnSlotsLeft(commitments, type, d) > 0) out.push(d);
    d = nextGameDay(d);
  }
  return out;
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
// Only `need` sets are physically AT each game (goals 2, balls 1, bibs 1) — the
// spare sets are elsewhere in rotation — so at most `need` can be taken home,
// regardless of how many sets exist in total.
export function availableToTake(commitments, type, takeDate) {
  const atGame = gearNeed(type);
  const alreadyTaking = takersFor(commitments, takeDate).filter((c) => c.type === type).length;
  return Math.max(0, atGame - alreadyTaking);
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
  return (commitments || []).filter((c) => isLive(c) && !c.held && c.takeDate === morning);
}

// BRINGING alert — the next game is short of people bringing gear IN. Shows as
// soon as the app targets that game (the 10 AM list reset) and persists until
// it's filled. Because bringers are auto-added on commit, this is known early.
export function gearBringingAlert(commitments) {
  const takeDate = gearTakeDate();
  const cov = coverageForMorning(commitments, takeDate);
  return cov.covered ? null : { date: takeDate, missing: cov.missing };
}

// TAKING alert (from 6 PM ET) — after the upcoming game, gear must be taken HOME
// to reach the following game. Flags types too few people are carrying home, so
// the day after won't be stranded. An alert, not a lockout.
export function gearTakingAlert(commitments) {
  if (getEasternNow().hour < GEAR_ALERT_HOUR_ET) return null;
  const takeDate = gearTakeDate();
  const carried = takersFor(commitments, takeDate);
  const missing = [];
  for (const type of GEAR_TYPE_ORDER) {
    const have = carried.filter((c) => c.type === type).length;
    const need = gearNeed(type);
    if (have < need) missing.push({ type, have, need });
  }
  return missing.length ? { date: takeDate, missing } : null;
}

export function isFridayKey(dateKey) {
  return new Date(dateKey + 'T12:00:00Z').getUTCDay() === 5;
}

// Reward: on a Friday, anyone who took a set HOME earlier that week (Mon–Thu)
// gets priority. Returns a Set of lowercased names (empty unless dateKey is a
// Friday). "Same Friday only" — it does not carry to the next week.
export function fridayGearPriorityNames(commitments, dateKey) {
  const names = new Set();
  if (!isFridayKey(dateKey)) return names;
  const monday = addDaysToKey(dateKey, -4);
  const thursday = addDaysToKey(dateKey, -1);
  for (const c of commitments || []) {
    if (c.status !== 'committed') continue;
    if (c.takeDate >= monday && c.takeDate <= thursday) {
      names.add((c.takerName || '').toLowerCase().trim());
    }
  }
  return names;
}

// A person's own live commitments (matched by device id or name).
export function myCommitments(commitments, deviceId, name) {
  const n = (name || '').toLowerCase();
  return (commitments || []).filter(
    (c) => isLive(c) &&
      (c.takerDeviceId === deviceId || (c.takerName || '').toLowerCase() === n)
  );
}

// The next `count` game mornings (Mon–Fri) starting from the upcoming game —
// for the day-by-day gear schedule view.
export function upcomingMornings(count = 6) {
  const out = [gearTakeDate()];
  for (let i = 1; i < count; i++) out.push(addGameDays(out[i - 1], 1));
  return out;
}
