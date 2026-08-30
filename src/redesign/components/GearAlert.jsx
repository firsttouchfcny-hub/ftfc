// The two gear warnings, in the redesign's language.
//
// These are the app's only UNPROMPTED messages — everything else it says is a
// reply to something you did. So they are deliberately quiet: a tinted card in
// the same family as the Match 2 waitlist badge, not a red banner shouting at
// someone who has done nothing wrong. Nobody is being told off; the club needs
// a volunteer.
//
// Two variants, and they are less alike than their names suggest:
//
//   bringing — nobody is carrying gear IN to the next game. Urgent (red), and
//              it must NAME the missing sets, because nothing else on the
//              screen shows this: the tiles below display who's taking gear
//              HOME, which is a different set of people entirely.
//   taking   — gear is at the field and nobody is carrying it onward, so the
//              game after gets stranded. A heads-up (orange) rather than an
//              emergency, and it can be brief: the empty tiles directly below
//              it are the gap it's describing, so it points at them instead of
//              listing them again.

import { gearIcon, gearLabel } from '../../utils/gear';
import { relativeDayName } from '../state/rollCall';
import alertIcon from '../assets/icons/alert.svg';
import warningIcon from '../assets/icons/warning.svg';

// "Goals 🥅", or "Goals 🥅 (1 of 2)" when some are covered — a partial shortfall
// reads very differently from none at all, and "(1/2)" is denser than it needs
// to be in a sentence.
const describe = ({ type, have, need }) =>
  `${gearLabel(type)} ${gearIcon(type)}${have > 0 ? ` (${have} of ${need})` : ''}`;

const joinList = (parts) =>
  parts.length <= 1 ? (parts[0] ?? '')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

// "tomorrow" / "today" read as words mid-sentence; a weekday is a name and keeps
// its capital, which means it also wants a preposition — "on Thursday".
const whenPhrase = (dayName) =>
  dayName === 'Today' || dayName === 'Tomorrow' ? dayName.toLowerCase() : `on ${dayName}`;

export default function GearAlert({ variant, date, missing = [] }) {
  if (!missing.length) return null;

  const bringing = variant === 'bringing';
  const tint = bringing ? 'var(--color-red)' : 'var(--color-expressive-orange)';
  const day = relativeDayName(date);
  const list = joinList(missing.map(describe));

  return (
    <div
      role="status"
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%',
        padding: 12, borderRadius: 12,
        background: `color-mix(in srgb, ${tint} 14%, transparent)`,
        border: `1px solid ${tint}`,
        color: 'var(--color-dark-gray)',
      }}
    >
      <img
        src={bringing ? alertIcon : warningIcon}
        alt=""
        style={{ width: 20, height: 20, display: 'block', flexShrink: 0, marginTop: 1 }}
      />
      <p className="type-caption-semibold" style={{ margin: 0, lineHeight: '18px' }}>
        {bringing ? (
          <>
            <strong className="type-caption-bold">No one is bringing gear {whenPhrase(day)}.</strong>
            {` ${list} won’t be at the field unless someone brings ${missing.length > 1 ? 'them' : 'it'} in.`}
          </>
        ) : (
          <>
            <strong className="type-caption-bold">Nobody’s taking gear home.</strong>
            {` ${list} won’t reach the next game. Take a set below and it’s covered.`}
          </>
        )}
      </p>
    </div>
  );
}
