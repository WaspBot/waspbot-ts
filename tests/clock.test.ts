import { Clock } from '../src/core/clock';
import { DateTime } from 'luxon';

describe('Clock.getCurrentTime', () => {
  let clock: Clock;

  beforeEach(() => {
    clock = new Clock();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // (1) Valid IANA timezones
  test('should return correct time for valid IANA timezones', () => {
    // Test America/New_York (EST/EDT)
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z')); // Winter, no DST
    let newYorkTime = clock.getCurrentTime('America/New_York');
    let expectedNewYorkISO = '2025-01-15T07:00:00.000-05:00';
    expect(DateTime.fromJSDate(newYorkTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe(expectedNewYorkISO);

    jest.setSystemTime(new Date('2025-07-15T12:00:00Z')); // Summer, DST
    newYorkTime = clock.getCurrentTime('America/New_York');
    expectedNewYorkISO = '2025-07-15T08:00:00.000-04:00';
    expect(DateTime.fromJSDate(newYorkTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe(expectedNewYorkISO);

    // Test Europe/London (GMT/BST)
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z')); // Winter, no DST
    let londonTime = clock.getCurrentTime('Europe/London');
    let expectedLondonISO = '2025-01-15T12:00:00.000+00:00';
    expect(DateTime.fromJSDate(londonTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe(expectedLondonISO);

    jest.setSystemTime(new Date('2025-07-15T12:00:00Z')); // Summer, DST
    londonTime = clock.getCurrentTime('Europe/London');
    expectedLondonISO = '2025-07-15T13:00:00.000+01:00';
    expect(DateTime.fromJSDate(londonTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe(expectedLondonISO);
  });

  // (2) Invalid inputs
  test('should throw an error for invalid timezone strings', () => {
    expect(() => clock.getCurrentTime('Invalid/Timezone')).toThrow('Invalid timezone provided: Invalid/Timezone');
    expect(() => clock.getCurrentTime('NotATimezone')).toThrow('Invalid timezone provided: NotATimezone');
  });

  // (3) Default behavior
  test('should use system/local timezone when no timezone is provided', () => {
    // Mock a specific system time
    const mockDate = new Date('2025-03-10T10:00:00Z');
    jest.setSystemTime(mockDate);

    const currentTime = clock.getCurrentTime();
    // We can't assert a specific ISO string because the local timezone varies by environment.
    // Instead, we assert that the returned Date object's timestamp matches the mocked system time.
    expect(currentTime.getTime()).toBe(mockDate.getTime());
    // Also, check that it's a valid Date object
    expect(currentTime).toBeInstanceOf(Date);
  });

  // (4) DST edge cases
  test('should handle DST spring forward edge case correctly', () => {
    // Example: America/New_York DST transition (2 AM becomes 3 AM)
    // March 9, 2025, 07:00:00 UTC is 02:00:00 EST
    // March 9, 2025, 08:00:00 UTC is 04:00:00 EDT (2 AM to 3 AM jump)
    jest.setSystemTime(new Date('2025-03-09T07:00:00Z')); // 2 AM EST
    let springForwardTime = clock.getCurrentTime('America/New_York');
    expect(DateTime.fromJSDate(springForwardTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe('2025-03-09T02:00:00.000-05:00');

    jest.setSystemTime(new Date('2025-03-09T08:00:00Z')); // 4 AM EDT (after the jump)
    springForwardTime = clock.getCurrentTime('America/New_York');
    expect(DateTime.fromJSDate(springForwardTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe('2025-03-09T04:00:00.000-04:00');
  });

  test('should handle DST fall back edge case correctly', () => {
    // Example: America/New_York DST transition (2 AM becomes 1 AM again)
    // November 2, 2025, 05:00:00 UTC is 01:00:00 EDT
    // November 2, 2025, 06:00:00 UTC is 01:00:00 EST (1 AM occurs twice)
    jest.setSystemTime(new Date('2025-11-02T05:00:00Z')); // 1 AM EDT
    let fallBackTime = clock.getCurrentTime('America/New_York');
    expect(DateTime.fromJSDate(fallBackTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe('2025-11-02T01:00:00.000-04:00');

    jest.setSystemTime(new Date('2025-11-02T06:00:00Z')); // 1 AM EST (second occurrence)
    fallBackTime = clock.getCurrentTime('America/New_York');
    expect(DateTime.fromJSDate(fallBackTime).toISO({ includeOffset: true, suppressMilliseconds: false })).toBe('2025-11-02T01:00:00.000-05:00');
  });
});
