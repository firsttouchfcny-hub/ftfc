// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY helper for the design preview panel (see components/DevPanel.jsx).
// Produces a session object shaped exactly like the real one from Firestore, so
// the whole app renders identically with fake players. Never used in production.
// ─────────────────────────────────────────────────────────────────────────────

const NAMES = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Diego', 'Marco', 'Luis', 'Rafa', 'Tomas',
  'Nico', 'Ivan', 'Omar', 'Kofi', 'Yuki', 'Pablo', 'Andre', 'Leo', 'Max',
  'Theo', 'Ben', 'Gabe', 'Rui', 'Joel', 'Kai', 'Zane', 'Cruz', 'Dario', 'Emre',
  'Fabio', 'Gil', 'Hugo', 'Iker', 'Jae', 'Kian', 'Lars', 'Mo', 'Noah', 'Otis',
  'Pip', 'Quinn', 'Silva', 'Uri', 'Vin', 'Wes', 'Xavi',
];

// Build a fake session with `count` players. The player at 1-based `mePos`
// (0 = you're not signed up) is stamped with the real deviceId + your name, so
// the app treats it as "you" and the standing banner reflects that position.
export function buildMockSession(count, mode, mePos, deviceId, playerName) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const isMe = mePos > 0 && i === mePos - 1;
    const base = NAMES[i % NAMES.length];
    const suffix = i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '';
    players.push({
      id: isMe ? 'mock-me' : `mock-${i}`,
      name: isMe ? (playerName || 'You (preview)') : `${base}${suffix}`,
      deviceId: isMe ? deviceId : `mock-dev-${i}`,
      isAdmin: false,
      plusOnes: 0,
      signedUpAt: 1_000_000 + i, // ascending → signup order matches list order
    });
  }
  return { date: 'MOCK', isOpen: mode === 'open', players, drops: [] };
}
