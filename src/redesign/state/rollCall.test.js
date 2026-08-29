// Guards the relative day naming on the gear-takers headline.
//
// Dates are derived from the CURRENT Eastern date rather than hardcoded, so
// these stay true whenever the suite runs — a test pinned to a fixed Tuesday
// would start failing on its own.

import { describe, it, expect } from 'vitest';
import { relativeDayName } from './rollCall';
import { getEasternNow, addDaysToKey } from '../../utils/helpers';

const today = () => getEasternNow().dateKey;
const weekdayOf = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

describe('relativeDayName', () => {
  it('calls the take day "Today" on a game morning', () => {
    // Before the 10 AM reset the take date IS today — five mornings a week,
    // which the old hardcoded "Tomorrow" got wrong every time.
    expect(relativeDayName(today())).toBe('Today');
  });

  it('calls the next day "Tomorrow"', () => {
    expect(relativeDayName(addDaysToKey(today(), 1))).toBe('Tomorrow');
  });

  it('names the weekday for anything further out', () => {
    // Friday after the reset points at Monday (3 days); Saturday at Monday (2).
    for (const n of [2, 3, 4]) {
      const key = addDaysToKey(today(), n);
      expect(relativeDayName(key)).toBe(weekdayOf(key));
    }
  });

  it('never says "Tomorrow" for a day that is not tomorrow', () => {
    for (const n of [0, 2, 3, 4, 5, 6, 7]) {
      expect(relativeDayName(addDaysToKey(today(), n))).not.toBe('Tomorrow');
    }
  });

  it('is empty for a missing date rather than guessing', () => {
    expect(relativeDayName(null)).toBe('');
    expect(relativeDayName(undefined)).toBe('');
  });
});
