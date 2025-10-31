import { Clock, TickEvent } from '../src/core/clock';
import { DateTime } from 'luxon';
import { EventDispatcher } from '../src/core/dispatcher';
import { BaseEvent } from '../src/core/events';

// Mock EventDispatcher for testing readiness and event emission
class MockEventDispatcher extends EventDispatcher {
  private _mockIsReady = false;
  public emittedEvents: BaseEvent[] = [];

  constructor(name: string = 'MockEventDispatcher') {
    super(name);
  }

  public markAsReady(): void {
    this._mockIsReady = true;
  }

  public isReady(): boolean {
    return this._mockIsReady;
  }

  public async emitEvent(event: BaseEvent): Promise<boolean> {
    if (!this._mockIsReady) {
      throw new Error(`EventDispatcher '${this.name}' is not ready to emit events. Call markAsReady() first.`);
    }
    this.emittedEvents.push(event);
    return Promise.resolve(true);
  }
}

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

describe('Clock event emission', () => {
  let clock: Clock;
  let mockDispatcher: MockEventDispatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    mockDispatcher = new MockEventDispatcher();
    clock = new Clock(100); // 100ms tick interval
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    clock.stopEmittingEvents(); // Ensure clock is stopped after each test
  });

  test('should throw error if emission already started', () => {
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    expect(() => clock.startEmittingEvents(mockDispatcher)).toThrow('Event emission already started');
  });

  test('should throw error if dispatcher is not ready', () => {
    expect(() => clock.startEmittingEvents(mockDispatcher)).toThrow(
      `Cannot start emitting events: EventDispatcher '${mockDispatcher.name}' is not ready. Call markAsReady() first.`
    );
  });

  test('should start emitting events when dispatcher is ready', () => {
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(1);
    expect(mockDispatcher.emittedEvents[0].type).toBe('CLOCK_TICK');

    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(2);
  });

  test('should stop emitting events', () => {
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(1);

    clock.stopEmittingEvents();
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(1); // Should not emit more events
  });

  test('should not emit duplicate events after stop and restart', () => {
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(1);

    clock.stopEmittingEvents();
    jest.advanceTimersByTime(500); // Advance time past a few potential ticks
    expect(mockDispatcher.emittedEvents.length).toBe(1); // No new events after stopping

    // Restart the clock
    clock = new Clock(100); // Re-initialize clock to simulate a fresh start
    mockDispatcher = new MockEventDispatcher(); // Re-initialize dispatcher
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(1); // Only one new event after restart
    jest.advanceTimersByTime(100);
    expect(mockDispatcher.emittedEvents.length).toBe(2); // Another event after another tick
  });




  test('emitted events should be TickEvent type', () => {
    mockDispatcher.markAsReady();
    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);
    const emittedEvent = mockDispatcher.emittedEvents[0] as TickEvent;
    expect(emittedEvent).toBeDefined();
    expect(emittedEvent.type).toBe('CLOCK_TICK');
    expect(emittedEvent.tickNumber).toBe(1);
    expect(emittedEvent.source).toBe('Clock');
  });

  test('should log error if emitEvent fails synchronously', () => {
    mockDispatcher.markAsReady();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Temporarily override emitEvent to throw synchronously
    mockDispatcher.emitEvent = jest.fn((event: BaseEvent) => {
      throw new Error('Sync emit failed');
    });

    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);

    expect(errorSpy).toHaveBeenCalledWith('Failed to emit tick event synchronously:', expect.any(Error));
    expect(mockDispatcher.emittedEvents.length).toBe(0); // No events should be added if sync emit fails
    errorSpy.mockRestore();
  });

  test('should log error if emitEvent fails asynchronously', async () => {
    mockDispatcher.markAsReady();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Temporarily override emitEvent to return a rejected promise
    mockDispatcher.emitEvent = jest.fn((event: BaseEvent) => {
      return Promise.reject(new Error('Async emit failed'));
    });

    clock.startEmittingEvents(mockDispatcher);
    jest.advanceTimersByTime(100);

    // Advance timers to allow promise to resolve/reject
    await Promise.resolve(); // Allow microtasks to run

    expect(errorSpy).toHaveBeenCalledWith('Failed to emit tick event:', expect.any(Error));
    expect(mockDispatcher.emittedEvents.length).toBe(0); // No events should be added if async emit fails
    errorSpy.mockRestore();
  });
});