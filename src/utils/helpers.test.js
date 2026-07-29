import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isGameDay, addDaysToKey, nextGameDay, addGameDays,
  getSessionDate, getRollCallPhase,
  isSamePerson, rosterDocId,
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

describe('isSamePerson — the one identity matcher', () => {
  const me = { uid: 'u_1', deviceId: 'dev_A', name: 'William' };

  it('matches on uid regardless of device or name (cross-device, renamed)', () => {
    expect(isSamePerson({ uid: 'u_1', deviceId: 'dev_B', name: 'Will' }, me)).toBe(true);
  });

  it('matches on deviceId when uid is absent (legacy/unverified row)', () => {
    expect(isSamePerson({ deviceId: 'dev_A' }, me)).toBe(true);
  });

  it('matches on name (case-insensitive) as a last resort', () => {
    expect(isSamePerson({ name: 'william' }, { name: 'William' })).toBe(true);
  });

  it('does NOT match a different person (different uid, device, and name)', () => {
    expect(isSamePerson({ uid: 'u_2', deviceId: 'dev_B', name: 'Dave' }, me)).toBe(false);
  });

  it('a different uid does not short-circuit a device/name match', () => {
    // uid differs (no match on uid) but same device → still me.
    expect(isSamePerson({ uid: 'u_2', deviceId: 'dev_A', name: 'Dave' }, me)).toBe(true);
  });

  it('handles null/empty entry safely', () => {
    expect(isSamePerson(null, me)).toBe(false);
    expect(isSamePerson({}, me)).toBe(false);
  });
});

describe('rosterDocId — one row per person, by construction', () => {
  it('reuses the id of a row the person already owns', () => {
    expect(rosterDocId({ existingId: 'u_1', uid: 'u_1', deviceId: 'dev_A' })).toBe('u_1');
    // even if the existing row was device-keyed (created before uid resolved)
    expect(rosterDocId({ existingId: 'dev_A', uid: 'u_1', deviceId: 'dev_A' })).toBe('dev_A');
  });

  it('keys a fresh sign-up by the stable uid when known', () => {
    expect(rosterDocId({ uid: 'u_1', deviceId: 'dev_A' })).toBe('u_1');
  });

  it('falls back to deviceId only when no account is resolved', () => {
    expect(rosterDocId({ deviceId: 'dev_A' })).toBe('dev_A');
  });
});
