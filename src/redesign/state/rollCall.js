// Redesign roll-call helpers — thin wrappers over the existing Eastern-time
// logic in src/utils/helpers.js. We reuse the domain logic; only the countdown
// formatting is new.

import { OPEN_HOUR_ET } from '../../utils/helpers';

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

// "HH:MM:SS" until roll call opens (3 PM ET). "00:00:00" once it's open.
export function countdownToOpen() {
  const remaining = Math.max(0, OPEN_HOUR_ET * 3600 - etSecondsOfDay());
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(remaining / 3600))}:${pad(Math.floor((remaining % 3600) / 60))}:${pad(remaining % 60)}`;
}

// Short date without the year, e.g. "Aug 15" — for the suspension message.
// (helpers.formatDateShort includes the year; suspensions are within the year.)
export function formatDateNoYear(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
