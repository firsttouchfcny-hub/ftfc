// Home / roll-call screen — picks the variant for the current window:
//   · waiting (regular user, before 3pm) — countdown + take-gear   ← built
//   · open    (everyone 3pm+, admins from 10am) — I'm in / +1       ← built
// The window comes from useRollCallWindow (a ?state= preview override for now;
// real Eastern-time + admin logic wires in there later).

import HomeWaiting from './home/HomeWaiting';
import HomeOpen from './home/HomeOpen';
import HomeSuspended from './home/HomeSuspended';
import { useRollCallWindow } from '../state/useRollCallWindow';
import { useSecondTick } from '../state/useSecondTick';

export default function HomeScreen() {
  useSecondTick();                 // keep the countdown + 3pm transition live
  const phase = useRollCallWindow();
  if (phase === 'suspended') return <HomeSuspended />;
  return phase === 'open' ? <HomeOpen /> : <HomeWaiting />;
}
