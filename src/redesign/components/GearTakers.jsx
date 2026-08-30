// The "take gear" section — a headline + the four gear tiles (2 goals, balls,
// bibs). Reused on the roll-call waiting screen ("Or take gear and skip the wait")
// and the "You're in" screen; only the headline changes.
//
// Tapping a tile's "+" opens the take-home dialog. Both of its options create the
// commitment and bring the gear back — the choice is only whether you're also
// playing, which is why both labels turn on that and the body asks it outright.
// "Take gear only" is production's gearOnly: no roster row on either day.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Dialog from './Dialog';
import GearCommitmentLine from './GearCommitmentLine';
import GearTile from './GearTile';
import { GearSkeleton } from './Skeleton';
import CouldNotLoad from './CouldNotLoad';
import {
  gearIcon, gearLabel, playerReturnDates, takersFor, takeBlockedByPriority, gearTakingAlert,
} from '../../utils/gear';
import { formatWeekday, formatGameDate, formatChipDate, relativeDayName } from '../state/rollCall';
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
  // Optional. Left out, it names the take day relative to now — so the heading
  // can't drift from the date the tiles and dialog below it are talking about.
  // The roll-call screen passes its own, which isn't about a day at all.
  headline,
  commitments = mockCommitments,
  takeDate = mockGameDate,
  players = mockPlayers,
  // Whether you're ALREADY on the take-day roster. Deliberately a fact passed in
  // rather than inferred from which screen this is: after 3 PM you can sign up
  // on the roll-call screen and then take gear from that same screen, so the
  // screen is not a reliable signal — the roster is. Same flag the cancel
  // behaviour keys on.
  alreadyIn = false,
  onTake,
}) {
  const [taking, setTaking] = useState(null);   // gear type mid-take-confirmation
  const [pickedDate, setPickedDate] = useState(null); // chosen return day, when there's a choice
  const [params] = useSearchParams();
  const [viewing, setViewing] = useState(null); // a claimed commitment being viewed
  const me = useCurrentUser();

  // `?day=today|tomorrow|later` previews the three headline forms. Needed
  // because the mock take date is pinned to October: left to itself the preview
  // would only ever show the weekday form.
  const dayPreview = params.get('day');
  const dayName =
    dayPreview === 'today' ? 'Today'
    : dayPreview === 'tomorrow' ? 'Tomorrow'
    : dayPreview === 'later' ? formatWeekday(takeDate)
    : relativeDayName(takeDate);
  const heading = headline ?? `${dayName}’s gear takers`;

  // `?loading=1` previews the pre-data state on every surface at once;
  // `?error=1` / `?error=offline` preview the two ways it can fail.
  const loading = params.get('loading') === '1';
  // `?error=gear` fails only this strip — a partial failure, where the rest of
  // the page is still good. A total failure is handled by the screen, not here.
  const errorParam = params.get('error');
  const failed = errorParam === 'gear';

  // `?picker=1` previews the rare multi-option case (see below).
  // `?alert=taking` clears the take-day takers so every tile is free and the
  // badges are visible — otherwise the mock has them all claimed and there is
  // nothing to warn about.
  const previewTaking = params.get('alert') === 'taking' || params.get('alert') === 'both';
  const ledger = params.get('picker') === '1'
    ? [
        // free the bibs tile so the take dialog is reachable…
        ...commitments.filter((c) => !(c.type === 'bibs' && c.takeDate === takeDate)),
        // …and cover the next two bibs mornings, which is what unlocks the choice
        { id: 'preview-a', takerName: 'Preview', type: 'bibs', takeDate: '2026-10-14', returnDate: '2026-10-16', status: 'committed' },
        { id: 'preview-b', takerName: 'Preview', type: 'bibs', takeDate: '2026-10-14', returnDate: '2026-10-19', status: 'committed' },
      ]
    : commitments;

  // Nobody taking a set home — flagged ON the tile rather than in a paragraph
  // above it (3317:13786). The tile is what needs tapping, so that is where the
  // attention belongs, and no words are needed to say it.
  //
  // Gated to 6 PM ET by `gearTakingAlert`, which is production's rule: before
  // the evening there is still plenty of time for someone to volunteer.
  const visibleLedger = previewTaking
    ? ledger.filter((c) => c.takeDate !== takeDate)
    : ledger;

  const takingAlert = previewTaking
    ? { date: takeDate, missing: [{ type: 'goal', have: 0, need: 2 }, { type: 'balls', have: 0, need: 1 }, { type: 'bibs', have: 0, need: 1 }] }
    : gearTakingAlert(ledger);
  const needsTaker = new Set((takingAlert?.missing ?? []).map((m) => m.type));

  // Who is taking each set home after this game, straight from the ledger — the
  // same source the coverage figures and alerts read, so the tiles can't
  // disagree with them. Commitments carry a name; the photo is resolved from the
  // roster, mirroring how production resolves display names by uid at render.
  const photoOf = (name) =>
    players.find((p) => p.name.toLowerCase() === (name || '').toLowerCase())?.photoURL ?? null;

  // One queue per type, so two goal tiles fill independently: the first goal
  // taken claims the first tile and the second stays free.
  const queues = { goal: [], balls: [], bibs: [] };
  for (const c of takersFor(visibleLedger, takeDate)) queues[c.type]?.push(c);
  // Balls-gate: balls can't be taken until goals AND bibs are fully taken. When
  // locked, a still-free balls tile shows the disabled icon button.
  const ballsLocked = takeBlockedByPriority(ledger, 'balls', takeDate);
  const assigned = TILES.map(({ type, ...rest }) => {
    const c = queues[type].shift();
    const takenBy = c
      ? { name: c.takerName, photoURL: photoOf(c.takerName), type, returnDate: c.returnDate }
      : null;
    const locked = !takenBy && type === 'balls' && ballsLocked;
    return {
      type, ...rest, takenBy, locked,
      // Not on a locked tile: balls stays shut until goals and bibs are taken,
      // and flagging a tile you can't tap only invites a tap that does nothing.
      warning: !takenBy && !locked && needsTaker.has(type),
    };
  });

  // When the gear comes back. Production fixes this to the earliest open day for
  // goals and balls (so every game stays covered) and only lets you choose for
  // bibs when the near games are already covered.
  //
  // NOTE: when there IS a choice, production shows a date picker first. That step
  // has no design yet, so this takes the earliest option — see the inventory.
  // Production fixes this to the earliest open day for goals and balls, and for
  // bibs too whenever a near game is uncovered — so most of the time there is
  // exactly one option and no choice to present. Only bibs, only when the next
  // games are already covered, yield several.
  const returnOptions = taking ? playerReturnDates(ledger, taking, takeDate) : [];
  const returnDate = pickedDate && returnOptions.includes(pickedDate)
    ? pickedDate
    : returnOptions[0] ?? null;

  const close = () => { setTaking(null); setPickedDate(null); };

  // The question only makes sense for days that are still open. If you're
  // already in for the take day, that one is settled — the only thing left to
  // decide is the RETURN day, and "take gear only" would be false anyway (you'd
  // still be playing the day you signed up for).
  const returnDay = formatWeekday(returnDate);
  const question = alreadyIn
    ? `You’re already in for ${formatWeekday(takeDate)}. Playing ${returnDay} too?`
    : 'Are you playing both days?';
  const playLabel = alreadyIn ? `Take & play ${returnDay}` : 'Take & play both days';
  const skipLabel = alreadyIn ? 'Just bringing it back' : 'Take gear only';
  const take = (playing) => { onTake?.(taking, returnDate, playing); close(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
      <p className="type-body-regular" style={{ color: 'var(--color-dark-gray)' }}>{heading}</p>

      {failed ? (
        // Section-level: the gear ledger failing shouldn't take the roster with
        // it, so this fills the strip and leaves the rest of the page alone.
        <CouldNotLoad what="gear" offline={errorParam === 'offline' ? true : undefined} />
      ) : loading ? (
        // Deliberately not the real tiles with empty slots: an unloaded tile and
        // an unclaimed one look identical, so showing "+" here would invite
        // someone to take a set that is already gone.
        <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
          <GearSkeleton tiles={TILES.length} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
          {assigned.map(({ key, type, icon, takenBy, locked, warning }) => (
            <GearTile
              key={key}
              icon={icon}
              label={gearLabel(type)}
              takenBy={takenBy}
              locked={locked}
              warning={warning}
              onAdd={() => setTaking(type)}
              onOpenTaken={() => setViewing(takenBy)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!taking}
        headline={taking ? `Take ${gearLabel(taking)} ${gearIcon(taking)}` : ''}
        content={taking ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <p className="type-body-regular-tall" style={{ margin: 0 }}>
              You’ll take them home after{' '}
              <strong style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatWeekday(takeDate)}</strong>’s
              game and bring them back on{' '}
              <strong style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatGameDate(returnDate)}</strong>.
            </p>

            {/* Only rendered when there is a real choice. Sits with the sentence
                it changes, before the question the buttons answer. The chosen day
                is already stated in full above, so these stay terse. */}
            {returnOptions.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <span className="type-caption-semibold" style={{ color: 'var(--color-dark-gray-50)' }}>
                  Bring back on
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {returnOptions.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="rd-chip type-small-semibold"
                      aria-pressed={d === returnDate}
                      onClick={() => setPickedDate(d)}
                    >
                      {formatChipDate(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="type-body-regular-tall" style={{ margin: 0 }}>
              {question}
            </p>
          </div>
        ) : null}
        confirmLabel={playLabel}
        onConfirm={() => take(true)}
        secondaryLabel={skipLabel}
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
