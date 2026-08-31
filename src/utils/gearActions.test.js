// Guards the gear actions seam.
//
// The point of the seam is that GearManager can run against either store. That
// only holds while both implementations expose the SAME operations — so the
// contract test below fails loudly if one gains a method and the other doesn't.
// Firebase is mocked so this never needs credentials or a network.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), onSnapshot: vi.fn(), runTransaction: vi.fn(), collection: vi.fn(),
  getDocs: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(),
}));
vi.mock('./identity', () => ({
  ensureAccount: vi.fn(), ensureAccountByPhone: vi.fn(),
}));

const { createFirestoreGearActions } = await import('./gearActions');
const { createMockGearActions } = await import('../redesign/state/mockGearActions');

describe('gear actions seam', () => {
  it('both implementations expose the same operations', () => {
    const real = createFirestoreGearActions({ adminName: 'A' });
    const mock = createMockGearActions({ playerName: 'A' });
    expect(Object.keys(mock).sort()).toEqual(Object.keys(real).sort());
  });

  it('every operation is callable on both', () => {
    const real = createFirestoreGearActions({ adminName: 'A' });
    const mock = createMockGearActions({ playerName: 'A' });
    for (const key of Object.keys(real)) {
      expect(typeof real[key], `real.${key}`).toBe('function');
      expect(typeof mock[key], `mock.${key}`).toBe('function');
    }
  });

  // The whole reason this file exists: importing the component used to reach
  // Firestore at module scope. The seam is what moved that here.
  it('the Firestore ledger ref is built per factory call, not at import', async () => {
    const { doc } = await import('firebase/firestore');
    doc.mockClear();
    createFirestoreGearActions({ adminName: 'A' });
    expect(doc).toHaveBeenCalledWith({}, 'gear', 'ledger');
  });
});

describe('mock gear ledger', () => {
  it('delivers the seeded ledger to a subscriber', async () => {
    const mock = createMockGearActions({ playerName: 'Tester' });
    const seen = await new Promise((resolve) => { mock.subscribe(resolve); });
    expect(seen.length).toBeGreaterThan(0);
    // One commitment belongs to the current user, so "mine" is never empty.
    expect(seen.some((c) => c.takerName === 'Tester')).toBe(true);
  });

  it('cancelling marks the commitment cancelled and notifies subscribers', async () => {
    const mock = createMockGearActions({ playerName: 'Tester' });
    const updates = [];
    mock.subscribe((cs) => updates.push(cs));
    const first = await new Promise((r) => setTimeout(() => r(updates[0]), 0));
    const target = first.find((c) => c.takerName === 'Tester');

    await mock.cancel(target);

    const latest = updates[updates.length - 1];
    expect(latest.find((c) => c.id === target.id).status).toBe('cancelled');
  });

  it('unsubscribing stops further updates', async () => {
    const mock = createMockGearActions({ playerName: 'Tester' });
    const updates = [];
    const unsub = mock.subscribe((cs) => updates.push(cs));
    const first = await new Promise((r) => setTimeout(() => r(updates[0]), 0));
    unsub();
    await mock.cancel(first[0]);
    expect(updates).toHaveLength(1);
  });
});
