export function getToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns the date key for the active session:
//   Before noon  → today   (morning game already happened / strike window)
//   Noon or after → tomorrow (signing up for next day's game)
export function getSessionDate() {
  const now = new Date();
  if (now.getHours() < 12) {
    return getToday();
  }
  return getTomorrow();
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

  const sorted = [...players].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return (a.signedUpAt || 0) - (b.signedUpAt || 0);
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
