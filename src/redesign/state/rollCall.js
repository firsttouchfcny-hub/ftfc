// Redesign roll-call helpers — thin wrappers over the existing Eastern-time
// logic in src/utils/helpers.js. We reuse the domain logic; only the countdown
// formatting is new.

import { OPEN_HOUR_ET, getEasternNow, getSessionDate, addDaysToKey } from '../../utils/helpers';

// Seconds since midnight in Eastern time, including seconds (getEasternNow only
// exposes hour/minute, so we read the second here for a per-second countdown).
function etSecondsOfDay() {
  const p = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date())) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  let h = parseInt(p.hour, 10);
  if (h === 24) h = 0; // some engines emit '24' at midnight
  return h * 3600 + parseInt(p.minute, 10) * 60 + parseInt(p.second, 10);
}

// Whole days between two YYYY-MM-DD keys (parsed as UTC so DST can't shift it).
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// "HH:MM:SS" until roll call opens. Roll call opens at 3 PM ET *the day before
// the game* — not 3 PM today — so on a Saturday with a Monday game this counts
// through to Sunday afternoon rather than expiring the same day.
// "00:00:00" once it's open.
export function countdownToOpen() {
  const openDay = addDaysToKey(getSessionDate(), -1);
  const days = Math.max(0, daysBetween(getEasternNow().dateKey, openDay));
  const remaining = Math.max(0, days * 86_400 + OPEN_HOUR_ET * 3600 - etSecondsOfDay());
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(remaining / 3600))}:${pad(Math.floor((remaining % 3600) / 60))}:${pad(remaining % 60)}`;
}

// 9 PM ET the night before a game — drop after this and you earn a strike (the
// rule stated on the Rules screen). Deliberately its own constant rather than
// reusing GAME2_CUTOFF_HOUR_ET: that is the Match 2 go/no-go decision, which
// merely happens to fall at the same hour. Production doesn't implement this
// check at all today — strikes are issued by hand from the Admin panel — so
// this drives the warning copy, not an automatic penalty.
export const DROP_DEADLINE_HOUR_ET = 21;

// Is a drop right now a late drop? True from 9 PM the night before, and all
// through the morning of the game itself.
export function isPastDropDeadline() {
  const et = getEasternNow();
  const game = getSessionDate();
  if (et.dateKey === game) return true;                        // morning of the game
  if (et.dateKey === addDaysToKey(game, -1)) {                 // the night before
    return et.hour >= DROP_DEADLINE_HOUR_ET;
  }
  return false;                                                // more than a day out
}

// A date key parsed at midday, so a timezone offset can never slide it a day.
const atNoon = (dateKey) => new Date(`${dateKey}T12:00:00`);

// "Monday" — the day a game falls on. Used instead of the word "tomorrow",
// which is wrong whenever the next game is more than a day away (Fri/Sat/Sun).
export function formatWeekday(dateKey) {
  return dateKey ? atNoon(dateKey).toLocaleDateString('en-US', { weekday: 'long' }) : '';
}

// "Monday, Oct 13" — a game day named in full, for commitments worth remembering.
export function formatGameDate(dateKey) {
  return dateKey
    ? atNoon(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '';
}

// "October 15th, 2026" — full month + ordinal + year, no weekday. The game
// header shows the weekday on its own line, so it wants the date without it.
export function formatMonthDayYear(dateKey) {
  if (!dateKey) return '';
  const d = atNoon(dateKey);
  const day = d.getDate();
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ord = `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
  const { month, year } = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
      .formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return `${month} ${ord}, ${year}`;
}

// "Thursday, Oct 15th, 2026" — the game header's full form, ordinal and all.
export function formatFullGameDate(dateKey) {
  if (!dateKey) return '';
  const d = atNoon(dateKey);
  const day = d.getDate();
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  const ord = `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
  const { weekday, month, year } = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', year: 'numeric' })
      .formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return `${weekday}, ${month} ${ord}, ${year}`;
}

// Short date without the year, e.g. "Aug 15" — for the suspension message.
// (helpers.formatDateShort includes the year; suspensions are within the year.)
export function formatDateNoYear(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
