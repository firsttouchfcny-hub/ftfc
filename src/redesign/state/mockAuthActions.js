// Mock implementation of the phone-verification seam (see utils/authActions.js).
//
// Same operations as the Firebase version, backed by nothing — so the whole
// account flow can be clicked through on the preview deploy, which has no
// Firebase, and without spending real SMS.
//
// The magic values below exist so every designed state is reachable from the
// browser. They are the mock's whole reason for being: an error state you
// cannot summon is an error state nobody reviews.

import { toE164US } from '../../utils/helpers';

// The code the mock accepts. Anything else is "wrong code".
export const MOCK_CODE = '123456';

// Numbers that force a particular outcome, so each state has a way in.
const SEND_FAILS   = '+15550000000'; // sendCode throws
const CODE_EXPIRES = '+15550000001'; // confirmCode always reports an expired code
// Numbers that already belong to somebody — the returning-player path, where
// the flow adopts the existing account instead of starting a second one.
// The one-word entry is not a curiosity: real players on the current roster are
// stored as "Elle" and "Shimon", and the redesign requires a last name, so that
// account has to be completed before they can continue. Keeping it here is what
// makes that path clickable instead of theoretical.
const KNOWN_ACCOUNTS = {
  '+15555550100': { uid: 'mock-uid-001',  name: 'Cristian Lugo' },
  '+15555550188': { uid: 'mock-uid-elle', name: 'Elle' },
};

// A beat of latency, so the button's busy state is visible rather than theoretical.
const settle = (ms = 450) => new Promise((r) => setTimeout(r, ms));

export function createMockAuthActions() {
  let sentTo = null;

  return {
    async sendCode(rawPhone) {
      const e164 = toE164US(rawPhone);
      // Same guard, same words as the real one — this message is the design.
      if (!e164) throw new Error('Enter a 10-digit US phone number.');
      await settle();
      if (e164 === SEND_FAILS) {
        throw new Error('Could not send the code. Try again. [auth/quota-exceeded]');
      }
      sentTo = e164;
      return { e164 };
    },

    async confirmCode(code) {
      if (!/^\d{6}$/.test(code)) throw new Error('Code is 6 digits.');
      if (!sentTo) throw new Error('Verification expired. Start over.');
      await settle();
      if (sentTo === CODE_EXPIRES) throw new Error('That code expired. Send a new one.');
      if (code !== MOCK_CODE) throw new Error("That code isn't right. Check it and try again.");
      return {
        e164: sentTo,
        account: KNOWN_ACCOUNTS[sentTo] ? { ...KNOWN_ACCOUNTS[sentTo] } : null,
      };
    },

    reset() { sentTo = null; },
  };
}
