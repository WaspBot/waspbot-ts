/**
 * Common type definitions used throughout the WaspBot framework
 */

import { Decimal } from 'decimal.js';

// Core primitives
export type Timestamp = number; // Unix timestamp in milliseconds
export type ExchangeId = string;
export type TradingPair = string; // Format: "BTC-USDT"
export type OrderId = string;
export type TradeId = string;
export type StrategyId = string;

// Financial primitives using Decimal for precision
export type Price = Decimal;
export type Quantity = Decimal;
export type DecimalAmount = Decimal;

// Event types
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
export enum TradingSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

// Order types
export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  LIMIT_MAKER = 'LIMIT_MAKER',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_LIMIT = 'STOP_LOSS_LIMIT',
  TAKE_PROFIT = 'TAKE_PROFIT',
  TAKE_PROFIT_LIMIT = 'TAKE_PROFIT_LIMIT',
}

// Order status
export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  PENDING_CANCEL = 'PENDING_CANCEL',
}

// Time in force
export enum TimeInForce {
  GTC = 'GTC', // Good Till Canceled
  IOC = 'IOC', // Immediate Or Cancel
  FOK = 'FOK', // Fill Or Kill
}

// Connector status
export enum ConnectorStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

// Strategy status
export enum StrategyStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
}

// Log levels
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE',
}

// Base error class
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

// Specific error types
export class ConnectorError extends WaspBotError {
  constructor(message: string, exchangeId: string, context?: Record<string, unknown>) {
    super(message, 'CONNECTOR_ERROR', { exchangeId, ...context });
    this.name = 'ConnectorError';
  }
}

export class StrategyError extends WaspBotError {
  constructor(message: string, strategyId: string, context?: Record<string, unknown>) {
    super(message, 'STRATEGY_ERROR', { strategyId, ...context });
    this.name = 'StrategyError';
  }
}

export class OrderError extends WaspBotError {
  constructor(message: string, orderId?: string, context?: Record<string, unknown>) {
    super(message, 'ORDER_ERROR', { orderId, ...context });
    this.name = 'OrderError';
  }
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Configuration validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Generic callback types
export type EventCallback<T = any> = (data: T) => void;
export type AsyncEventCallback<T = any> = (data: T) => Promise<void>;
export type ErrorCallback = (error: Error) => void;

// Health check result
export interface HealthStatus {
  isHealthy: boolean;
  component: string;
  message?: string;
  lastChecked: Timestamp;
  details?: Record<string, unknown>;
}

// Performance metrics
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
