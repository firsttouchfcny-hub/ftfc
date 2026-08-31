// ─────────────────────────────────────────────────────────────────────────────
// Mock identity seam.
//
// Screens read the current user ONLY through this hook, and write through
// `updateCurrentUser`. Today it is a small in-memory store so the prototype can
// actually be used — editing your name or photo updates the nav, the roster and
// the profile together. When the team's identity model is wired (uid-keyed,
// phone-first — already on main), the real account swaps in HERE and the screens
// don't change.
//
// In-memory means per-visit: a reload resets it, exactly like the roster mock.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';
import sampleAvatar from '../assets/sample-avatar-lg.jpg';

let user = {
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

const listeners = new Set();

export function useCurrentUser() {
  return useSyncExternalStore(
    (onChange) => { listeners.add(onChange); return () => listeners.delete(onChange); },
    () => user,
  );
}

// Apply a partial update and notify every subscribed screen. `displayName` is
// derived, never passed in, so it can't drift from the name parts.
export function updateCurrentUser(patch) {
  const next = { ...user, ...patch };
  next.displayName = `${next.firstName || ''} ${next.lastName || ''}`.trim();
  user = next;
  listeners.forEach((l) => l());
}
