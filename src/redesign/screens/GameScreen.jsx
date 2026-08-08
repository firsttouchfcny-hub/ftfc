// "You're in" — post-sign-up game screen. Built from Figma node 2730:10542.
// Top built: the confirmation header + the gear-takers section. The Match 1/2/
// Bench table is intentionally not built yet (next).

import { useSearchParams } from 'react-router-dom';
import Confirmation from '../components/Confirmation';
import GearTakers from '../components/GearTakers';
import RosterSection from '../components/RosterSection';
import TableCard from '../components/TableCard';
import { MATCH2_MIN_CONFIRM, getMatch2State } from '../../utils/helpers';
import { mockRoster } from '../state/mockRoster';
import alertIcon from '../assets/icons/alert.svg';
import noGameIcon from '../assets/icons/no-game.svg';

export default function GameScreen() {
  const [params] = useSearchParams();
  const preview = params.get('match2'); // 'onhold' | 'cancelled' | null

  // A short Match 2 for the on-hold / cancelled previews.
  const short = preview === 'onhold' || preview === 'cancelled';
  const match2 = short ? mockRoster.match2.slice(0, 6) : mockRoster.match2;
  const total = mockRoster.match1.length + match2.length;
  const needed = Math.max(0, MATCH2_MIN_CONFIRM - total);

  // Match 2 state: 'confirmed' (30+), 'on-hold' (short, before 9pm), or 'off'
  // (short, past the 9pm ET cutoff). Real logic via getMatch2State; the preview
  // param forces on-hold / cancelled (which is time-gated otherwise).
  const match2State =
    preview === 'onhold' ? 'on-hold'
    : preview === 'cancelled' ? 'off'
    : getMatch2State(total);
  const onHold = match2State === 'on-hold';
  const cancelled = match2State === 'off';

  // The bench only exists once both matches are full (37+ signups) — so never
  // while Match 2 is on hold or cancelled.
  const bench = match2State === 'confirmed' ? mockRoster.bench : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '8px 16px 32px' }}>
      <Confirmation
        headline={
          cancelled ? 'No game — match 2 cancelled'
          : onHold ? 'In match 2 waitlist'
          : 'You’re in'
        }
        badge={onHold ? `${needed} more players needed for 2nd match` : undefined}
      />
      <GearTakers headline="Tomorrow’s gear takers" />

      {/* Roster: the two matches share one card; the bench is its own card. */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TableCard>
          <RosterSection label="Match 1" players={mockRoster.match1} />
          <div style={{ height: 1, background: 'var(--color-light-olive)', width: '100%' }} />
          <RosterSection
            label={cancelled ? 'Match 2 — NO GAME' : onHold ? 'Match 2 on hold' : 'Match 2'}
            subtitle={
              cancelled ? "We didn't reach enough players"
              : onHold ? `${needed} more players needed for a second match.`
              : undefined
            }
            icon={cancelled ? noGameIcon : onHold ? alertIcon : undefined}
            dimmed={onHold || cancelled}
            players={match2}
          />
        </TableCard>

        {bench.length > 0 && (
          <TableCard>
            <RosterSection label="Bench" players={bench} />
          </TableCard>
        )}
      </div>
    </div>
  );
}
