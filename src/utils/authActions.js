// ─────────────────────────────────────────────────────────────────────────────
// Phone-verification actions — the seam between the account flow and its
// backing auth provider.
//
// Third seam in the same family as adminActions.js and gearActions.js, and it
// exists for the same reason: Firebase Auth can't run on the preview deploy, so
// the redesign's account screens would be unreviewable without it.
//
//   · production   → createFirebaseAuthActions()  (this file)
//   · the redesign → a mock, so the whole flow can be clicked through offline
//
// Unlike the other two seams this is NOT an extraction from a production
// component. `components/PhoneVerify.jsx` still owns the live flow and is
// untouched — the redesign REPLACES that component rather than reusing it, so
// refactoring the app's identity gate to share code with a screen that will
// delete it would be risk with no payoff. The logic below deliberately mirrors
// PhoneVerify's onboarding branch; when the redesign merges, PhoneVerify goes
// and this becomes the only copy.
//
// Two things make this seam shaped differently from its siblings:
//   1. It is STATEFUL across calls. `signInWithPhoneNumber` hands back a
//      confirmation handle that `confirmCode` needs, so the factory holds it —
//      which is also why one factory instance serves exactly one attempt.
//   2. reCAPTCHA needs a real DOM node, so the caller supplies its id.
// ─────────────────────────────────────────────────────────────────────────────

import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { findAccountByPhone } from './identity';
import { toE164US } from './helpers';

// Firebase error codes → something a player can act on. Anything unmapped keeps
// its code in the message, because a bug report with a code beats one without.
function friendlySendError(err) {
  switch (err.code) {
    case 'auth/invalid-phone-number': return 'That phone number is invalid.';
    case 'auth/too-many-requests':    return 'Too many attempts. Try again later.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled in Firebase. Enable it in the console.';
    default: return `Could not send the code. Try again. [${err.code}]`;
  }
}

export function createFirebaseAuthActions({ recaptchaContainerId } = {}) {
  let confirmation = null;   // the handle from signInWithPhoneNumber
  let recaptcha = null;
  let sentTo = null;         // E.164 of the number we actually texted

  const clearRecaptcha = () => {
    if (!recaptcha) return;
    try { recaptcha.clear(); } catch { /* noop */ }
    recaptcha = null;
  };

  return {
    // Send an SMS code. Throws an Error whose message is safe to show.
    async sendCode(rawPhone) {
      const e164 = toE164US(rawPhone);
      if (!e164) throw new Error('Enter a 10-digit US phone number.');
      try {
        if (!recaptcha) {
          recaptcha = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
        }
        confirmation = await signInWithPhoneNumber(auth, e164, recaptcha);
        sentTo = e164;
        return { e164 };
      } catch (err) {
        console.error('[FTFC] signInWithPhoneNumber failed:', err);
        clearRecaptcha();
        throw new Error(friendlySendError(err));
      }
    },

    // Confirm the 6-digit code. Resolves to the verified number plus the account
    // that already owns it, or `account: null` when the number is new to us —
    // which is what decides whether the flow asks for a name or is already done.
    async confirmCode(code) {
      if (!/^\d{6}$/.test(code)) throw new Error('Code is 6 digits.');
      if (!confirmation) throw new Error('Verification expired. Start over.');
      try {
        await confirmation.confirm(code);
      } catch (err) {
        console.error('[FTFC] code confirmation failed:', err);
        throw new Error(err.code === 'auth/code-expired'
          ? 'That code expired. Send a new one.'
          : "That code isn't right. Check it and try again.");
      }
      const owner = await findAccountByPhone(sentTo);
      // Firebase Auth was only ever used to PROVE ownership of the number —
      // the app's own identity is uid-keyed, so drop the auth session.
      try { await signOut(auth); } catch { /* noop */ }
      return {
        e164: sentTo,
        account: owner ? { uid: owner.uid, name: owner.name } : null,
      };
    },

    // Abandon an in-flight attempt (leaving the screen, or starting over).
    reset() {
      confirmation = null;
      sentTo = null;
      clearRecaptcha();
    },
  };
}
