// The "take gear" section — a headline + the four gear tiles (2 goals, balls,
// bibs). Reused on the roll-call waiting screen ("Or take gear and skip the wait")
// and the "You're in" screen; only the headline changes.
//
// Tapping a tile's "+" opens the take-home dialog. Both of its options create the
// commitment and bring the gear back — the choice is only whether you're also
// playing, which is why both labels turn on that and the body asks it outright.
// "Take gear only" is production's gearOnly: no roster row on either day.

import { useState } from 'react';
import Dialog from './Dialog';
import GearTile from './GearTile';
import { gearIcon, gearLabel, playerReturnDates } from '../../utils/gear';
import { formatWeekday, formatGameDate } from '../state/rollCall';
import { mockCommitments, mockGameDate } from '../state/mockRoster';
import goalIcon from '../assets/gear/goal.png';
import ballsIcon from '../assets/gear/balls.png';
import bibsIcon from '../assets/gear/bibs.png';

// Two goal sets are needed per game, so the row shows two goal tiles.
const TILES = [
  { key: 'goal-1', type: 'goal', icon: goalIcon },
  { key: 'goal-2', type: 'goal', icon: goalIcon },
  { key: 'balls', type: 'balls', icon: ballsIcon },
  { key: 'bibs', type: 'bibs', icon: bibsIcon },
];

export default function GearTakers({
  headline,
  commitments = mockCommitments,
  takeDate = mockGameDate,
  onTake,
}) {
  const [taking, setTaking] = useState(null); // gear type mid-confirmation

  // When the gear comes back. Production fixes this to the earliest open day for
  // goals and balls (so every game stays covered) and only lets you choose for
  // bibs when the near games are already covered.
  //
  // NOTE: when there IS a choice, production shows a date picker first. That step
  // has no design yet, so this takes the earliest option — see the inventory.
  const returnDate = taking
    ? playerReturnDates(commitments, taking, takeDate)[0]
    : null;

  const close = () => setTaking(null);
  const take = (playing) => { onTake?.(taking, returnDate, playing); close(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
      <p className="type-body-regular" style={{ color: 'var(--color-dark-gray)' }}>{headline}</p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
        {TILES.map(({ key, type, icon }) => (
          <GearTile
            key={key}
            icon={icon}
            label={gearLabel(type)}
            onAdd={() => setTaking(type)}
          />
        ))}
      </div>

      <Dialog
        open={!!taking}
        headline={taking ? `Take home ${gearLabel(taking)} ${gearIcon(taking)}` : ''}
        body={taking ? (
          <>
            You’ll take them home after{' '}
            <strong style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatWeekday(takeDate)}</strong>’s
            game and bring them back on{' '}
            <strong style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatGameDate(returnDate)}</strong>.
            <br /><br />
            Are you playing both days?
          </>
        ) : null}
        confirmLabel="Take & play both days"
        onConfirm={() => take(true)}
        secondaryLabel="Take gear only"
        onSecondary={() => take(false)}
        cancelLabel="Cancel"
        onCancel={close}
      />
    </div>
  );
}
