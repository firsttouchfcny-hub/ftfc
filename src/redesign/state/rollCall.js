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

// Short date without the year, e.g. "Aug 15" — for the suspension message.
// (helpers.formatDateShort includes the year; suspensions are within the year.)
export function formatDateNoYear(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
