// Home — regular-user "waiting" variant (roll call not yet open to everyone):
// game details + a countdown badge + "take gear & skip the wait" tiles.
// Built to match Figma node 2699:13045 "Page content".
//
// NOTE: the countdown text and game date are the design's static values for now;
// the live countdown-to-3pm and the real next-game date wire in with the time logic.

import GameHeader from '../../components/GameHeader';
import GearTile from '../../components/GearTile';
import StatusBadge from '../../components/StatusBadge';
import { countdownToOpen } from '../../state/rollCall';
import dividerIcon from '../../assets/icons/divider.svg';
import goalIcon from '../../assets/gear/goal.png';
import ballsIcon from '../../assets/gear/balls.png';
import bibsIcon from '../../assets/gear/bibs.png';

export default function HomeWaiting() {
  // Live countdown to when roll call opens (3 PM ET). HomeScreen's tick re-renders
  // this each second, so it recomputes without a per-screen timer here.
  const countdown = countdownToOpen();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '64px 24px 32px' }}>
      {/* Game details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <GameHeader />
        {/* Live countdown to 3 PM ET (see countdownToOpen) */}
        <StatusBadge>Roll call opens in {countdown}</StatusBadge>
      </div>

      {/* Asterisk divider */}
      <div style={{ width: 112, height: 16 }}>
        <img src={dividerIcon} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Take gear & skip the wait */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
        <p className="type-body-regular" style={{ color: 'var(--color-dark-gray)' }}>Or take gear and skip the wait</p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          <GearTile icon={goalIcon} label="Goals" />
          <GearTile icon={goalIcon} label="Goals" />
          <GearTile icon={ballsIcon} label="Balls" />
          <GearTile icon={bibsIcon} label="Bibs" />
        </div>
      </div>
    </div>
  );
}
