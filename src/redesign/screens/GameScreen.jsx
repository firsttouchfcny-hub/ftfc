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

// "1st", "2nd", "3rd", "4th"… for the bench standing headline.
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

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

  // Current user's standing headline. `?standing=bench` previews the bench spot;
  // the position is dynamic — it comes from the user's real place in the line.
  const benchPosition = 2; // mock — real value comes from the user's spot in line
  let headline = 'You’re in';
  let badge;
  if (params.get('standing') === 'bench') {
    headline = `You are ${ordinal(benchPosition)} in bench`;
  } else if (cancelled) {
    headline = 'No game — match 2 cancelled';
  } else if (onHold) {
    headline = 'In match 2 waitlist';
    badge = `${needed} more players needed for 2nd match`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '8px 16px 32px' }}>
      <Confirmation headline={headline} badge={badge} />
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
