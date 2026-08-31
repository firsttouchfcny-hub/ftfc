// Which roll-call window the home screen shows, from the real Eastern-time phase
// (reused from src/utils/helpers.js) + admin status:
//   · regular user → 'open' at 3pm+, else 'waiting'
//   · admin        → 'open' from 10am (admins-only window), else 'waiting'
//
// 'waiting' and 'closed' are the same screen with different badges: 'waiting'
// counts down to a 3 PM that arrives today, 'closed' names the day when it
// doesn't. Splitting them here rather than inside the screen keeps one place
// that decides which window we're in — and lets ?state= preview either.
//
// A `?state=waiting|open` query param still overrides it, for previews.

import { useSearchParams } from 'react-router-dom';
import { getRollCallPhase, isSuspended } from '../../utils/helpers';
import { rollCallOpensToday } from './rollCall';
import { useCurrentUser } from '../identity/useCurrentUser';

export function useRollCallWindow() {
  const user = useCurrentUser();
  const [params] = useSearchParams();

  const override = params.get('state');
  if (['open', 'waiting', 'closed', 'suspended'].includes(override)) return override;

  // A suspension overrides the time windows — no sign-up or gear while suspended.
  if (isSuspended(user.suspendedUntil)) return 'suspended';

  const phase = getRollCallPhase(); // 'closed' | 'admins-only' | 'open'
  if (phase === 'open') return 'open';
  if (phase === 'admins-only' && user.isAdmin) return 'open';
  // From Friday's 10 AM reset until Sunday, roll call opens on a LATER day, so
  // a countdown would sit above 40 hours for two days.
  return rollCallOpensToday() ? 'waiting' : 'closed';
}
