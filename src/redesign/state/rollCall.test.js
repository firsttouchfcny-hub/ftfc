// Guards the relative day naming on the gear-takers headline.
//
// Dates are derived from the CURRENT Eastern date rather than hardcoded, so
// these stay true whenever the suite runs — a test pinned to a fixed Tuesday
// would start failing on its own.

import { describe, it, expect } from 'vitest';
import { relativeDayName, rollCallOpenDay, rollCallOpensToday, rollCallOpensLabel } from './rollCall';
import { getEasternNow, addDaysToKey, getSessionDate } from '../../utils/helpers';

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

describe('roll call open day', () => {
  it('opens the day before the game', () => {
    expect(rollCallOpenDay()).toBe(addDaysToKey(getSessionDate(), -1));
  });

  it('agrees with itself about whether that day is today', () => {
    expect(rollCallOpensToday()).toBe(rollCallOpenDay() === getEasternNow().dateKey);
  });

  it('labels the open moment as a short weekday plus the hour', () => {
    // e.g. "Sun at 3 PM" — the shape the weekend badge needs.
    expect(rollCallOpensLabel()).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) at \d{1,2} (AM|PM)$/);
  });

  it('takes the hour from OPEN_HOUR_ET rather than hardcoding it', () => {
    // Guards the copy against drifting from the rule it describes.
    expect(rollCallOpensLabel()).toContain('3 PM');
  });

  it('names the day roll call actually opens, not today', () => {
    const expected = new Date(`${rollCallOpenDay()}T12:00:00`)
      .toLocaleDateString('en-US', { weekday: 'short' });
    expect(rollCallOpensLabel().startsWith(expected)).toBe(true);
  });
});
