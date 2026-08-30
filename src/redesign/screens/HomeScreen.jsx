// Home / roll-call screen — picks the variant for the current window:
//   · waiting (regular user, before 3pm) — countdown + take-gear
//   · closed  (Fri 10am–Sun, roll call opens on a LATER day) — same screen,
//             but the badge names the day instead of counting down
//   · open    (everyone 3pm+, admins from 10am) — I'm in / +1
//   · suspended — no actions, just the strike message
//
// And, before any of those, the wait. Which variant to show depends on the
// SESSION, not only the clock: production's `isRollCallOpen(session)` lets an
// admin force roll call open or closed. So until that arrives we genuinely do
// not know whether this screen is a countdown or a pair of sign-up buttons —
// which is why this one wait gets a spinner instead of a skeleton. Drawing
// either shape would be a guess the player then watches get corrected, and
// showing "opens in 4 hours" over an already-open roll call could cost someone
// their spot.
//
// If it never arrives we say so rather than guessing. Production waits 5s and
// then assumes closed, presenting that as fact — the same lie the couldn't-load
// state exists to remove.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CouldNotLoad from '../components/CouldNotLoad';
import Spinner from '../components/Spinner';
import HomeWaiting from './home/HomeWaiting';
import HomeOpen from './home/HomeOpen';
import HomeSuspended from './home/HomeSuspended';
import { useRollCallWindow } from '../state/useRollCallWindow';
import { useSecondTick } from '../state/useSecondTick';

// How long to wait before admitting it isn't coming. Production uses 5s for the
// same document; past that a spinner is no longer informative.
const GIVE_UP_MS = 5000;

export default function HomeScreen() {
  useSecondTick();                 // keep the countdown + 3pm transition live
  const [params] = useSearchParams();
  // `?loading=1` holds the wait open for review. With mock data the session is
  // already here, so there is nothing to wait for otherwise.
  const waiting = params.get('loading') === '1';
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!waiting) return undefined;
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [waiting]);

  const phase = useRollCallWindow();

  if (waiting) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '96px 24px' }}>
        {gaveUp ? <CouldNotLoad what="the game" variant="page" /> : <Spinner size={32} label="Loading the game" />}
      </div>
    );
  }

  if (phase === 'suspended') return <HomeSuspended />;
  if (phase === 'open') return <HomeOpen />;
  // 'waiting' and 'closed' are one screen; the window decides which badge.
  return <HomeWaiting opensLater={phase === 'closed'} />;
}
