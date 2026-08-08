// Which roll-call window the home screen shows, from the real Eastern-time phase
// (reused from src/utils/helpers.js) + admin status:
//   · regular user → 'open' at 3pm+, else 'waiting'
//   · admin        → 'open' from 10am (admins-only window), else 'waiting'
//
// A `?state=waiting|open` query param still overrides it, for previews.

import { useSearchParams } from 'react-router-dom';
import { getRollCallPhase, isSuspended } from '../../utils/helpers';
import { useCurrentUser } from '../identity/useCurrentUser';

export function useRollCallWindow() {
  const user = useCurrentUser();
  const [params] = useSearchParams();

  const override = params.get('state');
  if (override === 'open' || override === 'waiting' || override === 'suspended') return override;

  // A suspension overrides the time windows — no sign-up or gear while suspended.
  if (isSuspended(user.suspendedUntil)) return 'suspended';

  const phase = getRollCallPhase(); // 'closed' | 'admins-only' | 'open'
  if (phase === 'open') return 'open';
  if (phase === 'admins-only' && user.isAdmin) return 'open';
  return 'waiting';
}
