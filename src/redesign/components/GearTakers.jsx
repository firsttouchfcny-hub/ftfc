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
import GearCommitmentLine from './GearCommitmentLine';
import GearTile from './GearTile';
import { gearIcon, gearLabel, playerReturnDates, takersFor, takeBlockedByPriority } from '../../utils/gear';
import { formatWeekday, formatGameDate } from '../state/rollCall';
import { useCurrentUser } from '../identity/useCurrentUser';
import { isSamePerson } from '../../utils/helpers';
import { mockCommitments, mockGameDate, mockPlayers } from '../state/mockRoster';
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
  players = mockPlayers,
  onTake,
}) {
  const [taking, setTaking] = useState(null);   // gear type mid-take-confirmation
  const [viewing, setViewing] = useState(null); // a claimed commitment being viewed
  const me = useCurrentUser();

  // Who is taking each set home after this game, straight from the ledger — the
  // same source the coverage figures and alerts read, so the tiles can't
  // disagree with them. Commitments carry a name; the photo is resolved from the
  // roster, mirroring how production resolves display names by uid at render.
  const photoOf = (name) =>
    players.find((p) => p.name.toLowerCase() === (name || '').toLowerCase())?.photoURL ?? null;

  // One queue per type, so two goal tiles fill independently: the first goal
  // taken claims the first tile and the second stays free.
  const queues = { goal: [], balls: [], bibs: [] };
  for (const c of takersFor(commitments, takeDate)) queues[c.type]?.push(c);
  // Balls-gate: balls can't be taken until goals AND bibs are fully taken. When
  // locked, a still-free balls tile shows the disabled icon button.
  const ballsLocked = takeBlockedByPriority(commitments, 'balls', takeDate);
  const assigned = TILES.map(({ type, ...rest }) => {
    const c = queues[type].shift();
    const takenBy = c
      ? { name: c.takerName, photoURL: photoOf(c.takerName), type, returnDate: c.returnDate }
      : null;
    return { type, ...rest, takenBy, locked: !takenBy && type === 'balls' && ballsLocked };
  });

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
        {assigned.map(({ key, type, icon, takenBy, locked }) => (
          <GearTile
            key={key}
            icon={icon}
            label={gearLabel(type)}
            takenBy={takenBy}
            locked={locked}
            onAdd={() => setTaking(type)}
            onOpenTaken={() => setViewing(takenBy)}
          />
        ))}
      </div>

      <Dialog
        open={!!taking}
        headline={taking ? `Take ${gearLabel(taking)} ${gearIcon(taking)}` : ''}
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

      {/* Tapping a claimed tile shows who has it. It's your own commitment when
          the taker matches you — then the button cancels it; otherwise the
          dialog is informational and just closes (Figma 3323:21876 / 21901). */}
      <Dialog
        open={!!viewing}
        content={viewing ? (
          <GearCommitmentLine
            name={viewing.name}
            photoURL={viewing.photoURL}
            isYou={isSamePerson({ name: viewing.name }, { uid: me.uid, name: me.displayName })}
            type={viewing.type}
            returnLabel={formatGameDate(viewing.returnDate)}
          />
        ) : null}
        confirmLabel={
          viewing && isSamePerson({ name: viewing.name }, { uid: me.uid, name: me.displayName })
            ? `Stop taking ${gearLabel(viewing.type)}`
            : 'Close'
        }
        confirmVariant="secondary"
        onConfirm={() => setViewing(null)}
      />
    </div>
  );
}
