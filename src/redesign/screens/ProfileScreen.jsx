// Profile — settings + (for admins) the admin-panel entry, per the agreed nav.
// Reads the current user through the mock identity seam.

import Scaffold from '../components/Scaffold';
import Avatar from '../components/Avatar';
import { useCurrentUser } from '../identity/useCurrentUser';

export default function ProfileScreen() {
  const user = useCurrentUser();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px 0' }}>
        <Avatar user={user} size={56} title={user.displayName} />
        <div>
          <div className="type-heading-h2">{user.displayName}</div>
          <div className="type-small-regular" style={{ color: 'var(--color-dark-gray-50)' }}>
            {user.phone}{user.isAdmin ? ' · Admin' : ''}
          </div>
        </div>
      </div>
      <Scaffold
        title="Profile & settings"
        blurb="Identity comes from the mock seam (useCurrentUser) for now."
        planned={[
          'Edit name & profile photo',
          'Phone number (verified)',
          'My gear commitments (+ cancel)',
          user.isAdmin ? '⚙️ Admin panel (admins only) — roll call, players, suspensions, gear' : 'Suspension status',
          'Log out',
        ]}
      />
    </>
  );
}
