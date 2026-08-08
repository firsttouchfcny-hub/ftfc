// The "take gear" section — a headline + the four gear tiles (2 goals, balls,
// bibs). Reused on the roll-call waiting screen ("Or take gear and skip the wait")
// and the "You're in" screen ("Tomorrow's gear takers"); only the headline changes.

import GearTile from './GearTile';
import goalIcon from '../assets/gear/goal.png';
import ballsIcon from '../assets/gear/balls.png';
import bibsIcon from '../assets/gear/bibs.png';

export default function GearTakers({ headline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
      <p className="type-body-regular" style={{ color: 'var(--color-dark-gray)' }}>{headline}</p>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
        <GearTile icon={goalIcon} label="Goals" />
        <GearTile icon={goalIcon} label="Goals" />
        <GearTile icon={ballsIcon} label="Balls" />
        <GearTile icon={bibsIcon} label="Bibs" />
      </div>
    </div>
  );
}
