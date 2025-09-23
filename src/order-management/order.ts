/**
 * Core order types and lifecycle management for WaspBot-TS
 *
 * This module contains the fundamental order structures and state management
 * based on Hummingbot's proven order lifecycle architecture.
 *
 * Issue #5: Core Order Types and Lifecycle
 * Part of Phase 3 - Order Management Types
 */

import { Decimal } from 'decimal.js';
import {
  Price,
  Quantity,
  Timestamp,
  TradingSide,
  OrderType,
  TimeInForce,
  TradingPair,
  Fee,
  WaspBotError,
} from '../types/common.js';

// ============================================================================
// Order State Management
// ============================================================================

/**
 * Represents the current state of an order in its lifecycle.
 * Based on Hummingbot's OrderState enum with additional states for DEX integration.
 */
export enum OrderState {
  /** Order created locally but not yet sent to exchange */
  PENDING_CREATE = 'PENDING_CREATE',

  /** Order successfully placed and active on exchange */
  OPEN = 'OPEN',

  /** Cancel request sent but not yet confirmed */
  PENDING_CANCEL = 'PENDING_CANCEL',

  /** Order successfully cancelled */
  CANCELED = 'CANCELED',

  /** Order partially executed, still active */
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',

  /** Order completely filled */
  FILLED = 'FILLED',

  /** Order failed to be placed or processed */
  FAILED = 'FAILED',

  /** For DEX orders: waiting for approval transaction */
  PENDING_APPROVAL = 'PENDING_APPROVAL',

  /** For DEX orders: approval transaction confirmed */
  APPROVED = 'APPROVED',

  /** For DEX orders: order transaction created */
  CREATED = 'CREATED',

  /** For DEX orders: order transaction completed */
  COMPLETED = 'COMPLETED',
}

/**
 * Position action for derivative trading.
 * Indicates whether the order opens or closes a position.
 */
export enum PositionAction {
  /** Open a new position */
  OPEN = 'OPEN',

  /** Close an existing position */
  CLOSE = 'CLOSE',

  /** No specific position action (spot trading) */
  NIL = 'NIL',
}

/**
 * Position side for derivative trading.
 */
export enum PositionSide {
  /** Long position (bullish) */
  LONG = 'LONG',

  /** Short position (bearish) */
  SHORT = 'SHORT',

  /** Both long and short positions allowed */
  BOTH = 'BOTH',
}

/**
 * Position mode for derivative trading.
 */
export enum PositionMode {
  /** Hedge mode: separate long/short positions */
  HEDGE = 'HEDGE',

  /** One-way mode: net position only */
  ONEWAY = 'ONEWAY',
}

// ============================================================================
// Core Order Interfaces
// ============================================================================

/**
 * Basic order information for order creation requests.
 * This is what strategies use to place orders.
 */
export interface CreateOrderRequest {
  /** Unique identifier for this order */
  readonly clientOrderId: string;

  /** Trading pair for this order */
  readonly tradingPair: TradingPair;

  /** Order type (MARKET, LIMIT, etc.) */
  readonly orderType: OrderType;

  /** Side of the trade (BUY or SELL) */
  readonly side: TradingSide;

  /** Order quantity */
  readonly amount: Quantity;

  /** Order price (required for limit orders) */
  readonly price?: Price;

  /** Time in force policy */
  readonly timeInForce?: TimeInForce;

  /** Leverage for derivative orders */
  readonly leverage?: number;

  /** Position action for derivative orders */
  readonly position?: PositionAction;

  /** Additional parameters for specific exchanges */
  readonly extraParams?: Record<string, unknown>;
}

/**
 * Complete order information including exchange data.
 * This represents an order as stored in the system with full lifecycle tracking.
 */
export interface Order {
  /** Client-generated unique order identifier */
  readonly clientOrderId: string;

  /** Exchange-generated order identifier (set when order is accepted) */
  exchangeOrderId?: string;

  /** Trading pair for this order */
  readonly tradingPair: TradingPair;

  /** Order type */
  readonly orderType: OrderType;

  /** Trading side */
  readonly side: TradingSide;

  /** Original order amount */
  readonly amount: Quantity;

  /** Order price (undefined for market orders) */
  readonly price?: Price;

  /** Time in force policy */
  readonly timeInForce: TimeInForce;

  /** Current order state */
  state: OrderState;

  /** When the order was created (Unix timestamp in milliseconds) */
  readonly creationTimestamp: Timestamp;

  /** Last update timestamp */
  lastUpdateTimestamp: Timestamp;

  /** Amount filled so far */
  executedAmountBase: Quantity;

  /** Quote amount filled so far */
  executedAmountQuote: Quantity;

  /** Average execution price */
  averageExecutedPrice?: Price;

  /** Individual trade fills */
  readonly fills: Map<string, TradeUpdate>;

  /** Leverage (for derivative orders) */
  readonly leverage: number;

  /** Position action (for derivative orders) */
  readonly position: PositionAction;

  /** Total fees paid */
  readonly fees: Fee[];
}

/**
 * Represents an order that is actively being tracked in the system.
 * This is the runtime representation with additional tracking capabilities.
 */
export interface InFlightOrder extends Order {
  /** Base asset symbol */
  readonly baseAsset: string;

  /** Quote asset symbol */
  readonly quoteAsset: string;

  /** Whether the order is in pending create state */
  readonly isPendingCreate: boolean;

  /** Whether the order is pending cancel confirmation */
  readonly isPendingCancelConfirmation: boolean;

  /** Whether the order is currently open */
  readonly isOpen: boolean;

  /** Whether the order is completely done (filled, cancelled, or failed) */
  readonly isDone: boolean;

  /** Whether the order is completely filled */
  readonly isFilled: boolean;

  /** Whether the order failed */
  readonly isFailure: boolean;

  /** Whether the order was cancelled */
  readonly isCancelled: boolean;

  /** Promise that resolves when order gets exchange ID */
  readonly exchangeOrderIdPromise: Promise<string>;

  /** Promise that resolves when order is completely filled */
  readonly completelyFilledPromise: Promise<void>;

  /** Promise that resolves when order is processed by exchange */
  readonly processedByExchangePromise: Promise<void>;
}

// ============================================================================
// Order Updates and Events
// ============================================================================

/**
 * Order status update from exchange or internal system.
 * Used to track order state changes.
 */
export interface OrderUpdate {
  /** Client order identifier */
  clientOrderId?: string;

  /** Exchange order identifier */
  exchangeOrderId?: string;

  /** Trading pair */
  tradingPair: TradingPair;

  /** Update timestamp */
  updateTimestamp: Timestamp;

  /** New order state */
  newState: OrderState;

  /** Additional update information */
  miscUpdates?: Record<string, unknown>;
}

/**
 * Trade execution update with fill information.
 * Represents a single trade/fill event.
 */
export interface TradeUpdate {
  /** Unique trade identifier */
  tradeId: string;

  /** Client order identifier */
  clientOrderId: string;

  /** Exchange order identifier */
  exchangeOrderId: string;

  /** Trading pair */
  tradingPair: TradingPair;

  /** Trade execution timestamp */
  fillTimestamp: Timestamp;

  /** Fill price */
  fillPrice: Price;

  /** Base amount filled */
  fillBaseAmount: Quantity;

  /** Quote amount filled */
  fillQuoteAmount: Quantity;

  /** Trade fee */
  fee: Fee;

  /** Whether this was a taker trade */
  isTaker: boolean;
}

// ============================================================================
// Order State Machine and Validation
// ============================================================================

/**
 * Valid order state transitions.
 * Defines which state changes are allowed in the order lifecycle.
 */
export const ORDER_STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.PENDING_CREATE]: [
    OrderState.OPEN,
    OrderState.FAILED,
    OrderState.PENDING_APPROVAL, // DEX flow
  ],
  [OrderState.PENDING_APPROVAL]: [OrderState.APPROVED, OrderState.FAILED],
  [OrderState.APPROVED]: [OrderState.CREATED, OrderState.FAILED],
  [OrderState.CREATED]: [OrderState.OPEN, OrderState.COMPLETED, OrderState.FAILED],
  [OrderState.OPEN]: [
    OrderState.PARTIALLY_FILLED,
    OrderState.FILLED,
    OrderState.PENDING_CANCEL,
    OrderState.CANCELED,
    OrderState.FAILED,
  ],
  [OrderState.PARTIALLY_FILLED]: [
    OrderState.FILLED,
    OrderState.PENDING_CANCEL,
    OrderState.CANCELED,
    OrderState.FAILED,
  ],
  [OrderState.PENDING_CANCEL]: [
    OrderState.CANCELED,
    OrderState.FILLED, // Order can fill while cancel is pending
    OrderState.FAILED,
  ],
  [OrderState.FILLED]: [], // Terminal state
  [OrderState.CANCELED]: [], // Terminal state
  [OrderState.FAILED]: [], // Terminal state
  [OrderState.COMPLETED]: [], // Terminal state (DEX)
};

/**
 * Check if an order state transition is valid.
 */
export function isValidStateTransition(from: OrderState, to: OrderState): boolean {
  return ORDER_STATE_TRANSITIONS[from].includes(to);
}

/**
 * Get all possible next states for an order.
 */
export function getValidNextStates(currentState: OrderState): OrderState[] {
  return ORDER_STATE_TRANSITIONS[currentState];
}

/**
 * Check if an order state is terminal (no further transitions allowed).
 */
export function isTerminalState(state: OrderState): boolean {
  return ORDER_STATE_TRANSITIONS[state].length === 0;
}

/**
 * Check if an order is in an active trading state.
 */
export function isActiveOrderState(state: OrderState): boolean {
  return [
    OrderState.PENDING_CREATE,
    OrderState.OPEN,
    OrderState.PARTIALLY_FILLED,
    OrderState.PENDING_CANCEL,
    OrderState.PENDING_APPROVAL,
    OrderState.APPROVED,
    OrderState.CREATED,
  ].includes(state);
}

// ============================================================================
// Order Utility Functions
// ============================================================================

/**
 * Extract base and quote assets from trading pair.
 */
export function parseTradingPair(tradingPair: TradingPair): { base: string; quote: string } {
  const parts = tradingPair.split('-');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new WaspBotError(`Invalid trading pair format: ${tradingPair}`, 'INVALID_TRADING_PAIR');
  }
  return { base: parts[0], quote: parts[1] };
}

/**
 * Calculate order completion percentage.
 */
export function calculateOrderCompletion(order: Order): Decimal {
  if (order.amount.isZero()) {
    return new Decimal(0);
  }
  return order.executedAmountBase.div(order.amount).mul(100);
}

/**
 * Calculate remaining order amount.
 */
export function calculateRemainingAmount(order: Order): Quantity {
  return order.amount.sub(order.executedAmountBase);
}

/**
 * Check if order requires a price (limit orders).
 */
export function requiresPrice(orderType: OrderType): boolean {
  return [
    OrderType.LIMIT,
    OrderType.LIMIT_MAKER,
    OrderType.STOP_LOSS_LIMIT,
    OrderType.TAKE_PROFIT_LIMIT,
  ].includes(orderType);
}

/**
 * Get order type display name.
 */
export function getOrderTypeDisplayName(orderType: OrderType): string {
  const displayNames: Record<OrderType, string> = {
    [OrderType.LIMIT]: 'Limit',
    [OrderType.MARKET]: 'Market',
    [OrderType.LIMIT_MAKER]: 'Limit Maker',
    [OrderType.STOP_LOSS]: 'Stop Loss',
    [OrderType.STOP_LOSS_LIMIT]: 'Stop Loss Limit',
    [OrderType.TAKE_PROFIT]: 'Take Profit',
    [OrderType.TAKE_PROFIT_LIMIT]: 'Take Profit Limit',
  };
  return displayNames[orderType] || orderType.toString();
}

// ============================================================================
// Export default object for convenient importing
// ============================================================================

export default {
  OrderState,
  PositionAction,
  PositionSide,
  PositionMode,
  ORDER_STATE_TRANSITIONS,
  isValidStateTransition,
  getValidNextStates,
  isTerminalState,
  isActiveOrderState,
  parseTradingPair,
  calculateOrderCompletion,
  calculateRemainingAmount,
  requiresPrice,
  getOrderTypeDisplayName,
};
