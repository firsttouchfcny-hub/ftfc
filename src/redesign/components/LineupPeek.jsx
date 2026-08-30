// The facepile plus the sheet it opens, as one drop-in piece.
//
// All three roll-call variants show this — open, waiting and suspended — so the
// state lives here rather than being re-implemented in each. Suspended included
// on purpose: you can't join while suspended, but you can still see who's
// playing, and that's most of why anyone opens the app.

import { useState } from 'react';
import Facepile from './Facepile';
import LineupSheet from './LineupSheet';
import { useCurrentUser } from '../identity/useCurrentUser';
import { buildRosterRows } from '../state/rosterRows';
import { mockPlayers } from '../state/mockRoster';

export default function LineupPeek({ players = mockPlayers }) {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const { total, match1, match2, bench } = buildRosterRows(players, user);

  // Faces come from real people only — a guest repeats their host's avatar, so
  // including them would show the same face twice and read as a bug. The COUNT
  // still includes guests, because a guest is a person who is playing.
  const faces = [...match1, ...match2, ...bench].filter((r) => !r.plusOne);

  return (
    <>
      <Facepile players={faces} onOpen={() => setOpen(true)} total={total} />
      <LineupSheet open={open} players={players} onClose={() => setOpen(false)} />
    </>
  );
}
