// Home — regular-user "waiting" variant (roll call not yet open to everyone):
// game details + a countdown badge + "take gear & skip the wait" tiles.
// Built to match Figma node 2699:13045 "Page content".
//
// The badge has two forms. Sunday-to-Thursday, roll call opens later the SAME
// day, so a live countdown is useful. From Friday's 10 AM reset until Sunday the
// next game is Monday, whose roll call opens Sunday at 3 PM — a countdown there
// would read 40-plus hours for two days, which looks broken rather than
// informative, so it states the day instead.
//
// Everything else on this screen still applies over the weekend: you really can
// take gear on Saturday for Monday's game, which is why this is a badge swap
// rather than a separate "closed" screen.

import GameHeader from '../../components/GameHeader';
import GearTakers from '../../components/GearTakers';
import StatusBadge from '../../components/StatusBadge';
import { countdownToOpen, rollCallOpensLabel } from '../../state/rollCall';
import dividerIcon from '../../assets/icons/divider.svg';

export default function HomeWaiting({ opensLater = false }) {
  // Live countdown to when roll call opens (3 PM ET). HomeScreen's tick re-renders
  // this each second, so it recomputes without a per-screen timer here.
  const countdown = countdownToOpen();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '64px 24px 32px' }}>
      {/* Game details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <GameHeader />
        <StatusBadge>
          {opensLater ? `Roll call opens ${rollCallOpensLabel()}` : `Roll call opens in ${countdown}`}
        </StatusBadge>
      </div>

      {/* Asterisk divider */}
      <div style={{ width: 112, height: 16 }}>
        <img src={dividerIcon} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Take gear & skip the wait */}
      <GearTakers headline="Or take gear and skip the wait" />
    </div>
  );
}
