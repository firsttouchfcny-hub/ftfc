// The lineup, as a read-only bottom sheet (Figma 3647:22988).
//
// Opened from the facepile on the roll-call screen. Deliberately view-only:
// this answers "who's in?" before you decide to join, and every action that
// belongs to the roster — dropping, adding a guest — lives on the "You're in"
// screen where it has consequences.
//
// The rows are the same `RosterSection` / `PlayerRow` as the game screen, built
// from the same shared mapping, so the two can't disagree about who is where.

import BottomSheet from './BottomSheet';
import RosterSection from './RosterSection';
import TableCard from './TableCard';
import { useCurrentUser } from '../identity/useCurrentUser';
import { buildRosterRows } from '../state/rosterRows';
import { getMatch2State } from '../../utils/helpers';

export default function LineupSheet({ open, players, onClose }) {
  const user = useCurrentUser();
  const { total, match1, match2, bench } = buildRosterRows(players, user);
  const match2State = getMatch2State(total);

  return (
    <BottomSheet open={open} title="Lineup" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <TableCard>
          <RosterSection label="Match 1" players={match1} />
          {match2.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--color-light-olive)', margin: '0 9px' }} />
              {/* Same labelling as the game screen — someone reading the lineup
                  should learn that Match 2 is on hold or off, not just see names. */}
              <RosterSection
                label={
                  match2State === 'off' ? 'Match 2 — NO GAME'
                  : match2State === 'on-hold' ? 'Match 2 on hold'
                  : 'Match 2'
                }
                dimmed={match2State !== 'confirmed'}
                players={match2}
              />
            </>
          )}
        </TableCard>

        {/* Bench in its own card, as on the game screen. Included on purpose:
            they're in line waiting for a drop, so leaving them out would
            misstate who has actually signed up. */}
        {bench.length > 0 && (
          <TableCard>
            <RosterSection label="Bench" players={bench} />
          </TableCard>
        )}
      </div>
    </BottomSheet>
  );
}
