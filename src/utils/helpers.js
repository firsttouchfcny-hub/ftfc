export function getToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Eastern-time hours that drive the daily cycle (America/New_York).
export const RESET_HOUR_ET = 10;  // 10 AM ET — list resets to the next game
export const OPEN_HOUR_ET  = 15;  // 3 PM ET — roll call opens to everyone

// Roster sizing: two matches of 18 = 36 play; rest are bench.
export const MATCH1_MAX = 18;
export const MATCH2_MAX = 36;
export const MATCH2_MIN_CONFIRM = 30; // total signups needed before Match 2 is confirmed
export const GAME2_CUTOFF_HOUR_ET = 21; // 9 PM ET — if Match 2 is still short, it's off

// Current wall-clock in America/New_York, regardless of the device's timezone.
// Returns { hour, minute, dateKey }. Handles DST automatically via Intl.
export function getEasternNow() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(new Date())) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  let hour = parseInt(p.hour, 10);
  if (hour === 24) hour = 0; // some engines emit '24' at midnight
  return {
    hour,
    minute: parseInt(p.minute, 10),
    dateKey: `${p.year}-${p.month}-${p.day}`,
  };
}

// Add days to a YYYY-MM-DD key without timezone drift (anchored at UTC noon).
export function addDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// Games run Monday–Friday only. Weekday is timezone-independent when the key is
// anchored at noon UTC (avoids DST edges). 0=Sun … 6=Sat → game day is 1–5.
export function isGameDay(dateKey) {
  const day = new Date(dateKey + 'T12:00:00Z').getUTCDay();
  return day >= 1 && day <= 5;
}

// The next game day strictly after `dateKey` (skips Sat/Sun).
export function nextGameDay(dateKey) {
  let d = addDaysToKey(dateKey, 1);
  while (!isGameDay(d)) d = addDaysToKey(d, 1);
  return d;
}

// Advance `n` game days forward from `dateKey` (n>=1 lands on a weekday).
export function addGameDays(dateKey, n) {
  let d = dateKey;
  for (let i = 0; i < n; i++) d = nextGameDay(d);
  return d;
}

// The game date the app is focused on, in Eastern time. Games run Mon–Fri, so
// on weekends (and Friday after the 10 AM reset) this skips ahead to Monday.
//   Before 10 AM ET  → today's game (or the next game day if today is a weekend)
//   10 AM ET or later → the next game day
export function getSessionDate() {
  const et = getEasternNow();
  const base = et.hour < RESET_HOUR_ET ? et.dateKey : addDaysToKey(et.dateKey, 1);
  return isGameDay(base) ? base : nextGameDay(base);
}

// Roll-call phase for the active signup day, in Eastern time. A game's roll call
// opens the DAY BEFORE the game — including Sunday for a Monday game (so it no
// longer springs open on Friday over the weekend):
//   'closed'      → more than a day out, or before 10 AM the day before
//   'admins-only' → 10 AM–3 PM the day before (admins may sign up early)
//   'open'        → 3 PM the day before, through the game morning
export function getRollCallPhase() {
  const et = getEasternNow();
  const target = getSessionDate();              // the game we're currently showing
  const dayBefore = addDaysToKey(target, -1);   // roll call opens on this day at 3 PM ET

  // Morning of the game itself: stays open until the 10 AM reset moves to the next game.
  if (et.dateKey === target) {
    return et.hour < RESET_HOUR_ET ? 'open' : 'closed';
  }
  // The day before the game (e.g. Sunday for a Monday game).
  if (et.dateKey === dayBefore) {
    if (et.hour < RESET_HOUR_ET) return 'closed';
    if (et.hour < OPEN_HOUR_ET) return 'admins-only';
    return 'open';
  }
  // Two or more days before the next game (e.g. Fri/Sat for a Monday game).
  return 'closed';
}

// Effective open state. An admin override ('open' | 'closed') only applies
// within the phase it was set in (session.overridePhase), so it can never block
// a later scheduled transition — e.g. a morning "Close" can't stop the 3 PM
// auto-open. Otherwise the schedule (opens at 3 PM ET) rules.
export function isRollCallOpen(session) {
  const phase = getRollCallPhase();
  const ov = session?.override;
  if (ov && session?.overridePhase === phase) return ov === 'open';
  return phase === 'open';
}

// Admins may sign up during the admins-only window as well as when fully open.
export function canAdminSignUp(session) {
  if (isRollCallOpen(session)) return true;
  return getRollCallPhase() === 'admins-only';
}

// Match 2 status given the total signups:
//   'confirmed' → enough players, Match 2 is on
//   'on-hold'   → short, but before the 9 PM ET cutoff (still might fill)
//   'off'       → short and past 9 PM ET → Match 2 is cancelled
export function getMatch2State(totalPlayers) {
  if (totalPlayers >= MATCH2_MIN_CONFIRM) return 'confirmed';
  return getEasternNow().hour >= GAME2_CUTOFF_HOUR_ET ? 'off' : 'on-hold';
}

// Always returns tomorrow's date — used by admin roll call so it
// always targets the next game regardless of time of day.
export function getTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDeviceId() {
  let id = localStorage.getItem('ftfc_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ftfc_device_id', id);
  }
  return id;
}

export function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

// Accepts a 10-digit US number, or 11 digits with a leading 1. Returns E.164
// (+1XXXXXXXXXX) or null. The one place phone strings get normalized, so every
// entry point (self-verify, admin gear-add) keys on the same canonical form.
export function toE164US(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// A person's stable identity anchor. Generated ONCE and stored on their profile,
// it never changes — not when they edit their name and not when they update
// their phone number. Roster + gear records reference this so nothing drifts.
export function newUid() {
  return 'u_' + crypto.randomUUID();
}

// The one place that decides whether a roster/gear entry `p` is the same person
// as { uid, deviceId, name }. uid is the strong signal (a person's stable
// account id); deviceId and name are fallbacks for rows created before the
// person had a resolved account. Used for "is this me?", sign-out, gear tagging,
// and duplicate detection — so every path agrees on identity.
export function isSamePerson(p, { uid, deviceId, name } = {}) {
  if (!p) return false;
  if (uid && p.uid === uid) return true;
  if (deviceId && p.deviceId === deviceId) return true;
  if (name && (p.name || '').toLowerCase() === name.toLowerCase()) return true;
  return false;
}

// The roster document id for a person in a session. Prefer the id of a row they
// ALREADY own (so a re-tap — even from another device, or onto an admin's
// pre-add — updates that one row); otherwise key by their stable uid, falling
// back to deviceId only when no account is resolved yet. This makes
// "one person = one row per session" true by construction, not by cleanup.
export function rosterDocId({ existingId, uid, deviceId }) {
  return existingId || uid || deviceId || null;
}

// Split a stored single `name` into first/last for the redesign's profile.
// Rule (decided 2026-08-14): the FIRST word is the first name, everything after
// it is the last name — so "Eric J" → Eric / J and "Felipe Di Carli" → Felipe /
// Di Carli, which reads correctly for compound surnames.
//
// One-word names are not allowed, but plenty exist on the current roster (Elle,
// Shimon). Those come back with an empty `lastName` and `needsLastName: true`,
// so the app can ask for one once rather than silently inventing it or letting
// a required field block the person.
export function splitName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName, needsLastName: !!firstName && !lastName };
}

// The inverse, for writing back to the single `name` field production stores.
export function joinName(firstName, lastName) {
  return [firstName, lastName].map((p) => (p || '').trim()).filter(Boolean).join(' ');
}

export function parseNames(input) {
  return input
    .split(/[,\n\r]+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function calculateSuspensionEnd(strikeCount) {
  const now = new Date();
  switch (strikeCount) {
    case 1: return addDays(now, 7).getTime();
    case 2: return addDays(now, 14).getTime();
    case 3: return addDays(now, 28).getTime();
    case 4: return addDays(now, 56).getTime();
    default:
      return new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
  }
}

export function isSuspended(suspendedUntil) {
  if (!suspendedUntil) return false;
  return suspendedUntil > Date.now();
}

export function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeET(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit',
  });
}

export function formatDateShort(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function buildFlatList(players, opts = {}) {
  if (!players || players.length === 0) return [];

  // Gear roles come from the ledger (opts.gearRoles: name → {bring:[], take:[]})
  // so ordering matches the coverage figures. On Fridays, people who took gear
  // home earlier that week (opts.gearPriorityNames) rank just below admins.
  const gearPriority = opts.gearPriorityNames || new Set();
  const gearRoles = opts.gearRoles || {};
  const nameKey = (p) => (p.name || '').toLowerCase().trim();
  // Match a person's gear role by their stable uid first (so a badge lands on the
  // right row even when stored names differ), falling back to the name key for
  // rows/commitments that predate uids.
  const roleOf = (p) => (p.uid && gearRoles[p.uid]) || gearRoles[nameKey(p)] || null;

  // List order: gear bringers → gear takers → admins/priority → Friday gear
  // priority → everyone else.
  const GEAR_ORDER = ['goal', 'balls', 'bibs'];
  const groupRank = (p) => {
    const r = roleOf(p);
    if (r && r.bring.length) return 0;
    if (r && r.take.length) return 1;
    if (p.isAdmin || p.priority) return 2;
    if (gearPriority.has(nameKey(p))) return 3;
    return 4;
  };
  const typeRank = (p) => {
    const r = roleOf(p);
    const g = r ? (r.bring[0] || r.take[0]) : null;
    const i = g ? GEAR_ORDER.indexOf(g) : -1;
    return i === -1 ? 99 : i;
  };

  // Expand into main entries + one entry per +1 guest, each tagged with the sort
  // keys we order by: rank, gear-type, time, and a per-host sequence. A +1 taken
  // AT signup (its add-time equals the host's signup time, or it has no recorded
  // time — legacy) inherits the host's keys so it renders right after them. A +1
  // added LATER carries its own add-time in the rest tier, so it falls into line
  // by when it was added instead of jumping to the host's spot.
  const entries = [];
  for (const p of players) {
    const hr = groupRank(p), hty = typeRank(p), hts = p.signedUpAt || 0;
    entries.push({ ...p, isMainEntry: true, _r: hr, _ty: hty, _t: hts, _seq: 0 });
    const times = Array.isArray(p.plusOnesAt) ? p.plusOnesAt : [];
    for (let i = 1; i <= (p.plusOnes || 0); i++) {
      const t = times[i - 1] ?? hts;
      const attached = t === hts; // taken at signup (or legacy with no time)
      entries.push({
        id: `${p.id}-plus${i}`,
        name: `${p.name} +${i}`,
        isMainEntry: false,
        parentId: p.id,
        isAdmin: false,
        deviceId: `__plus__${p.id}__${i}`,
        _r: attached ? hr : 4,       // late guests always rank in the rest tier
        _ty: attached ? hty : 99,
        _t: attached ? hts : t,      // late guests sort by when they were added
        _seq: attached ? i : 0,
      });
    }
  }

  entries.sort((a, b) =>
    (a._r - b._r) || (a._ty - b._ty) || (a._t - b._t) || (a._seq - b._seq));

  // Drop the internal sort keys before returning.
  for (const e of entries) { delete e._r; delete e._ty; delete e._t; delete e._seq; }
  return entries;
}
