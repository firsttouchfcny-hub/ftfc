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
export const GEAR_OPEN_HOUR_ET = 12; // 12 PM ET — gear tiles become tappable

// Roster sizing: two matches of 18 = 36 play; rest are bench.
export const MATCH1_MAX = 18;
export const MATCH2_MAX = 36;
export const MATCH2_MIN_CONFIRM = 30; // total signups needed before Match 2 is confirmed

// Equipment a player can volunteer for, in priority order (top of the list).
export const GEAR_TYPES = [
  { key: 'goal',  icon: '🥅', label: 'Goals', slots: 2 },
  { key: 'bibs',  icon: '🧺', label: 'Bibs',  slots: 1 },
  { key: 'balls', icon: '⚽', label: 'Balls', slots: 1 },
];

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

// The game date the app is focused on, in Eastern time:
//   Before 10 AM ET  → today's game (last night's locked roster)
//   10 AM ET or later → tomorrow's game (the list has reset for the next day)
export function getSessionDate() {
  const et = getEasternNow();
  return et.hour < RESET_HOUR_ET ? et.dateKey : addDaysToKey(et.dateKey, 1);
}

// Roll-call phase for the active signup day, in Eastern time:
//   'closed'      → before 10 AM (prior game still showing; nothing to join yet)
//   'admins-only' → 10 AM–3 PM (admins may sign up early)
//   'open'        → 3 PM onward (everyone may sign up)
export function getRollCallPhase() {
  const { hour } = getEasternNow();
  if (hour < RESET_HOUR_ET) return 'closed';
  if (hour < OPEN_HOUR_ET) return 'admins-only';
  return 'open';
}

// Effective open state. An admin may override the schedule for the day via
// session.override ('open' | 'closed'); otherwise it follows the 3 PM rule.
export function isRollCallOpen(session) {
  const ov = session?.override;
  if (ov === 'open') return true;
  if (ov === 'closed') return false;
  return getRollCallPhase() === 'open';
}

// Admins may sign up during the admins-only window as well as when fully open.
export function canAdminSignUp(session) {
  if (isRollCallOpen(session)) return true;
  return getRollCallPhase() === 'admins-only';
}

// Gear tiles open at noon ET and stay open (per slot) until filled.
export function isGearOpen() {
  return getEasternNow().hour >= GEAR_OPEN_HOUR_ET;
}

export function gearIcon(key) {
  return GEAR_TYPES.find((g) => g.key === key)?.icon || '';
}

// How many of each gear type are currently claimed on a session.
export function gearTakenCount(players, key) {
  return (players || []).filter((p) => p.gear === key).length;
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

export function buildFlatList(players) {
  if (!players || players.length === 0) return [];

  const gearRank = (p) => {
    if (!p.gear) return 99;
    const i = GEAR_TYPES.findIndex((g) => g.key === p.gear);
    return i === -1 ? 99 : i;
  };

  const sorted = [...players].sort((a, b) => {
    const ar = gearRank(a), br = gearRank(b);
    if (ar !== br) return ar - br;                          // gear-takers first (goal→bibs→balls)
    if (ar !== 99) return (a.signedUpAt || 0) - (b.signedUpAt || 0); // same gear → earliest claim
    if (a.isAdmin && !b.isAdmin) return -1;                 // then admins
    if (!a.isAdmin && b.isAdmin) return 1;
    return (a.signedUpAt || 0) - (b.signedUpAt || 0);       // then by signup time
  });

  const flat = [];
  for (const player of sorted) {
    flat.push({ ...player, isMainEntry: true });
    for (let i = 1; i <= (player.plusOnes || 0); i++) {
      flat.push({
        id: `${player.id}-plus${i}`,
        name: `${player.name} +${i}`,
        isMainEntry: false,
        parentId: player.id,
        isAdmin: false,
        deviceId: `__plus__${player.id}__${i}`,
      });
    }
  }
  return flat;
}
