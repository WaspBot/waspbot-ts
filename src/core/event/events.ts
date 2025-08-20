/**
 * @fileoverview Core event definitions for WaspBot-TS
 * Basic event types and interfaces as requested in Phase 1.1
 */

import { Timestamp } from '../../types/common.js';

// ============================================================================
// Core Event Enums
// ============================================================================

/**
 * Core WaspBot event types
 */
export enum WaspBotEvent {
  // System Events
  STARTED = 'STARTED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',

  // Strategy Events
  STRATEGY_STARTED = 'STRATEGY_STARTED',
  STRATEGY_STOPPED = 'STRATEGY_STOPPED',
  STRATEGY_ERROR = 'STRATEGY_ERROR',
}

/**
 * Market-related event types
 */
export enum MarketEvent {
  // Asset Events
  RECEIVED_ASSET = 'RECEIVED_ASSET',
  WITHDRAW_ASSET = 'WITHDRAW_ASSET',

  // Order Lifecycle Events
  BUY_ORDER_CREATED = 'BUY_ORDER_CREATED',
  SELL_ORDER_CREATED = 'SELL_ORDER_CREATED',
  BUY_ORDER_COMPLETED = 'BUY_ORDER_COMPLETED',
  SELL_ORDER_COMPLETED = 'SELL_ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_FILLED = 'ORDER_FILLED',
  ORDER_FAILURE = 'ORDER_FAILURE',

  // Trade Events
  TRADE_UPDATE = 'TRADE_UPDATE',

  // Market Data Events
  TICKER_UPDATE = 'TICKER_UPDATE',
  ORDERBOOK_UPDATE = 'ORDERBOOK_UPDATE',
  PRICE_UPDATE = 'PRICE_UPDATE',
}

/**
 * Order book related events
 */
export enum OrderBookEvent {
  ORDERBOOK_TRADE_EVENT = 'ORDERBOOK_TRADE_EVENT',
  ORDERBOOK_ASK_EVENT = 'ORDERBOOK_ASK_EVENT',
  ORDERBOOK_BID_EVENT = 'ORDERBOOK_BID_EVENT',
}

/**
 * Account-related events
 */
export enum AccountEvent {
  BALANCE_UPDATE = 'BALANCE_UPDATE',
  POSITION_UPDATE = 'POSITION_UPDATE',
  POSITION_MODE_CHANGE = 'POSITION_MODE_CHANGE',
}

/**
 * Event priority levels for queue management
 */
export enum EventPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 100,
}

/**
 * Event processing status
 */
export enum EventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// Base Event Interfaces
// ============================================================================

/**
 * Base interface for all events in the system
 */
export interface BaseEvent {
  /** Unique event identifier */
  readonly id: string;

  /** Event type */
  readonly type: string;

  /** Event source identifier */
  readonly source?: string;

  /** Event priority level */
  readonly priority: EventPriority;

  /** Current processing status */
  status: EventStatus;

  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Base interface for timestamped events
 */
export interface TimestampedEvent extends BaseEvent {
  /** Event creation timestamp */
  readonly timestamp: Timestamp;

  /** Event processing start time */
  processedAt?: Timestamp;

  /** Event completion time */
  completedAt?: Timestamp;
}

/**
 * Interface for events that contain error information
 */
export interface ErrorEvent extends BaseEvent {
  /** Error message */
  readonly errorMessage: string;

  /** Error code (optional) */
  readonly errorCode?: string;

  /** Stack trace (optional) */
  readonly stackTrace?: string;

  /** Original error object */
  readonly originalError?: Error;
}
