// "You're in" — post-sign-up game screen. Built from Figma node 2730:10542.
// Top built: the confirmation header + the gear-takers section. The Match 1/2/
// Bench table is intentionally not built yet (next).

import Confirmation from '../components/Confirmation';
import GearTakers from '../components/GearTakers';
import RosterSection from '../components/RosterSection';
import TableCard from '../components/TableCard';
import { mockRoster } from '../state/mockRoster';

export default function GameScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '8px 16px 32px' }}>
      <Confirmation headline="You’re in" />
      <GearTakers headline="Tomorrow’s gear takers" />

      {/* Roster: the two matches share one card; the bench is its own card. */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TableCard>
          <RosterSection label="Match 1" players={mockRoster.match1} />
          <div style={{ height: 1, background: 'var(--color-light-olive)', width: '100%' }} />
          <RosterSection label="Match 2" players={mockRoster.match2} />
        </TableCard>

        <TableCard>
          <RosterSection label="Bench" players={mockRoster.bench} />
        </TableCard>
      </div>
    </div>
  );
}
