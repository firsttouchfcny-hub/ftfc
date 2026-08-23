// A gear icon in a small Light Olive circle, sized to sit inline with text
// (Figma 3323:21876). Used in the gear dialogs, where the sentence reads
// "… is taking [🥅] to bring back …" with the gear as a chip rather than a word.

import { gearLabel } from '../../utils/gear';
import goalIcon from '../assets/gear/goal.png';
import ballsIcon from '../assets/gear/balls.png';
import bibsIcon from '../assets/gear/bibs.png';

const ICONS = { goal: goalIcon, balls: ballsIcon, bibs: bibsIcon };

export default function GearChip({ type, size = 28 }) {
  return (
    <span
      title={gearLabel(type)}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 1000,
        background: 'var(--color-light-olive)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <img
        src={ICONS[type]}
        alt={gearLabel(type)}
        // 16px glyph in a 28px circle, per the frame.
        style={{ width: Math.round(size * 0.57), height: Math.round(size * 0.57), display: 'block', objectFit: 'contain' }}
      />
    </span>
  );
}
