// Demo roster data, shaped exactly like production so the redesign can run the
// REAL roster logic (`buildFlatList`) instead of a hand-sorted list.
//
// Three exports mirror what App.jsx passes around today:
//   · mockPlayers           → session.players (one entry per signup, +1s as a count)
//   · mockGearRoles         → name → { bring: [], take: [] }, derived from the ledger
//   · mockGearPriorityNames → Set of names with the Friday gear reward
//
// Swapping these for Firestore is the single seam that makes the roster live.
// `photoURL` is the one redesign-only addition (production has no avatars yet).

import sampleAvatar from '../assets/sample-avatar.png';

const nameKey = (n) => (n || '').toLowerCase().trim();

// signedUpAt increments with listing order, so the untiered majority keeps a
// stable, realistic signup ordering.
let seq = 0;
const P = (name, opts = {}) => {
  seq += 1;
  return {
    id: `p-${seq}`,
    // Identity is uid-keyed on main; only the current user needs one here, so
    // their roster row survives a rename.
    uid: opts.uid,
    name,
    photoURL: opts.photo ? sampleAvatar : null,
    isAdmin: !!opts.admin,
    // Production's admin-set per-day pin — ranks with admins, carries no badge.
    // Distinct from the Friday gear reward (mockGearPriorityNames below).
    priority: !!opts.pin,
    plusOnes: opts.plusOnes || 0,
    signedUpAt: seq * 60_000,
    deviceId: `dev-${seq}`,
  };
};

// One flat signup list — deliberately NOT pre-sorted. buildFlatList applies the
// real tiering: gear bringers → gear takers → admins/pinned → Friday gear
// priority → everyone else (then by signup time).
export const mockPlayers = [
  P('Cristian Lugo', { photo: true, admin: true, uid: 'mock-uid-001' }), // brings a goal · the "you" row
  P('Dave Rappaport', { photo: true, admin: true }),  // brings a goal
  P('This is a really long name', { admin: true }),   // brings balls
  P('Marco Silva', { photo: true }),                  // brings bibs
  P('Jordan Chen', { admin: true }),                  // admin, no gear
  P('Luis Gómez', { photo: true }),
  P('Theo Walsh', {}),                                // Friday gear priority
  P('Sam Okafor', { photo: true, plusOnes: 1 }),      // brings a +1 guest
  P('Nico Bruno', { photo: true }),                   // takes a goal home (photo avatar on the tile)
  P('Andre Costa', { photo: true }),
  P('Kofi Mensah', {}),                               // takes bibs home
  P('Omar Haddad', { photo: true }),
  P('Rafa Núñez', { pin: true }),                     // admin-pinned for today
  P('Ben Whitfield', { photo: true }),
  P('Gabe Ellison', {}),
  P('Hugo Park', { photo: true }),
  P('Iker Ruiz', {}),
  P('Leo Duarte', { photo: true }),
  P('Pablo Vega', {}),
  P('Dario Fuentes', { photo: true }),
  P('Zane Carter', {}),
  P('Emre Yılmaz', { photo: true }),
  P('Cruz Medina', {}),
  P('Joel Baptiste', { photo: true }),
  P('Kai Andersen', {}),
  P('Silva Rocha', { photo: true }),
  P('Uri Katz', {}),
  P('Vin Alvarez', { photo: true }),
  P('Wes Turner', {}),
  P('Xavi Moreno', { photo: true }),
  P('Yuki Tanaka', {}),
  P('Zeke Palmer', { photo: true }),
  P('Aron Beck', {}),
  P('Bo Nakamura', { photo: true }),
  P('Cy Ferreira', {}),
  P('Noah Bright', {}),
  P('Otis Grant', { photo: true }),
  P('Pip Hollis', {}),
  P('Quinn Ryder', { photo: true }),
];
// 39 players + Sam's guest = 40 roster entries → Match 1 (18) · Match 2 (18) · Bench (4).

// ── Gear ledger ────────────────────────────────────────────────────────────
// The commitment is the source of truth, exactly as in production: someone takes
// a set HOME on `takeDate` and brings it back IN on `returnDate`. Everything else
// (roles, coverage, the alerts) derives from these — so the gear tiles, the gear
// detail surface and the alerts can all read one shape.
//
// Dates are relative to GAME_DATE (tomorrow's game) so the mock stays coherent
// no matter when it's viewed.
// Real weekdays: games run Mon–Fri, so these must be too. Thu 15th is the game;
// Wed 14th is the game before it, and Fri 16th the one after.
const GAME_DATE = '2026-10-15';   // Thursday — the morning this screen is about
const PREV_GAME = '2026-10-14';   // Wednesday

export const mockCommitments = [
  // Taken home before → coming back IN on game day (these are the "bringers").
  { id: 'c1', takerName: 'Cristian Lugo', type: 'goal', takeDate: PREV_GAME, returnDate: GAME_DATE, status: 'committed' },
  { id: 'c2', takerName: 'Dave Rappaport', type: 'goal', takeDate: PREV_GAME, returnDate: GAME_DATE, status: 'committed' },
  { id: 'c3', takerName: 'This is a really long name', type: 'balls', takeDate: PREV_GAME, returnDate: GAME_DATE, status: 'committed' },
  { id: 'c4', takerName: 'Marco Silva', type: 'bibs', takeDate: PREV_GAME, returnDate: GAME_DATE, status: 'committed' },

  // Taking a set HOME after game day (these are the "takers"). Deliberately
  // short of full coverage so the alert states are previewable.
  { id: 'c5', takerName: 'Nico Bruno', type: 'goal', takeDate: GAME_DATE, returnDate: '2026-10-16', status: 'committed' },
  { id: 'c6', takerName: 'Kofi Mensah', type: 'bibs', takeDate: GAME_DATE, returnDate: '2026-10-16', status: 'committed' },
  // The current user takes the second goal, so the "yours" tile + its cancel
  // dialog are reachable in the demo alongside someone else's commitment.
  { id: 'c7', takerName: 'Cristian Lugo', type: 'goal', takeDate: GAME_DATE, returnDate: '2026-10-16', status: 'committed' },
];

// Derive name → { bring: [], take: [] } for the game-day morning, the same way
// App.jsx builds `gearRoles` before handing it to buildFlatList.
export const mockGearRoles = (() => {
  const roles = {};
  const add = (name, kind, type) => {
    const k = nameKey(name);
    if (!roles[k]) roles[k] = { bring: [], take: [] };
    if (!roles[k][kind].includes(type)) roles[k][kind].push(type);
  };

  for (const c of mockCommitments) {
    if (c.status !== 'committed') continue;
    // Bringing it IN on game day…
    if (c.returnDate === GAME_DATE) add(c.takerName, 'bring', c.type);
    // …or taking it HOME after game day. Takers keep their queue privilege but
    // show no row badge — they're surfaced by their avatar in the gear strip.
    if (c.takeDate === GAME_DATE) add(c.takerName, 'take', c.type);
  }
  return roles;
})();

export const mockGameDate = GAME_DATE;

// ── Drops today ────────────────────────────────────────────────────────────
// People who signed up and then pulled out. Production records these on the
// session as { name, deviceId, at, fromBench } and clears them at the 10 AM
// rollover; `fromBench` marks whether the drop freed a playing spot.
//
// NOTE: the design shows an avatar, an admin crown and a "+1" badge on these
// rows, but production's drop record carries none of that — only a name. Wiring
// this for real needs the drop to carry the person's uid (now that identity is
// uid-keyed) so the profile can be resolved at render, or the record extended.
//
// Fixed timestamps so the rendered times are deterministic (ET, so 22:25Z = 6:25 PM).
const at = (iso) => Date.parse(iso);
export const mockDrops = [
  { id: 'd1', name: 'Priya Raman',  photoURL: sampleAvatar, at: at('2026-10-10T22:25:00Z'), fromBench: false },
  { id: 'd2', name: 'Tom Alvarez',  photoURL: sampleAvatar, at: at('2026-10-10T21:40:00Z'), fromBench: false, plusOne: true },
  { id: 'd3', name: 'Dana Whitlock', photoURL: sampleAvatar, at: at('2026-10-10T20:12:00Z'), fromBench: false, admin: true },
  { id: 'd4', name: 'Jules Carver', photoURL: null,         at: at('2026-10-10T15:05:00Z'), fromBench: true },
  { id: 'd5', name: 'Remy Ocampo',  photoURL: null,         at: at('2026-10-10T13:30:00Z'), fromBench: true },
];

// Friday reward: took a set home earlier this week (Mon–Thu). Production derives
// this from the ledger via fridayGearPriorityNames() and it is empty except on
// Fridays; here it's fixed so the badge + tier are always previewable.
export const mockGearPriorityNames = new Set([nameKey('Theo Walsh')]);
