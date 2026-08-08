// Home — suspended variant. A suspended user can't sign up or take gear, so the
// screen shows the game details + a strike message instead of any actions.
// Built from Figma node 2934:3005.

import GameHeader from '../../components/GameHeader';
import StatusBadge from '../../components/StatusBadge';
import { useCurrentUser } from '../../identity/useCurrentUser';
import { formatDateNoYear } from '../../state/rollCall';

// Sample end date for the ?state=suspended preview (computed once at load, not
// during render). Real suspensions use user.suspendedUntil.
const PREVIEW_UNTIL = Date.now() + 7 * 24 * 60 * 60 * 1000;

export default function HomeSuspended() {
  const user = useCurrentUser();
  const until = user.suspendedUntil ?? PREVIEW_UNTIL;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '64px 24px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <GameHeader />
        <StatusBadge width={268}>
          You have an active strike. Sign up again on {formatDateNoYear(until)}.
        </StatusBadge>
      </div>
    </div>
  );
}
