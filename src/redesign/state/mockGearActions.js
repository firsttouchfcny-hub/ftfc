// Mock implementation of the gear actions seam (see utils/gearActions.js).
//
// Same operations as the Firestore version, backed by an in-memory ledger — so
// the real GearManager component renders and responds exactly as it does in
// production, without touching real gear commitments. This is what lets the
// gear panel be reviewed on the public preview deploy, which has no Firebase.
//
// The seeded ledger is built from the LIVE clock rather than the fixed dates in
// mockRoster: GearManager asks gearTakeDate() what the next game is, so a seed
// pinned to October would leave every panel on this screen empty and shouting
// "GEAR AT RISK". Seeding relative to the real next game day is what makes the
// preview look like a working club instead of a broken one.
//
// When the redesign merges, this is the one thing that swaps: the route passes
// createFirestoreGearActions() instead, and the panel is live.

import {
  gearTakeDate, gameDaysAfter, todayKey,
  returnSlotsLeft, pickFreeSet,
} from '../../utils/gear';

// A person resolved from a name, in the shape ensureAccount() returns.
const acctFor = (name) => ({
  uid: `mock-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  isAdmin: false,
});

// The seeded ledger, exported because more than one thing needs to know what it
// says. The nav's gear badge asks "is gear at risk?" and the gear panel answers
// it in words — reading different ledgers would let the badge light up over a
// page insisting everything is fine.
export function buildMockGearLedger({ playerName = 'Cristian Lugo', atRisk = false } = {}) {
  const take = gearTakeDate();                  // the next game
  const [next, later] = gameDaysAfter(take, 2); // the two game days after it
  // Mirrors the composition of mockCommitments: the take day is fully covered
  // by people already holding sets, while the day after is deliberately SHORT
  // (no balls taker) so the risk banners are previewable.
  const ledger = [
    // Already out with someone → they carry it in on the take day (the bringers).
    { id: 'm1', type: 'goal',  setId: 'goal-1',  takerName: 'Dave Rappaport', takerUid: 'mock-dave', takerDeviceId: null, takeDate: todayKey(), returnDate: take, held: true, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'seed' },
    { id: 'm2', type: 'goal',  setId: 'goal-2',  takerName: 'Marco Silva',    takerUid: 'mock-marco', takerDeviceId: null, takeDate: todayKey(), returnDate: take, held: true, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'seed' },
    { id: 'm3', type: 'balls', setId: 'balls-1', takerName: 'This is a really long name', takerUid: 'mock-long', takerDeviceId: null, takeDate: todayKey(), returnDate: take, held: true, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'seed' },
    { id: 'm4', type: 'bibs',  setId: 'bibs-1',  takerName: 'Kofi Mensah',    takerUid: 'mock-kofi', takerDeviceId: null, takeDate: todayKey(), returnDate: take, held: true, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'seed' },

    // Taking a set HOME after the take day (the takers).
    { id: 'm5', type: 'goal',  setId: 'goal-3',  takerName: 'Nico Bruno',     takerUid: 'mock-nico', takerDeviceId: null, takeDate: take, returnDate: next, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'player' },
    // One of them is you, so "Who has the gear" and the admin table both show a
    // commitment you can recognise — and act on.
    { id: 'm6', type: 'bibs',  setId: 'bibs-2',  takerName: playerName, takerUid: 'mock-you', takerDeviceId: null, takeDate: take, returnDate: later, status: 'committed', returnedOnTime: null, createdAt: Date.now(), source: 'player' },
  ];

  // `atRisk` drops the people carrying gear IN on the take day, which is what
  // "GEAR AT RISK" means. Used by the ?alert=bringing preview so the nav badge
  // and the gear panel's message can be seen agreeing with each other.
  return atRisk ? ledger.filter((c) => c.returnDate !== take) : ledger;
}

export function createMockGearActions({ playerName = 'Cristian Lugo', adminName, atRisk = false } = {}) {
  let ledger = buildMockGearLedger({ playerName, atRisk });

  const listeners = new Set();
  // Hand out a copy: the panel keeps it in state, and sharing the array would
  // let a later write mutate what React already rendered.
  const emit = () => { for (const fn of listeners) fn([...ledger]); };

  const patchCommitment = (id, patch) => {
    ledger = ledger.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
  };

  const resolvePerson = async ({ e164, name }) => acctFor(name || e164 || 'Unknown');

  return {
    subscribe(onNext) {
      listeners.add(onNext);
      // Async, like a real snapshot — so the panel's "Loading gear…" state is
      // actually exercised rather than skipped by a synchronous first call.
      const t = setTimeout(() => onNext([...ledger]), 0);
      return () => { clearTimeout(t); listeners.delete(onNext); };
    },

    async claim({ type, returnDate, addToGame = true, takeDate, player }) {
      const alreadyHas = ledger.some(
        (c) => c.status === 'committed' && c.type === type && c.returnDate > takeDate &&
          (c.takerName || '').toLowerCase() === player.name.toLowerCase(),
      );
      if (alreadyHas) return null;
      if (returnSlotsLeft(ledger, type, returnDate) <= 0) return null;
      const setId = pickFreeSet(ledger, type, takeDate);
      if (!setId) return null;
      ledger = [...ledger, {
        id: crypto.randomUUID(), type, setId,
        takerName: player.name, takerDeviceId: player.deviceId ?? null,
        takerUid: player.uid || null, takerIsAdmin: !!player.isAdmin,
        takeDate, returnDate, status: 'committed', returnedOnTime: null,
        gearOnly: !addToGame, createdAt: Date.now(), source: 'player',
      }];
      emit();
      return setId;
    },

    async cancel(commitment) {
      patchCommitment(commitment.id, { status: 'cancelled', cancelledAt: Date.now() });
    },

    async markReturned(commitment, onTime) {
      patchCommitment(commitment.id, {
        status: 'returned', returnedOnTime: onTime, returnedAt: Date.now(),
        returnedBy: adminName || 'admin',
      });
    },

    async reassign(commitment, account) {
      patchCommitment(commitment.id, {
        takerName: account.name, takerUid: account.uid, takerDeviceId: null,
        source: adminName || 'admin',
      });
    },

    resolvePerson,

    async addManual({ type, e164, name, backDate, mode, takeOn, addToGame = true, takeDate }) {
      const held = mode === 'held';
      const useTake = held ? todayKey() : (takeOn || takeDate);
      const acct = await resolvePerson({ e164, name });
      if (returnSlotsLeft(ledger, type, backDate) <= 0) return { ok: false, dayFull: true };
      let setId = pickFreeSet(ledger, type, useTake);
      if (!setId) {
        if (held) return { ok: false, dayFull: false };
        setId = `${type}-override`;
      }
      ledger = [...ledger, {
        id: crypto.randomUUID(), type, setId,
        takerName: acct.name, takerDeviceId: null, takerUid: acct.uid, takerIsAdmin: !!acct.isAdmin,
        takeDate: useTake, returnDate: backDate, held,
        status: 'committed', returnedOnTime: null,
        gearOnly: !addToGame, createdAt: Date.now(), source: adminName || 'admin',
      }];
      emit();
      return { ok: true, dayFull: false };
    },
  };
}
