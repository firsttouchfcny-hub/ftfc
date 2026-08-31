// Guards the admin actions seam.
//
// The point of the seam is that AdminPanel can run against either store. That
// only holds while both implementations expose the SAME operations — so the
// contract test below fails loudly if one gains a method and the other doesn't.
// Firebase is mocked so this never needs credentials or a network.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), setDoc: vi.fn(), getDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), writeBatch: vi.fn(), collection: vi.fn(),
  addDoc: vi.fn(), query: vi.fn(), where: vi.fn(), getDocs: vi.fn(),
}));
vi.mock('./identity', () => ({
  accountRef: vi.fn(), findAccountByName: vi.fn(),
  ensureAccount: vi.fn(), ensureAccountByPhone: vi.fn(),
}));

const { createFirestoreAdminActions } = await import('./adminActions');
const { createMockAdminActions } = await import('../redesign/state/mockAdminActions');

const makeMock = (players = []) => {
  let list = [...players];
  return createMockAdminActions({
    getPlayers: () => list,
    setPlayers: (fn) => { list = typeof fn === 'function' ? fn(list) : fn; },
    setSession: () => {},
    adminName: 'Tester',
    // expose for assertions
  });
};

describe('admin actions seam', () => {
  it('both implementations expose the same operations', () => {
    const real = createFirestoreAdminActions({ today: '2026-01-01', adminName: 'A' });
    const mock = makeMock();
    expect(Object.keys(mock).sort()).toEqual(Object.keys(real).sort());
  });

  it('every operation is callable', () => {
    const real = createFirestoreAdminActions({ today: '2026-01-01', adminName: 'A' });
    for (const [name, fn] of Object.entries(real)) {
      expect(typeof fn, `${name} should be a function`).toBe('function');
    }
  });
});

describe('mock admin actions', () => {
  let players;
  let actions;

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Existing Player', isAdmin: false, plusOnes: 0, signedUpAt: 1 },
    ];
    let list = players;
    actions = createMockAdminActions({
      getPlayers: () => list,
      setPlayers: (fn) => { list = typeof fn === 'function' ? fn(list) : fn; players = list; },
      setSession: () => {},
      adminName: 'Tester',
    });
  });

  it('bulkAdd skips names already on the list', async () => {
    const added = await actions.bulkAdd(['Existing Player', 'New Person'], players);
    expect(added).toBe(1);
    expect(players.map((p) => p.name)).toContain('New Person');
  });

  it('removePlayer drops the row', async () => {
    await actions.removePlayer('p1');
    expect(players).toHaveLength(0);
  });

  it('issueStrikes escalates the suspension on repeat offences', async () => {
    await actions.issueStrikes(['Repeat Offender']);
    await actions.issueStrikes(['Repeat Offender']);
    const log = await actions.loadStrikeLog();
    expect(log).toHaveLength(2);
    expect(log.map((s) => s.strikeNumber).sort()).toEqual([1, 2]);
  });

  it('undoStrike marks it undone rather than deleting it', async () => {
    await actions.issueStrikes(['Someone']);
    const [strike] = await actions.loadStrikeLog();
    await actions.undoStrike(strike);
    const after = await actions.loadStrikeLog();
    expect(after).toHaveLength(1);
    expect(after[0].undone).toBe(true);
  });
});
