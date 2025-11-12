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
} from '../types/common';

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

  // Internal properties for managing promises
  _resolveFill?: (value: any) => void;
  _rejectFill?: (reason?: any) => void;
  _resolveCancel?: (value: any) => void;
  _rejectCancel?: (reason?: any) => void;
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
// Type Guards
// ============================================================================

export function isTradingSide(value: any): value is TradingSide {
  return Object.values(TradingSide).includes(value);
}

export function isOrderType(value: any): value is OrderType {
  return Object.values(OrderType).includes(value);
}

export function isOrderState(value: any): value is OrderState {
  return Object.values(OrderState).includes(value);
}

/**
 * Represents a generic order response from a connector before normalization.
 * This interface is designed to be flexible, accommodating various connector
 * specific field names and string representations for order properties.
 *
 * Connectors should map their raw order data to this generic structure
 * before passing it to the normalization helper.
 */
export interface ConnectorOrderResponse {
  /** Raw string representation of the order side (e.g., "BUY", "sell", "LONG") */
  side: string;
  /** Raw string representation of the order type (e.g., "LIMIT", "market", "STOP") */
  type: string;
  /** Raw string representation of the order status (e.g., "NEW", "FILLED", "CANCELED") */
  status: string;
  // Add other common fields that might need normalization or are generally present
  // For example:
  // clientOrderId?: string;
  // exchangeOrderId?: string;
  // tradingPair: string;
  // amount: string | number;
  // price?: string | number;
  // executedAmountBase?: string | number;
  // executedAmountQuote?: string | number;
  // creationTimestamp?: number;
  // lastUpdateTimestamp?: number;
  // fees?: any[];
}

/**
 * Normalizes a raw connector order response into WaspBot's standardized types.
 * This helper is crucial for ensuring consistency across different exchange
 * integrations by converting connector-specific string values for order
 * side, type, and status into the corresponding WaspBot enum values.
 *
 * @param rawResponse The raw order response object from a connector.
 * @returns An object with normalized `side`, `type`, and `state` properties.
 * @throws {WaspBotError} if any of the required fields (side, type, status)
 *   cannot be normalized to a valid WaspBot enum value.
 */
export function normalizeOrderResponse(rawResponse: ConnectorOrderResponse): {
  side: TradingSide;
  type: OrderType;
  state: OrderState;
} {
  const normalizedSide = normalizeTradingSide(rawResponse.side);
  const normalizedType = normalizeOrderType(rawResponse.type);
  const normalizedState = normalizeOrderState(rawResponse.status);

  return {
    side: normalizedSide,
    type: normalizedType,
    state: normalizedState,
  };
}

/**
 * Internal helper to normalize a string to a TradingSide enum.
 * @param sideString The raw string from the connector.
 * @returns The corresponding TradingSide enum value.
 * @throws {WaspBotError} if the string cannot be normalized.
 */
function normalizeTradingSide(sideString: string): TradingSide {
  const upperCaseSide = sideString.toUpperCase();
  if (upperCaseSide === 'BUY') return TradingSide.BUY;
  if (upperCaseSide === 'SELL') return TradingSide.SELL;
  throw new WaspBotError(`Unknown trading side: ${sideString}`, 'UNKNOWN_TRADING_SIDE');
}

/**
 * Internal helper to normalize a string to an OrderType enum.
 * @param typeString The raw string from the connector.
 * @returns The corresponding OrderType enum value.
 * @throws {WaspBotError} if the string cannot be normalized.
 */
function normalizeOrderType(typeString: string): OrderType {
  const upperCaseType = typeString.toUpperCase();
  switch (upperCaseType) {
    case 'LIMIT':
      return OrderType.LIMIT;
    case 'MARKET':
      return OrderType.MARKET;
    case 'LIMIT_MAKER':
      return OrderType.LIMIT_MAKER;
    case 'STOP_LOSS':
      return OrderType.STOP_LOSS;
    case 'STOP_LOSS_LIMIT':
      return OrderType.STOP_LOSS_LIMIT;
    case 'TAKE_PROFIT':
      return OrderType.TAKE_PROFIT;
    case 'TAKE_PROFIT_LIMIT':
      return OrderType.TAKE_PROFIT_LIMIT;
    default:
      throw new WaspBotError(`Unknown order type: ${typeString}`, 'UNKNOWN_ORDER_TYPE');
  }
}

/**
 * Internal helper to normalize a string to an OrderState enum.
 * This mapping might be more complex as connector statuses don't always
 * directly map to WaspBot's internal OrderState.
 * @param statusString The raw string from the connector.
 * @returns The corresponding OrderState enum value.
 * @throws {WaspBotError} if the string cannot be normalized.
 */
function normalizeOrderState(statusString: string): OrderState {
  const upperCaseStatus = statusString.toUpperCase();
  switch (upperCaseStatus) {
    case 'NEW':
    case 'PENDING_CREATE':
      return OrderState.PENDING_CREATE;
    case 'OPEN':
    case 'PARTIALLY_FILLED':
      return OrderState.OPEN; // Or PARTIALLY_FILLED if connector distinguishes
    case 'FILLED':
      return OrderState.FILLED;
    case 'CANCELED':
    case 'CANCELLED':
    case 'EXPIRED':
      return OrderState.CANCELED;
    case 'REJECTED':
    case 'FAILED':
      return OrderState.FAILED;
    case 'PENDING_CANCEL':
      return OrderState.PENDING_CANCEL;
    // DEX specific states, assuming connectors might return similar strings
    case 'PENDING_APPROVAL':
      return OrderState.PENDING_APPROVAL;
    case 'APPROVED':
      return OrderState.APPROVED;
    case 'CREATED':
      return OrderState.CREATED;
    case 'COMPLETED':
      return OrderState.COMPLETED;
    default:
      throw new WaspBotError(`Unknown order status: ${statusString}`, 'UNKNOWN_ORDER_STATUS');
  }
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

/**
 * Validates a CreateOrderRequest object.
 * Throws WaspBotError if validation fails.
 */
export function validateCreateOrderRequest(request: CreateOrderRequest): void {
  if (!request.clientOrderId || request.clientOrderId.trim() === '') {
    throw new WaspBotError('Client order ID is required.', 'INVALID_ORDER_INPUT', {
      field: 'clientOrderId',
    });
  }
  if (!request.tradingPair || request.tradingPair.trim() === '') {
    throw new WaspBotError('Trading pair is required.', 'INVALID_ORDER_INPUT', {
      field: 'tradingPair',
    });
  }
  if (!Object.values(OrderType).includes(request.orderType)) {
    throw new WaspBotError('Invalid order type.', 'INVALID_ORDER_INPUT', {
      field: 'orderType',
      value: request.orderType,
    });
  }
  if (!Object.values(TradingSide).includes(request.side)) {
    throw new WaspBotError('Invalid trading side.', 'INVALID_ORDER_INPUT', {
      field: 'side',
      value: request.side,
    });
  }
  if (!request.amount || request.amount.lte(0)) {
    throw new WaspBotError('Order amount must be greater than 0.', 'INVALID_ORDER_INPUT', {
      field: 'amount',
      value: request.amount?.toString(),
    });
  }

  if (requiresPrice(request.orderType)) {
    if (!request.price || request.price.lte(0)) {
      throw new WaspBotError(
        'Price is required and must be greater than 0 for this order type.',
        'INVALID_ORDER_INPUT',
        { field: 'price', value: request.price?.toString() }
      );
    }
  } else if (request.price !== undefined) {
    // For market orders, price should not be provided
    throw new WaspBotError(
      'Price should not be provided for market orders.',
      'INVALID_ORDER_INPUT',
      { field: 'price', value: request.price?.toString() }
    );
  }

  if (request.leverage !== undefined && request.leverage <= 0) {
    throw new WaspBotError('Leverage must be greater than 0 if provided.', 'INVALID_ORDER_INPUT', {
      field: 'leverage',
      value: request.leverage,
    });
  }

  if (request.position !== undefined && !Object.values(PositionAction).includes(request.position)) {
    throw new WaspBotError('Invalid position action.', 'INVALID_ORDER_INPUT', {
      field: 'position',
      value: request.position,
    });
  }
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
  isTradingSide,
  isOrderType,
  isOrderState,
  normalizeOrderResponse,
  parseTradingPair,
  calculateOrderCompletion,
  calculateRemainingAmount,
  requiresPrice,
  getOrderTypeDisplayName,
  validateCreateOrderRequest,
};
