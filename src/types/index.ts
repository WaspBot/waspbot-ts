import { v4 as uuid } from 'uuid';
import { BaseEvent, EventPriority, EventStatus } from '../core/events';
import { Timestamp } from './common';

// Export common types and utilities
export * from './common';

/**
 * Represents a recurring tick event, signaling a time interval.
 */
export interface TickEvent extends BaseEvent {
  id: string;
  type: 'Tick';
  source?: string;
  priority: EventPriority;
  status: EventStatus;
  timestamp: Timestamp;
  interval: number;
}

/**
 * Metrics for the event queue
 */
export interface QueueMetrics {
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  totalDropped: number;
}

/**
 * States for queue processing
 */
export enum QueueProcessingState {
  PAUSED = 'paused',
  IDLE = 'idle',
  DRAINING = 'draining',
}

// Export market data types
export * from '../market-data/ticker';
export * from '../market-data/candles';
export * from '../market-data/order-book';

// Export order management types
export * from '../order-management/order';
export * from '../order-management/position';
export * from '../order-management/order-manager';

// TODO: Add remaining order management modules
// export * from './orders-validation';   // Issue #8: Risk management and validation
// export * from './orders';              // Issue #9: Final consolidated module

// TODO: Add additional type modules as they are implemented

// Version information
export const WASPBOT_VERSION = '0.1.0';
export const API_VERSION = 'v1';

// Re-export Decimal class for runtime
export { Decimal } from 'decimal.js';

// Re-export Decimal type for typing convenience
export type { Decimal as DecimalType } from 'decimal.js';
