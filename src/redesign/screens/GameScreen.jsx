// "You're in" — post-sign-up game screen. Built from Figma node 2730:10542.
// Top built: the confirmation header + the gear-takers section. The Match 1/2/
// Bench table is intentionally not built yet (next).

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomActions from '../components/BottomActions';
import Confirmation from '../components/Confirmation';
import Dialog from '../components/Dialog';
import DropsCard from '../components/DropsCard';
import GearTakers from '../components/GearTakers';
import RosterSection from '../components/RosterSection';
import TableCard from '../components/TableCard';
import { RosterSkeleton } from '../components/Skeleton';
import CouldNotLoad from '../components/CouldNotLoad';
import {
  MATCH1_MAX, MATCH2_MAX, MATCH2_MIN_CONFIRM,
  buildFlatList, getMatch2State, isSamePerson,
} from '../../utils/helpers';
import { gearIcon, gearLabel, myCommitments } from '../../utils/gear';
import {
  mockPlayers, mockGearRoles, mockGearPriorityNames, mockCommitments, mockGameDate, mockDrops,
} from '../state/mockRoster';
import { useCurrentUser } from '../identity/useCurrentUser';
import { isPastDropDeadline, formatFullGameDate } from '../state/rollCall';
import alertIcon from '../assets/icons/alert.svg';
import noGameIcon from '../assets/icons/no-game.svg';
import warningIcon from '../assets/icons/warning.svg';

// "1st", "2nd", "3rd", "4th"… for the bench standing headline.
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const nameKey = (n) => (n || '').toLowerCase().trim();

// Map one flat entry onto PlayerRow's props. Guests repeat their host's avatar
// and name (the "+1" badge carries the distinction), so we look the host up by
// parentId rather than using buildFlatList's generated "Name +1" string.
function toRow(entry, index, byId, me) {
  const host = entry.isMainEntry ? entry : byId.get(entry.parentId);
  const role = entry.isMainEntry ? mockGearRoles[nameKey(entry.name)] : null;
  const hasGear = !!(role && (role.bring.length || role.take.length));

  // Rows store the name captured at signup, but production resolves display
  // names by uid at render so a rename propagates everywhere. Only the current
  // user carries a uid in this mock, so resolving theirs is the whole job here.
  const isSelf = !!host?.uid && host.uid === me.uid;

  return {
    id: entry.id,
    position: String(index + 1).padStart(2, '0'),
    name: isSelf ? me.displayName : (host?.name ?? entry.name),
    photoURL: isSelf ? me.photoURL : (host?.photoURL ?? null),
    admin: !!entry.isAdmin,
    // Only bringers get a row badge; takers are shown in the gear-takers strip.
    bringing: role?.bring.length ? gearIcon(role.bring[0]) : null,
    // Same suppression as production: hidden when the player already reads as a
    // gear bringer/taker or an admin.
    gearPriority: entry.isMainEntry && !hasGear && !entry.isAdmin
      && mockGearPriorityNames.has(nameKey(entry.name)),
    plusOne: !entry.isMainEntry,
    // Matched with production's isSamePerson (uid first, name as the fallback
    // for rows without one), so renaming yourself doesn't lose the highlight.
    // Never a guest row — it repeats the host's name by design.
    isYou: entry.isMainEntry && isSamePerson(entry, { uid: me.uid, name: me.displayName }),
  };
}

export default function GameScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const youName = user.displayName;
  // One matcher for "is this row me?", mirroring production: uid wins, name is
  // the fallback for rows created before an account was resolved.
  const isMe = (p) => isSamePerson(p, { uid: user.uid, name: youName });
  const preview = params.get('match2'); // 'onhold' | 'cancelled' | null
  // `?loading=1` previews the pre-data state — roster and gear together.
  const loading = params.get('loading') === '1';
  // `?error=1` / `?error=offline` fail the whole screen; `?error=gear` fails
  // only the gear strip and is handled inside GearTakers.
  const errorParam = params.get('error');
  const failed = errorParam === '1' || errorParam === 'offline';

  // The signup list is local state so "Out" and "Add a +1" actually mutate the
  // roster and it re-sorts live. Swapping this for the Firestore session is the
  // same seam as the read path.
  const [players, setPlayers] = useState(mockPlayers);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // The roster, built by the real production logic: buildFlatList applies the
  // tiering (bringers → takers → admins/pinned → Friday gear priority → rest,
  // then signup time) and expands each player's +1s into their own entries.
  const rosterEntries = useMemo(
    () => buildFlatList(players, {
      gearRoles: mockGearRoles,
      gearPriorityNames: mockGearPriorityNames,
    }),
    [players],
  );

  // A shorter roster for the on-hold / cancelled previews (24 signups, so Match 2
  // sits under the 30 needed to confirm).
  const short = preview === 'onhold' || preview === 'cancelled';
  const entries = short ? rosterEntries.slice(0, MATCH1_MAX + 6) : rosterEntries;
  const total = entries.length;
  const needed = Math.max(0, MATCH2_MIN_CONFIRM - total);

  // Same slicing as production: 18 / 18 / overflow.
  const match1 = entries.slice(0, MATCH1_MAX).map((e, i) => toRow(e, i, byId, user));
  const match2 = entries.slice(MATCH1_MAX, MATCH2_MAX).map((e, i) => toRow(e, MATCH1_MAX + i, byId, user));
  const bench = entries.slice(MATCH2_MAX).map((e, i) => toRow(e, MATCH2_MAX + i, byId, user));

  // Actions. Capped at one guest, since the row badge reads a literal "+1" —
  // production allows up to 20, but nothing in this design renders a second.
  const me = players.find(isMe);
  const hasPlusOne = (me?.plusOnes ?? 0) > 0;

  // `plusOnesAt` records WHEN the guest was added. buildFlatList reads it: a +1
  // taken at signup renders right after its host, but one added later (like this)
  // falls into line by add-time in the rest tier — a late +1 takes a back-of-line
  // spot rather than jumping to the host's position.
  const handleAddPlusOne = () => {
    const at = Date.now();
    setPlayers((ps) => ps.map((p) => (
      isMe(p) ? { ...p, plusOnes: 1, plusOnesAt: [at] } : p
    )));
  };

  // Removing drops the guest and nothing else — your own row keeps its signup
  // time, so your position in the line is unchanged. Mirrors production's
  // handleSetMyPlusOnes(0), which updates the roster doc in place.
  const handleRemovePlusOne = () => {
    setPlayers((ps) => ps.map((p) => (
      isMe(p) ? { ...p, plusOnes: 0, plusOnesAt: [] } : p
    )));
  };

  // You can't drop while holding gear — dropping would strand the set. Same rule
  // as production (App.jsx): bring it back on game day, or an admin reassigns it.
  //
  // deviceId is passed as null on purpose: this identity seam is uid/name-based,
  // and myCommitments matches `c.takerDeviceId === deviceId` — so passing
  // undefined would match every commitment that also lacks one.
  const myGear = myCommitments(mockCommitments, null, youName, user.uid, mockGameDate);
  // "Goals 🥅", or "Goals 🥅 & Bibs 🧺" when holding more than one set.
  const holdingLabel = myGear.map((g) => `${gearLabel(g.type)} ${gearIcon(g.type)}`).join(' & ');
  // The demo user is a gear bringer, so the drop is always blocked. `?gear=none`
  // previews the ordinary path where you're free to leave.
  const holdingGear = params.get('gear') === 'none' ? false : myGear.length > 0;

  // Dropping after the 9 PM deadline earns a strike, so it gets a sterner
  // confirm. `?deadline=passed` previews it outside those hours.
  const lateDrop = params.get('deadline') === 'passed' || isPastDropDeadline();

  // Derived from the mock so the header can't drift from the date the gear
  // dialog quotes — they were previously set by hand and disagreed.
  const gameDateLabel = formatFullGameDate(mockGameDate);

  // Which dialog is open: null | 'confirm-out' | 'holding-gear'. The take-gear
  // dialog belongs to GearTakers, since its tiles are what open it.
  const [dialog, setDialog] = useState(null);

  // Tapping Out either explains why you can't drop, or asks you to confirm.
  const handleOut = () => setDialog(holdingGear ? 'holding-gear' : 'confirm-out');

  // Leaving drops you from the list, so the "You're in" screen no longer applies
  // — back to roll call.
  const confirmOut = () => {
    setDialog(null);
    setPlayers((ps) => ps.filter((p) => !isMe(p)));
    navigate('/');
  };

  // Match 2 state: 'confirmed' (30+), 'on-hold' (short, before 9pm), or 'off'
  // (short, past the 9pm ET cutoff). Real logic via getMatch2State; the preview
  // param forces on-hold / cancelled (which is time-gated otherwise).
  const match2State =
    preview === 'onhold' ? 'on-hold'
    : preview === 'cancelled' ? 'off'
    : getMatch2State(total);
  const onHold = match2State === 'on-hold';
  const cancelled = match2State === 'off';

  // Current user's standing headline. `?standing=bench` previews the bench spot;
  // the position is dynamic — it comes from the user's real place in the line.
  const benchPosition = 2; // mock — real value comes from the user's spot in line
  let headline = 'You’re in';
  let badge;
  if (params.get('standing') === 'bench') {
    headline = `You are ${ordinal(benchPosition)} in bench`;
  } else if (cancelled) {
    headline = 'No game — match 2 cancelled';
  } else if (onHold) {
    headline = 'In match 2 waitlist';
    badge = `${needed} more players needed for 2nd match`;
  }

  // Without the roster we know nothing about this screen — not your standing,
  // not whether you're even on the list. Showing the frame around an apology
  // would be dressing up a page that has no content, so the failure takes the
  // whole screen rather than appearing twice inside it.
  if (failed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px 120px', width: '100%' }}>
        <CouldNotLoad
          what="the game"
          variant="page"
          offline={errorParam === 'offline' ? true : undefined}
        />
      </div>
    );
  }

  return (
    // Bottom padding clears the floating action bar (56px pill + 32px offset).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '8px 16px 120px' }}>
      <Confirmation headline={headline} badge={badge} date={gameDateLabel} loading={loading} />
      {/* No headline passed: GearTakers names the take day itself, relative to
          now, so the heading can't disagree with the dates below it.
          `alreadyIn` comes from the roster, not from the fact that this is the
          post-signup screen — see GearTakers. */}
      <GearTakers alreadyIn={players.some(isMe)} />

      {/* Roster: the two matches share one card; the bench is its own card. */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TableCard>
          {loading ? <RosterSkeleton rows={6} label="Match 1" /> : (
          <>
          <RosterSection label="Match 1" players={match1} />
          <div style={{ height: 1, background: 'var(--color-light-olive)', margin: '0 9px' }} />
          <RosterSection
            label={cancelled ? 'Match 2 — NO GAME' : onHold ? 'Match 2 on hold' : 'Match 2'}
            subtitle={
              cancelled ? "We didn't reach enough players"
              : onHold ? `${needed} more players needed for a second match.`
              : undefined
            }
            icon={cancelled ? noGameIcon : onHold ? alertIcon : undefined}
            dimmed={onHold || cancelled}
            players={match2}
          />
          </>
          )}
        </TableCard>

        {/* Bench and drops wait too — half a loaded screen reads as a bug, not
            as progress. */}
        {!loading && bench.length > 0 && (
          <TableCard>
            <RosterSection label="Bench" players={bench} />
          </TableCard>
        )}

        {/* Drops sit last — below the bench when there is one, else below Match 2 */}
        {!loading && <DropsCard drops={mockDrops} />}
      </div>

      {/* Not rendered until the roster has landed: both actions assume you're
          on it, and "Out" tapped before we know that would act on a spot we
          can't yet confirm exists. It fades in when it arrives. */}
      {!loading && (
        <BottomActions
          onAddPlusOne={handleAddPlusOne}
          onRemovePlusOne={handleRemovePlusOne}
          hasPlusOne={hasPlusOne}
          onOut={handleOut}
        />
      )}

      {/* Dropping out. Past the 9 PM deadline it costs a strike, so the copy is
          sterner (Figma 3159:9446); before that it's the ordinary confirm
          (3050:5354 / 3155:9414). */}
      <Dialog
        open={dialog === 'confirm-out'}
        headline={lateDrop
          ? 'Are you sure? If you drop, you’ll receive a strike.'
          : 'Are you sure?'}
        body={lateDrop
          ? 'Dropping out after the 9 PM deadline will result in a strike. You’ll lose your current spot, and will not be allowed to sign up again.'
          : 'If you drop out you will lose your current spot and signing up again might not guarantee a spot'}
        cancelLabel="Cancel"
        onCancel={() => setDialog(null)}
        confirmLabel="Yes, I’m out"
        onConfirm={confirmOut}
      />


      {/* Holding gear blocks the drop entirely, so there is nothing to decline —
          the icon-only, single-primary-button variant (Figma 3159:9425). */}
      <Dialog
        open={dialog === 'holding-gear'}
        icon={warningIcon}
        body={
          <>
            <strong style={{ fontWeight: 'var(--font-weight-bold)' }}>
              You’re holding {holdingLabel}
            </strong>
            {' — you can’t drop while you have gear. Ask an admin to reassign it '}
            {'to another player and then come back to drop out.'}
          </>
        }
        confirmLabel="Got it"
        onConfirm={() => setDialog(null)}
      />
    </div>
  );
}
