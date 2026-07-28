import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isGameDay, addDaysToKey, nextGameDay, addGameDays,
  getSessionDate, getRollCallPhase,
} from './helpers.js';

// Reference weekdays: 2026-07-25 Sat, -26 Sun, -27 Mon, -28 Tue, -31 Fri, 08-03 Mon.

describe('date math', () => {
  it('isGameDay: Mon–Fri true, weekends false', () => {
    expect(isGameDay('2026-07-27')).toBe(true);  // Monday
    expect(isGameDay('2026-07-31')).toBe(true);  // Friday
    expect(isGameDay('2026-07-25')).toBe(false); // Saturday
    expect(isGameDay('2026-07-26')).toBe(false); // Sunday
  });

  it('addDaysToKey handles month rollover both directions', () => {
    expect(addDaysToKey('2026-07-27', 1)).toBe('2026-07-28');
    expect(addDaysToKey('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysToKey('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('nextGameDay skips the weekend', () => {
    expect(nextGameDay('2026-07-31')).toBe('2026-08-03'); // Fri -> Mon
    expect(nextGameDay('2026-07-27')).toBe('2026-07-28'); // Mon -> Tue
  });

  it('addGameDays advances by game days only', () => {
    expect(addGameDays('2026-07-24', 1)).toBe('2026-07-27'); // Fri -> Mon
    expect(addGameDays('2026-07-24', 2)).toBe('2026-07-28'); // Fri -> Tue
  });
});

describe('roll-call timing (Eastern; July = EDT, UTC-4)', () => {
  afterEach(() => vi.useRealTimers());
  const at = (iso) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };

  it('weekends target Monday as the next game', () => {
    at('2026-07-26T16:00:00Z'); // Sun 12pm ET
    expect(getSessionDate()).toBe('2026-07-27');
    at('2026-07-25T18:00:00Z'); // Sat 2pm ET
    expect(getSessionDate()).toBe('2026-07-27');
  });

  it("Monday's roll call opens Sunday (10am admins, 3pm all) — not before", () => {
    at('2026-07-26T13:00:00Z'); // Sun 9am ET
    expect(getRollCallPhase()).toBe('closed');
    at('2026-07-26T16:00:00Z'); // Sun 12pm ET
    expect(getRollCallPhase()).toBe('admins-only');
    at('2026-07-26T20:00:00Z'); // Sun 4pm ET
    expect(getRollCallPhase()).toBe('open');
  });

  it('Saturday keeps Monday CLOSED (no Friday spring-open regression)', () => {
    at('2026-07-25T18:00:00Z'); // Sat 2pm ET
    expect(getRollCallPhase()).toBe('closed');
  });

  it('the 10am reset moves focus to the next game', () => {
    at('2026-07-27T12:00:00Z'); // Mon 8am ET -> still Monday's game
    expect(getSessionDate()).toBe('2026-07-27');
    at('2026-07-27T15:00:00Z'); // Mon 11am ET -> next game (Tuesday)
    expect(getSessionDate()).toBe('2026-07-28');
  });
});
