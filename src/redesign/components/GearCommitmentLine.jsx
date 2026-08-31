// The sentence inside the gear-commitment dialogs (Figma 3323:21876 / 3323:21901):
//
//   [avatar] You are taking [🥅] to
//   bring back Mon, Aug 24
//
// Built as a wrapping flex row rather than a string, because the avatar and gear
// chips are real 28px elements that have to sit inline with 22/32 text. Wrapping
// is left to the browser instead of an authored line break, so any name length
// or gear label reflows safely.

import PlayerAvatar from './PlayerAvatar';
import GearChip from './GearChip';

const CHIP = 28;

export default function GearCommitmentLine({ name, photoURL, isYou, type, returnLabel }) {
  // "You are taking" vs "Dave R is taking" — the verb has to agree, so the
  // frame's "{name} are taking" only works for the first person.
  const who = isYou ? 'You' : name;
  const verb = isYou ? 'are taking' : 'is taking';

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        color: 'var(--color-dark-gray)',
      }}
    >
      <PlayerAvatar name={name} photoURL={photoURL} size={CHIP} />
      <span className="type-subheading-regular">
        <strong className="type-subheading-bold">{who}</strong> {verb}
      </span>
      <GearChip type={type} size={CHIP} />
      <span className="type-subheading-regular">
        to bring back <strong className="type-subheading-bold">{returnLabel}</strong>
      </span>
    </div>
  );
}
