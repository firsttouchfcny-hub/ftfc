// Turning the roster into rows, in one place.
//
// The game screen and the lineup sheet both render the same list, so this has
// to be shared — two copies of the mapping would drift, and the thing that
// would drift is which row reads as "you", which badge shows, and where the
// tier boundaries fall.
//
// The ordering itself is production's: `buildFlatList` applies the real tiering
// (bringers → takers → admins/pinned → Friday gear priority → rest, then signup
// time) and expands each player's +1s into their own entries.

import { buildFlatList, isSamePerson, MATCH1_MAX, MATCH2_MAX } from '../../utils/helpers';
import { gearIcon } from '../../utils/gear';
import { mockGearRoles, mockGearPriorityNames } from './mockRoster';

export const nameKey = (n) => (n || '').toLowerCase().trim();

// Map one flat entry onto PlayerRow's props. Guests repeat their host's avatar
// and name (the "+1" badge carries the distinction), so we look the host up by
// parentId rather than using buildFlatList's generated "Name +1" string.
export function toRow(entry, index, byId, me) {
  const host = entry.isMainEntry ? entry : byId.get(entry.parentId);
  const role = entry.isMainEntry ? mockGearRoles[nameKey(entry.name)] : null;
  const hasGear = !!(role && (role.bring.length || role.take.length));

  // Rows store the name captured at signup, but production resolves display
  // names by uid at render so a rename propagates everywhere. Only the current
  // user carries a uid in this mock, so resolving theirs is the whole job here.
  const isSelf = !!host?.uid && host.uid === me.uid;

  return {
    id: entry.id,
    position: String(index + 1).padStart(2, '0'),
    name: isSelf ? me.displayName : (host?.name ?? entry.name),
    photoURL: isSelf ? me.photoURL : (host?.photoURL ?? null),
    admin: !!entry.isAdmin,
    // Only bringers get a row badge; takers are shown in the gear-takers strip.
    bringing: role?.bring.length ? gearIcon(role.bring[0]) : null,
    // Same suppression as production: hidden when the player already reads as a
    // gear bringer/taker or an admin.
    gearPriority: entry.isMainEntry && !hasGear && !entry.isAdmin
      && mockGearPriorityNames.has(nameKey(entry.name)),
    plusOne: !entry.isMainEntry,
    // Matched with production's isSamePerson (uid first, name as the fallback
    // for rows without one), so renaming yourself doesn't lose the highlight.
    // Never a guest row — it repeats the host's name by design.
    isYou: entry.isMainEntry && isSamePerson(entry, { uid: me.uid, name: me.displayName }),
  };
}

// The whole roster, sliced 18 / 18 / overflow the way production does.
// `entries` lets a caller pass a pre-trimmed list (the Match 2 previews use a
// shorter roster) without duplicating the mapping.
export function buildRosterRows(players, me, entries) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const list = entries ?? buildFlatList(players, {
    gearRoles: mockGearRoles,
    gearPriorityNames: mockGearPriorityNames,
  });
  return {
    entries: list,
    total: list.length,
    match1: list.slice(0, MATCH1_MAX).map((e, i) => toRow(e, i, byId, me)),
    match2: list.slice(MATCH1_MAX, MATCH2_MAX).map((e, i) => toRow(e, MATCH1_MAX + i, byId, me)),
    bench: list.slice(MATCH2_MAX).map((e, i) => toRow(e, MATCH2_MAX + i, byId, me)),
  };
}
