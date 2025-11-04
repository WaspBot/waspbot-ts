/**
 * Common type definitions used throughout the WaspBot framework
 */

import { Decimal } from 'decimal.js';

// Core primitives
/**
 * Unix timestamp in milliseconds.
 */
export type Timestamp = number;
/**
 * Unique identifier for an exchange.
 */
export type ExchangeId = string;
/**
 * Trading pair in "BASE-QUOTE" format (e.g., "BTC-USDT").
 */
export type TradingPair = string;
/**
 * Unique identifier for an order.
 */
export type OrderId = string;
/**
 * Unique identifier for a trade.
 */
export type TradeId = string;
/**
 * Unique identifier for a strategy.
 */
export type StrategyId = string;

// Financial primitives using Decimal for precision
/**
 * Represents a price, using Decimal for precision.
 */
export type Price = Decimal;
/**
 * Represents a quantity, using Decimal for precision.
 */
export type Quantity = Decimal;
/**
 * Represents a monetary amount, using Decimal for precision.
 */
export type DecimalAmount = Decimal;

// Event types
/**
 * Defines the various types of events that can occur within the system.
 */
export type EventType =
  | 'ticker'
  | 'order_book'
  | 'trade'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_rejected'
  | 'balance_update'
  | 'connector_ready'
  | 'connector_disconnected'
  | 'strategy_start'
  | 'strategy_stop'
  | 'error'
  | 'warning'
  | 'info';

// Trading sides
/**
 * Defines the side of a trade (BUY or SELL).
 */
export enum TradingSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

/**
 * Defines the types of orders that can be placed.
 */
export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  LIMIT_MAKER = 'LIMIT_MAKER',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_LIMIT = 'STOP_LOSS_LIMIT',
  TAKE_PROFIT = 'TAKE_PROFIT',
  TAKE_PROFIT_LIMIT = 'TAKE_PROFIT_LIMIT',
}

/**
 * Defines the possible statuses of an order.
 */
export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  PENDING_CANCEL = 'PENDING_CANCEL',
}

/**
 * Defines the time in force options for an order.
 */
export enum TimeInForce {
  GTC = 'GTC', // Good Till Canceled
  IOC = 'IOC', // Immediate Or Cancel
  FOK = 'FOK', // Fill Or Kill
}

/**
 * Defines the possible statuses of a connector.
 */
export enum ConnectorStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * Defines the possible statuses of a strategy.
 */
export enum StrategyStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
}

/**
 * Defines the logging levels.
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE',
}

// Base error class
/**
 * Base error class for all WaspBot-related errors.
 */
export class WaspBotError extends Error {
  public readonly code?: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'WaspBotError';
    if (code !== undefined) this.code = code;
    if (context !== undefined) this.context = context;
  }
}

/**
 * Error specifically for connector-related issues.
 */
export class ConnectorError extends WaspBotError {
  constructor(message: string, exchangeId: string, context?: Record<string, unknown>) {
    super(message, 'CONNECTOR_ERROR', { exchangeId, ...context });
    this.name = 'ConnectorError';
  }
}

/**
 * Error specifically for strategy-related issues.
 */
export class StrategyError extends WaspBotError {
  constructor(message: string, strategyId: string, context?: Record<string, unknown>) {
    super(message, 'STRATEGY_ERROR', { strategyId, ...context });
    this.name = 'StrategyError';
  }
}

/**
 * Error specifically for order-related issues.
 */
export class OrderError extends WaspBotError {
  constructor(message: string, orderId?: string, context?: Record<string, unknown>) {
    super(message, 'ORDER_ERROR', { orderId, ...context });
    this.name = 'OrderError';
  }
}

// Utility types
/**
 * Makes specified keys in an interface optional.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
/**
 * Makes specified keys in an interface required.
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
/**
 * Makes all properties in an object and its sub-objects optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Configuration validation result
/**
 * Represents the result of a configuration or data validation process.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Generic callback types
/**
 * Generic callback function for events.
 */
export type EventCallback<T = any> = (data: T) => void;
/**
 * Generic asynchronous callback function for events.
 */
export type AsyncEventCallback<T = any> = (data: T) => Promise<void>;
/**
 * Callback function for error handling.
 */
export type ErrorCallback = (error: Error) => void;

// Health check result
/**
 * Represents the health status of a component or the system.
 */
export interface HealthStatus {
  isHealthy: boolean;
  component: string;
  message?: string;
  lastChecked: Timestamp;
  details?: Record<string, unknown>;
}

// Performance metrics
/**
 * Represents performance metrics for a component or the system.
 */
export interface PerformanceMetrics {
  timestamp: Timestamp;
  cpu: number;
  memory: number;
  latency?: number;
  throughput?: number;
  errorRate?: number;
}

// Fee structure for trades and orders
export interface Fee {
  /** Fee amount */
  amount: DecimalAmount;

  /** Asset that the fee is paid in */
  asset: string;

  /** Fee type (maker, taker, gas, etc.) */
  type: 'MAKER' | 'TAKER' | 'GAS' | 'WITHDRAWAL' | 'DEPOSIT' | 'FUNDING';

  /** Whether fee is added to cost or deducted from proceeds */
  addedToCost: boolean;
}
