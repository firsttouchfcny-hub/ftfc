// Admin tools — reached from "Admin tools" on an admin's profile.
//
// This renders the REAL AdminPanel component from the production app, so the
// settings, layout and mechanisms are exactly what admins use today. Per the
// design direction, nothing about that panel is redesigned here — the only
// addition is the redesign's back navigation (handled by TopNav).
//
// It runs on mock actions, so clicking through is safe and works on the preview
// deploy, which has no Firebase. Swapping to live data is a one-line change in
// this file — see utils/adminActions.js.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminPanel from '../../components/AdminPanel';
import { createMockAdminActions } from '../state/mockAdminActions';
import { mockPlayers, mockGameDate } from '../state/mockRoster';
import { useCurrentUser } from '../identity/useCurrentUser';

export default function AdminToolsScreen() {
  const user = useCurrentUser();
  const [players, setPlayers] = useState(mockPlayers);
  const [session, setSession] = useState({
    date: mockGameDate, isOpen: true, override: null, drops: [],
  });

  const actions = useMemo(
    () => createMockAdminActions({
      getPlayers: () => players,
      setPlayers,
      setSession,
      adminName: user.displayName,
    }),
    // Built once: the mock closes over the setters, which are stable, and
    // getPlayers is read lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The profile only offers this to admins, but the route is reachable by URL —
  // so it guards itself. Harmless today on mock actions; essential before this
  // is ever pointed at the real store.
  if (!user.isAdmin) return <Navigate to="/profile" replace />;

  return (
    // The panel carries the production app's own styling, so it sits in a plain
    // container rather than the redesign's Light Olive column.
    <div style={{ padding: '0 16px 40px' }}>
      <AdminPanel session={session} players={players} actions={actions} />
    </div>
  );
}
