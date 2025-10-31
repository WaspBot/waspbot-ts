/**
 * @fileoverview Clock and scheduling system for WaspBot-TS
 * Handles event/tick scheduling
 */

import { DateTime } from 'luxon';
import { EventDispatcher } from './dispatcher.js';
import { BaseEvent, TimestampedEvent, EventPriority, EventStatus } from './events.js';

export interface TickEvent extends TimestampedEvent {
  readonly type: 'CLOCK_TICK';
  readonly tickNumber: number;
}

export class Clock {
  private emissionStarted = false;
  private emissionTimer?: ReturnType<typeof setInterval>;
  private tickInterval: number;
  private tickCount = 0;

  constructor(tickInterval: number = 1000) {
    this.tickInterval = tickInterval;
  }

  private _createTickEvent(): TickEvent {
    this.tickCount++;
    return {
      id: `tick-${Date.now()}-${this.tickCount}`,
      type: 'CLOCK_TICK',
      source: 'Clock',
      priority: EventPriority.LOW,
      status: EventStatus.COMPLETED,
      timestamp: Date.now(),
      tickNumber: this.tickCount,
    };
  }

  public startEmittingEvents(dispatcher: EventDispatcher): void {
    // Behavior: Prevent duplicate starts. Throws an error if event emission is already active.
    if (this.emissionStarted) {
      throw new Error('Event emission already started');
    }

    // Clear any existing timer to ensure a clean start. This handles cases where
    // emissionStarted might be false but a timer somehow persists (e.g., after an error).
    if (this.emissionTimer) {
      clearInterval(this.emissionTimer);
      this.emissionTimer = undefined;
    }

    if (!dispatcher.isReady()) {
      throw new Error(`Cannot start emitting events: EventDispatcher '${dispatcher.name}' is not ready. Call markAsReady() first.`);
    }

    this.emissionStarted = true;
    this.emissionTimer = setInterval(() => {
      try {
        const event = this._createTickEvent();
        const maybePromise = dispatcher.emitEvent(event);
        if (maybePromise && typeof (maybePromise as Promise<any>).catch === 'function') {
          (maybePromise as Promise<any>).catch(err => console.error('Failed to emit tick event:', err));
        }
      } catch (err) {
        console.error('Failed to emit tick event synchronously:', err);
      }
    }, this.tickInterval);

    console.log(`Clock started, EventDispatcher '${dispatcher.name}' is ready: ${dispatcher.isReady()}`);
  }

  public stopEmittingEvents(): void {
    if (this.emissionTimer) {
      clearInterval(this.emissionTimer);
      this.emissionTimer = undefined;
    }
    this.emissionStarted = false;
    console.log('Clock stopped emitting events.');
  }

  scheduleEvent(event: () => void, delay: number): void {
    setTimeout(event, delay);
  }

  getCurrentTime(timezone?: string): Date {
    if (timezone) {
      const dt = DateTime.now().setZone(timezone);
      if (!dt.isValid) {
        throw new Error(`Invalid timezone provided: ${timezone}`);
      }
      return dt.toJSDate();
    }
    return new Date();
  }
}