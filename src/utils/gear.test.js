import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  gearNeed, returnDateOptions, returnSlotsLeft, availableToTake,
  playerReturnDates, coverageForMorning, setStatuses,
  fridayGearPriorityNames, isFridayKey, myCommitments, takeBlockedByPriority,
} from './gear.js';

// Helper to build a live commitment.
const c = (over) => ({ status: 'committed', held: false, ...over });

describe('per-game needs & return windows', () => {
  it('needs: 2 goals, 1 balls, 1 bibs', () => {
    expect(gearNeed('goal')).toBe(2);
    expect(gearNeed('balls')).toBe(1);
    expect(gearNeed('bibs')).toBe(1);
  });

  it('goals return over a 2-day window (next game or the one after)', () => {
    expect(returnDateOptions('2026-07-27', 'goal')).toEqual(['2026-07-28', '2026-07-29']);
  });

  it('bibs return over a 5-day window', () => {
    expect(returnDateOptions('2026-07-27', 'bibs')).toEqual([
      '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-03',
    ]);
  });
});

describe('coverage & return slots', () => {
  const commits = [
    c({ type: 'goal',  setId: 'goal-1',  takeDate: '2026-07-24', returnDate: '2026-07-27', takerName: 'A' }),
    c({ type: 'goal',  setId: 'goal-2',  takeDate: '2026-07-24', returnDate: '2026-07-27', takerName: 'B' }),
    c({ type: 'balls', setId: 'balls-1', takeDate: '2026-07-24', returnDate: '2026-07-27', takerName: 'C' }),
    c({ type: 'bibs',  setId: 'bibs-1',  takeDate: '2026-07-24', returnDate: '2026-07-27', takerName: 'D' }),
  ];

  it('a morning with 2 goals + 1 balls + 1 bibs is covered', () => {
    expect(coverageForMorning(commits, '2026-07-27').covered).toBe(true);
  });

  it('a morning short a goal is not covered', () => {
    expect(coverageForMorning(commits.slice(0, 1), '2026-07-27').covered).toBe(false);
  });

  it('returnSlotsLeft caps at the need (no over-booking)', () => {
    expect(returnSlotsLeft(commits, 'goal', '2026-07-27')).toBe(0); // 2 goals already back
    expect(returnSlotsLeft(commits, 'bibs', '2026-07-27')).toBe(0); // 1 bibs already back
  });
});

describe('goal take-home: 2 per day, auto-rolls to the following game when next is full', () => {
  // Tuesday already has its 2 goals committed back (goal-1 held over, goal-2 from Monday).
  const commits = [
    c({ type: 'goal', setId: 'goal-1', takeDate: '2026-07-24', returnDate: '2026-07-28', takerName: 'X' }),
    c({ type: 'goal', setId: 'goal-2', takeDate: '2026-07-27', returnDate: '2026-07-28', takerName: 'Y' }),
  ];

  it('a further Monday goal auto-returns Wednesday because Tuesday is full', () => {
    expect(playerReturnDates(commits, 'goal', '2026-07-27')).toEqual(['2026-07-29']);
  });

  it('availableToTake = need minus who is already taking that day', () => {
    expect(availableToTake(commits, 'goal', '2026-07-27')).toBe(1); // Y takes 1 of 2
  });
});

describe('bibs auto-assign to the nearest coverage gap', () => {
  // Bibs covered Wed & Fri; Thursday is the only near gap in the window.
  const commits = [
    c({ type: 'bibs', setId: 'bibs-1', takeDate: '2026-07-24', returnDate: '2026-07-29', takerName: 'wed' }),
    c({ type: 'bibs', setId: 'bibs-2', takeDate: '2026-07-24', returnDate: '2026-07-31', takerName: 'fri' }),
  ];
  it('a Tuesday bibs take is forced to Thursday (a CLOSE gap), skipping covered Wed/Fri', () => {
    expect(playerReturnDates(commits, 'bibs', '2026-07-28')).toEqual(['2026-07-30']);
  });

  it('leaves the player a choice when the next two games are already covered', () => {
    const covered = [
      c({ type: 'bibs', takeDate: '2026-07-24', returnDate: '2026-07-29', takerName: 'wed' }), // next game
      c({ type: 'bibs', takeDate: '2026-07-24', returnDate: '2026-07-30', takerName: 'thu' }), // the one after
    ];
    // Take after Tue → Wed & Thu covered, so the earliest gap (Fri) is not "close" → free pick.
    const r = playerReturnDates(covered, 'bibs', '2026-07-28');
    expect(r.length).toBeGreaterThan(1);
    expect(r[0]).toBe('2026-07-31'); // Friday, first open day, but not forced
  });
});

describe('"Who has the gear" tracker (setStatuses)', () => {
  afterEach(() => vi.useRealTimers());

  it('sorts each type by return date, with "at the field" last', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T12:00:00Z')); // today = Mon 2026-07-27
    const commits = [
      c({ type: 'bibs', setId: 'bibs-1', takeDate: '2026-07-24', returnDate: '2026-07-31', takerName: 'late' }),
      c({ type: 'bibs', setId: 'bibs-2', takeDate: '2026-07-24', returnDate: '2026-07-28', takerName: 'soon' }),
      // bibs-3/4/5 have no commitment -> "at the field"
    ];
    const backs = setStatuses('bibs', commits).map((r) => r.back || 'field');
    expect(backs[0]).toBe('2026-07-28');            // soonest first
    expect(backs[1]).toBe('2026-07-31');
    expect(backs[backs.length - 1]).toBe('field');  // field last
  });
});

describe('Friday gear priority (reward for taking gear home Mon–Thu)', () => {
  it('is empty on non-Fridays', () => {
    expect(isFridayKey('2026-07-31')).toBe(true);
    expect(isFridayKey('2026-07-27')).toBe(false);
    expect(fridayGearPriorityNames([], '2026-07-27').size).toBe(0);
  });

  it('rewards Mon–Thu take-home only — not last Friday, not this Friday', () => {
    const friday = '2026-07-31';
    const commits = [
      c({ type: 'goal', takeDate: '2026-07-28', returnDate: '2026-07-29', takerName: 'Took Tuesday' }),
      c({ type: 'goal', takeDate: '2026-07-30', returnDate: '2026-07-31', takerName: 'Took Thursday' }),
      c({ type: 'goal', takeDate: '2026-07-24', returnDate: '2026-07-27', takerName: 'Took Last Friday' }),
    ];
    const names = fridayGearPriorityNames(commits, friday);
    expect(names.has('took tuesday')).toBe(true);
    expect(names.has('took thursday')).toBe(true);
    expect(names.has('took last friday')).toBe(false);
  });
});

describe('balls priority lock — goals & bibs must be taken first', () => {
  const td = '2026-07-28';
  const goal = (n) => c({ type: 'goal', takeDate: td, returnDate: '2026-07-29', takerName: n });
  const bibs = (n) => c({ type: 'bibs', takeDate: td, returnDate: '2026-07-29', takerName: n });

  it('locks balls while goals still need a taker', () => {
    expect(takeBlockedByPriority([], 'balls', td)).toBe(true);
  });

  it('locks balls while bibs still needs a taker (even after goals are done)', () => {
    // both goals taken, bibs NOT — balls must stay locked (this is the bug we fixed:
    // balls used to unlock here if bibs happened to have no open return day)
    expect(takeBlockedByPriority([goal('a'), goal('b')], 'balls', td)).toBe(true);
  });

  it('unlocks balls only once BOTH goals and bibs are taken', () => {
    expect(takeBlockedByPriority([goal('a'), goal('b'), bibs('c')], 'balls', td)).toBe(false);
  });

  it('never blocks goals or bibs themselves', () => {
    expect(takeBlockedByPriority([], 'goal', td)).toBe(false);
    expect(takeBlockedByPriority([], 'bibs', td)).toBe(false);
  });
});

describe('identity matching by stable uid', () => {
  const commits = [
    c({ type: 'goal', takerName: 'Old Name', takerDeviceId: 'devA', takerUid: 'u_1', takeDate: '2026-07-27', returnDate: '2026-07-28' }),
    c({ type: 'bibs', takerName: 'Someone',  takerDeviceId: 'devB', takerUid: 'u_2', takeDate: '2026-07-27', returnDate: '2026-07-28' }),
  ];

  it('finds a person by uid even when name AND device differ (new phone/device, renamed)', () => {
    const mine = myCommitments(commits, 'devX', 'A Different Name', 'u_1');
    expect(mine.map((m) => m.type)).toEqual(['goal']);
  });

  it('falls back to device/name for records without a uid', () => {
    const mine = myCommitments(commits, 'devB', 'unknown', null);
    expect(mine.map((m) => m.type)).toEqual(['bibs']);
  });
});

