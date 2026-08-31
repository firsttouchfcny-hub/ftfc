// State for the account-creation flow.
//
// The five steps are separate ROUTES rather than one component with a `step`
// variable, so any single screen can be opened directly — which is how these
// get reviewed. That means the few things the steps share (the number we texted,
// the name typed two screens ago) have to live outside the components, so this
// is a small module store, exactly like the identity seam next to it.
//
// In-memory means per-visit: a reload resets the flow.

import { useSyncExternalStore } from 'react';
import { createMockAuthActions } from './mockAuthActions';

const EMPTY = {
  rawPhone: '',    // what the player typed, kept so "Try again" can resend
  e164: null,      // the number we actually texted, once verified
  firstName: '',
  lastName: '',
  photoURL: null,  // null = they skipped, and initials stand in
};

let state = { ...EMPTY };
const listeners = new Set();

// One verification attempt per flow. Swapping this line for
// createFirebaseAuthActions({ recaptchaContainerId }) is the whole of Phase 5
// for this surface.
export const authActions = createMockAuthActions();

export function useJoinFlow() {
  return useSyncExternalStore(
    (onChange) => { listeners.add(onChange); return () => listeners.delete(onChange); },
    () => state,
  );
}

export function updateJoinFlow(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetJoinFlow() {
  state = { ...EMPTY };
  authActions.reset();
  listeners.forEach((l) => l());
}
