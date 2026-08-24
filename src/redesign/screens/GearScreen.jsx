// Gear details — reached from the top-left Gear button.
//
// This renders the REAL GearManager component from the production app, so the
// coverage alerts, the bringing-gear day cards, the set tracker, the schedule
// and the admin tools are exactly what the club uses today. Per the design
// direction, nothing about that panel is redesigned here — the only addition is
// the redesign's back navigation (handled by TopNav).
//
// One thing IS dropped: `showTake={false}` hides the "🎒 Gear for {date}" block
// (the take buttons, your commitment, and its Cancel). Choosing a set moved onto
// the gear tiles of the home and game screens, so leaving it here too would be
// two doors to the same room — and the redesigned dialog is the one we want
// players to meet.
//
// It runs on mock actions, so clicking through is safe and works on the preview
// deploy, which has no Firebase. Swapping to live data is a one-line change in
// this file — see utils/gearActions.js.

import { useMemo } from 'react';
import GearManager from '../../components/GearManager';
import { createMockGearActions } from '../state/mockGearActions';
import { useCurrentUser } from '../identity/useCurrentUser';

export default function GearScreen() {
  const user = useCurrentUser();

  // Memoised for the same reason production is: GearManager keys its ledger
  // subscription on this object, so a new one per render would resubscribe on
  // every frame — and with it, reset the panel's state.
  const actions = useMemo(
    () => createMockGearActions({
      playerName: user.displayName,
      adminName: user.displayName,
    }),
    // Built once. Renaming yourself mid-session would otherwise re-seed the
    // ledger and throw away anything you'd done to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    // The panel carries the production app's own styling, so it sits in a plain
    // container rather than the redesign's Light Olive column.
    <div style={{ padding: '0 16px 40px' }}>
      <GearManager
        playerName={user.displayName}
        deviceId={null}
        uid={user.uid}
        amAdmin={user.isAdmin}
        suspended={false}
        namesByUid={{}}
        actions={actions}
        showTake={false}
      />
    </div>
  );
}
