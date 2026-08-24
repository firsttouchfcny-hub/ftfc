// Guards the phone-verification seam.
//
// Same contract test as the admin and gear seams: the account screens can only
// run against either provider while both expose the SAME operations. Firebase is
// mocked so this never needs credentials, a network, or a real SMS.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: vi.fn(), signInWithPhoneNumber: vi.fn(), signOut: vi.fn(),
}));
vi.mock('./identity', () => ({ findAccountByPhone: vi.fn() }));

const { createFirebaseAuthActions } = await import('./authActions');
const { createMockAuthActions, MOCK_CODE } = await import('../redesign/state/mockAuthActions');

describe('auth actions seam', () => {
  it('both implementations expose the same operations', () => {
    const real = createFirebaseAuthActions({ recaptchaContainerId: 'x' });
    const mock = createMockAuthActions();
    expect(Object.keys(mock).sort()).toEqual(Object.keys(real).sort());
  });

  it('every operation is callable on both', () => {
    const real = createFirebaseAuthActions({ recaptchaContainerId: 'x' });
    const mock = createMockAuthActions();
    for (const key of Object.keys(real)) {
      expect(typeof real[key], `real.${key}`).toBe('function');
      expect(typeof mock[key], `mock.${key}`).toBe('function');
    }
  });

  // Both reject a bad number with the SAME words, because that string is the
  // designed error message, not an implementation detail.
  it('both reject a non-US number identically', async () => {
    const real = createFirebaseAuthActions({ recaptchaContainerId: 'x' });
    const mock = createMockAuthActions();
    const msg = 'Enter a 10-digit US phone number.';
    await expect(real.sendCode('123')).rejects.toThrow(msg);
    await expect(mock.sendCode('123')).rejects.toThrow(msg);
  });
});

describe('mock auth actions', () => {
  it('confirming before sending is refused', async () => {
    const mock = createMockAuthActions();
    await expect(mock.confirmCode(MOCK_CODE)).rejects.toThrow('Verification expired. Start over.');
  });

  it('a new number verifies with no account to adopt', async () => {
    const mock = createMockAuthActions();
    await mock.sendCode('7185551234');
    const res = await mock.confirmCode(MOCK_CODE);
    expect(res).toEqual({ e164: '+17185551234', account: null });
  });

  it('a known number returns the account it already belongs to', async () => {
    const mock = createMockAuthActions();
    await mock.sendCode('5555550100');
    const { account } = await mock.confirmCode(MOCK_CODE);
    // This is the fork that keeps a returning player from forking their identity.
    expect(account).toEqual({ uid: 'mock-uid-001', name: 'Cristian Lugo' });
  });

  it('the wrong code is rejected without ending the attempt', async () => {
    const mock = createMockAuthActions();
    await mock.sendCode('7185551234');
    await expect(mock.confirmCode('000000')).rejects.toThrow("That code isn't right");
    // Still live — the player can correct it rather than starting over.
    await expect(mock.confirmCode(MOCK_CODE)).resolves.toMatchObject({ e164: '+17185551234' });
  });

  it('reset abandons the attempt', async () => {
    const mock = createMockAuthActions();
    await mock.sendCode('7185551234');
    mock.reset();
    await expect(mock.confirmCode(MOCK_CODE)).rejects.toThrow('Verification expired. Start over.');
  });
});
