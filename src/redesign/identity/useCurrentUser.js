// ─────────────────────────────────────────────────────────────────────────────
// Mock identity seam.
//
// Screens read the current user ONLY through this hook. Today it returns a fixed
// mock account so the redesign can be built and clicked through without the real
// backend. When the team approves the identity model (see
// docs/data-model-proposal.md), the real phone-auth account swaps in HERE — the
// screens don't change.
// ─────────────────────────────────────────────────────────────────────────────

import sampleAvatar from '../assets/sample-avatar-lg.jpg';

const MOCK_USER = {
  uid: 'mock-uid-001',
  phone: '+15555550100',
  firstName: 'Cristian',
  lastName: 'Lugo',
  displayName: 'Cristian Lugo',
  // A photo by default, so the nav avatar, the roster's "you" row and the
  // profile all show the same person. The initials fallback (photoURL: null)
  // is previewable on the profile with `?photo=none`.
  photoURL: sampleAvatar,
  isAdmin: true,
  suspendedUntil: null, // ms timestamp when a suspension ends, or null if not suspended
};

export function useCurrentUser() {
  return MOCK_USER;
}
