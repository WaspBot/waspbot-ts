/**
 * Order Management System Interfaces for WaspBot-TS
 *
 * This module provides the core service interfaces for order lifecycle management,
 * portfolio tracking, and integration with trading strategies. It's designed to mirror
 * Hummingbot's order management architecture while leveraging TypeScript's type system.
 *
 * Key concepts:
 * - OrderManager: Core order lifecycle and execution tracking
 * - PortfolioManager: Position and balance aggregation service
 * - OrderTracker: Active order monitoring and state management
 * - Integration Points: Strategy and connector service interfaces
 *
 * Issue #7: Order Management Services
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
  ExchangeId,
  WaspBotError,
} from './common';

import {
  OrderState,
  PositionAction,
  CreateOrderRequest,
  InFlightOrder,
  OrderUpdate,
  TradeUpdate,
  validateCreateOrderRequest,
} from './orders-basic';

import {
  Position,
  Balance,
  Portfolio,
  BalanceUpdate,
  PortfolioPerformance,
  PortfolioRisk,
  PortfolioSnapshot,
} from './orders-portfolio';

// ============================================================================
// Order Manager Interface
// ============================================================================

/**
 * Core order management service interface.
 * Handles order lifecycle from creation to completion with comprehensive tracking.
 */
export interface OrderManager {
  // ========== Order Lifecycle Management ==========

  /**
   * Place a new order with validation and tracking.
   */
  placeOrder(request: CreateOrderRequest): Promise<OrderPlacementResult>;

  /**
   * Cancel an existing order.
   */
  cancelOrder(clientOrderId: string): Promise<OrderCancellationResult>;

  /**
   * Cancel multiple orders atomically.
   */
  cancelOrders(clientOrderIds: string[]): Promise<OrderCancellationResult[]>;

  /**
   * Cancel all orders for a specific trading pair.
   */
  cancelAllOrders(tradingPair?: TradingPair): Promise<OrderCancellationResult[]>;

  /**
   * Modify an existing order (price and/or quantity).
   */
  modifyOrder(
    clientOrderId: string,
    modification: OrderModification
  ): Promise<OrderModificationResult>;

  // ========== Order Tracking and Queries ==========

  /**
   * Get order by client order ID.
   */
  getOrder(clientOrderId: string): Promise<InFlightOrder | null>;

  /**
   * Get order by exchange order ID.
   */
  getOrderByExchangeId(exchangeOrderId: string): Promise<InFlightOrder | null>;

  /**
   * Get all orders matching the specified criteria.
   */
  getOrders(filter?: OrderFilter): Promise<InFlightOrder[]>;

  /**
   * Get all active (non-terminal) orders.
   */
  getActiveOrders(): Promise<InFlightOrder[]>;

  /**
   * Get orders for a specific trading pair.
   */
  getOrdersForPair(tradingPair: TradingPair): Promise<InFlightOrder[]>;

  /**
   * Get orders for a specific exchange.
   */
  getOrdersForExchange(exchangeId: ExchangeId): Promise<InFlightOrder[]>;

  // ========== Order State Management ==========

  /**
   * Update order state based on exchange event.
   */
  updateOrderState(update: OrderUpdate): Promise<void>;

  /**
   * Process trade fill event.
   */
  processTradeUpdate(trade: TradeUpdate): Promise<void>;

  /**
   * Mark order as failed with reason.
   */
  markOrderFailed(clientOrderId: string, reason: string): Promise<void>;

  /**
   * Start tracking a new order.
   */
  startTracking(order: InFlightOrder): Promise<void>;

  /**
   * Stop tracking an order (terminal state reached).
   */
  stopTracking(clientOrderId: string): Promise<void>;

  // ========== Order Analytics and Reporting ==========

  /**
   * Get order execution statistics.
   */
  getExecutionStats(period?: TimePeriod): Promise<OrderExecutionStats>;

  /**
   * Get order performance metrics.
   */
  getPerformanceMetrics(): Promise<OrderPerformanceMetrics>;

  /**
   * Get orders that have been lost (no updates for extended period).
   */
  getLostOrders(): Promise<InFlightOrder[]>;

  /**
   * Reconcile orders with exchange state.
   */
  reconcileOrders(exchangeId: ExchangeId): Promise<OrderReconciliationResult>;
}

/**
 * Result of order placement operation.
 */
export interface OrderPlacementResult {
  /** Whether the placement was successful */
  success: boolean;

  /** Client order ID assigned */
  clientOrderId: string;

  /** Exchange order ID (if immediately available) */
  exchangeOrderId?: string;

  /** Error message if placement failed */
  error?: string;

  /** Additional context or warnings */
  warnings?: string[];

  /** Timestamp of placement attempt */
  timestamp: Timestamp;
}

/**
 * Result of order cancellation operation.
 */
export interface OrderCancellationResult {
  /** Whether the cancellation was successful */
  success: boolean;

  /** Client order ID */
  clientOrderId: string;

  /** Cancellation request ID */
  cancellationId?: string;

  /** Error message if cancellation failed */
  error?: string;

  /** Current order state after cancellation attempt */
  currentState: OrderState;

  /** Timestamp of cancellation attempt */
  timestamp: Timestamp;
}

/**
 * Order modification request.
 */
export interface OrderModification {
  /** New price (if changing) */
  newPrice?: Price;

  /** New quantity (if changing) */
  newQuantity?: Quantity;

  /** New time in force (if changing) */
  newTimeInForce?: TimeInForce;

  /** Reason for modification */
  reason?: string;
}

/**
 * Result of order modification operation.
 */
export interface OrderModificationResult {
  /** Whether the modification was successful */
  success: boolean;

  /** Client order ID */
  clientOrderId: string;

  /** New exchange order ID (if order was replaced) */
  newExchangeOrderId?: string;

  /** Error message if modification failed */
  error?: string;

  /** Order state after modification */
  currentState: OrderState;

  /** Timestamp of modification attempt */
  timestamp: Timestamp;
}

// ============================================================================
// Portfolio Manager Interface
// ============================================================================

/**
 * Portfolio management service interface.
 * Aggregates positions and balances across exchanges with comprehensive analytics.
 */
export interface PortfolioManager {
  // ========== Portfolio State Management ==========

  /**
   * Get current portfolio state.
   */
  getPortfolio(): Promise<Portfolio>;

  /**
   * Get portfolio for specific exchange.
   */
  getPortfolioForExchange(exchangeId: ExchangeId): Promise<Portfolio>;

  /**
   * Refresh portfolio data from all exchanges.
   */
  refreshPortfolio(): Promise<void>;

  /**
   * Subscribe to portfolio updates.
   */
  subscribeToUpdates(callback: PortfolioUpdateCallback): string;

  /**
   * Unsubscribe from portfolio updates.
   */
  unsubscribe(subscriptionId: string): void;

  // ========== Position Management ==========

  /**
   * Get all current positions.
   */
  getPositions(): Promise<Position[]>;

  /**
   * Get position for specific symbol.
   */
  getPosition(symbol: string): Promise<Position | null>;

  /**
   * Get positions for specific exchange.
   */
  getPositionsForExchange(exchangeId: ExchangeId): Promise<Position[]>;

  /**
   * Close position (market order).
   */
  closePosition(symbol: string, portion?: Decimal): Promise<OrderPlacementResult>;

  // ========== Balance Management ==========

  /**
   * Get all account balances.
   */
  getBalances(): Promise<Balance[]>;

  /**
   * Get balance for specific asset.
   */
  getBalance(asset: string, exchangeId?: ExchangeId): Promise<Balance | null>;

  /**
   * Get available balance for trading.
   */
  getAvailableBalance(asset: string, exchangeId?: ExchangeId): Promise<Quantity>;

  /**
   * Process balance update event.
   */
  processBalanceUpdate(update: BalanceUpdate): Promise<void>;

  // ========== Portfolio Analytics ==========

  /**
   * Get portfolio performance metrics.
   */
  getPerformance(period?: TimePeriod): Promise<PortfolioPerformance>;

  /**
   * Get portfolio risk assessment.
   */
  getRiskAssessment(): Promise<PortfolioRisk>;

  /**
   * Create portfolio snapshot.
   */
  createSnapshot(description?: string): Promise<PortfolioSnapshot>;

  /**
   * Get historical snapshots.
   */
  getSnapshots(filter?: SnapshotFilter): Promise<PortfolioSnapshot[]>;

  /**
   * Calculate portfolio value in base currency.
   */
  calculatePortfolioValue(baseCurrency?: string): Promise<Decimal>;
}

/**
 * Callback for portfolio update notifications.
 */
export type PortfolioUpdateCallback = (portfolio: Portfolio) => void;

// ============================================================================
// Order Tracker Interface
// ============================================================================

/**
 * Order tracking service interface.
 * Monitors active orders and manages order state transitions.
 */
export interface OrderTracker {
  // ========== Active Order Tracking ==========

  /**
   * Get all actively tracked orders.
   */
  getTrackedOrders(): Map<string, InFlightOrder>;

  /**
   * Get orders by market/trading pair.
   */
  getOrdersForMarket(tradingPair: TradingPair): InFlightOrder[];

  /**
   * Get active limit orders.
   */
  getActiveLimitOrders(): Array<[ExchangeId, InFlightOrder]>;

  /**
   * Get active market orders.
   */
  getActiveMarketOrders(): Array<[ExchangeId, InFlightOrder]>;

  /**
   * Check if order is in flight for cancellation.
   */
  hasInFlightCancel(clientOrderId: string): boolean;

  // ========== Order Lifecycle Tracking ==========

  /**
   * Start tracking a limit order.
   */
  startTrackingLimitOrder(
    exchangeId: ExchangeId,
    tradingPair: TradingPair,
    clientOrderId: string,
    side: TradingSide,
    price: Price,
    quantity: Quantity
  ): Promise<void>;

  /**
   * Start tracking a market order.
   */
  startTrackingMarketOrder(
    exchangeId: ExchangeId,
    tradingPair: TradingPair,
    clientOrderId: string,
    side: TradingSide,
    quantity: Quantity
  ): Promise<void>;

  /**
   * Stop tracking an order.
   */
  stopTrackingOrder(clientOrderId: string): Promise<void>;

  /**
   * Process order update event.
   */
  processOrderUpdate(update: OrderUpdate): Promise<void>;

  /**
   * Process trade execution event.
   */
  processTradeExecution(trade: TradeUpdate): Promise<void>;

  // ========== Order State Queries ==========

  /**
   * Get order by client ID.
   */
  getTrackedOrder(clientOrderId: string): InFlightOrder | null;

  /**
   * Get order by exchange ID.
   */
  getTrackedOrderByExchangeId(exchangeOrderId: string): InFlightOrder | null;

  /**
   * Check if order exists and is being tracked.
   */
  isOrderTracked(clientOrderId: string): boolean;

  /**
   * Get orders in specific state.
   */
  getOrdersByState(state: OrderState): InFlightOrder[];

  // ========== Order Maintenance ==========

  /**
   * Clean up completed or expired orders.
   */
  cleanupOrders(): Promise<void>;

  /**
   * Restore order tracking from persistent storage.
   */
  restoreOrderTracking(serializedOrders: Record<string, unknown>[]): Promise<void>;

  /**
   * Serialize order tracking state.
   */
  serializeOrderTracking(): Record<string, unknown>[];
}

// ============================================================================
// Strategy Integration Interfaces
// ============================================================================

/**
 * Interface for trading strategies to interact with order management.
 */
export interface StrategyOrderInterface {
  /**
   * Place buy order through strategy.
   */
  buy(
    exchangeId: ExchangeId,
    tradingPair: TradingPair,
    amount: Quantity,
    orderType?: OrderType,
    price?: Price,
    timeInForce?: TimeInForce,
    positionAction?: PositionAction
  ): Promise<string>;

  /**
   * Place sell order through strategy.
   */
  sell(
    exchangeId: ExchangeId,
    tradingPair: TradingPair,
    amount: Quantity,
    orderType?: OrderType,
    price?: Price,
    timeInForce?: TimeInForce,
    positionAction?: PositionAction
  ): Promise<string>;

  /**
   * Cancel order through strategy.
   */
  cancelOrder(exchangeId: ExchangeId, clientOrderId: string): Promise<void>;

  /**
   * Get strategy's active orders.
   */
  getActiveOrders(): InFlightOrder[];

  /**
   * Get strategy's order by ID.
   */
  getOrder(clientOrderId: string): InFlightOrder | null;
}

/**
 * Interface for connectors to report order status.
 */
export interface ConnectorOrderInterface {
  /**
   * Report order creation to order manager.
   */
  reportOrderCreated(order: InFlightOrder): Promise<void>;

  /**
   * Report order update to order manager.
   */
  reportOrderUpdate(update: OrderUpdate): Promise<void>;

  /**
   * Report trade execution to order manager.
   */
  reportTradeExecution(trade: TradeUpdate): Promise<void>;

  /**
   * Report order failure to order manager.
   */
  reportOrderFailure(clientOrderId: string, reason: string): Promise<void>;

  /**
   * Get orders assigned to this connector.
   */
  getConnectorOrders(): InFlightOrder[];
}

// ============================================================================
// Order Filtering and Querying
// ============================================================================

/**
 * Filter criteria for order queries.
 */
export interface OrderFilter {
  /** Filter by exchange */
  exchangeId?: ExchangeId;

  /** Filter by trading pair */
  tradingPair?: TradingPair;

  /** Filter by order state */
  state?: OrderState;

  /** Filter by order type */
  orderType?: OrderType;

  /** Filter by trading side */
  side?: TradingSide;

  /** Filter by position action */
  positionAction?: PositionAction;

  /** Filter by creation time range */
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;

  /** Filter by update time range */
  updatedAfter?: Timestamp;
  updatedBefore?: Timestamp;

  /** Limit number of results */
  limit?: number;

  /** Sort order */
  sortBy?: OrderSortField;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * Fields available for sorting orders.
 */
export enum OrderSortField {
  CREATION_TIME = 'CREATION_TIME',
  UPDATE_TIME = 'UPDATE_TIME',
  AMOUNT = 'AMOUNT',
  PRICE = 'PRICE',
  EXECUTED_AMOUNT = 'EXECUTED_AMOUNT',
  STATE = 'STATE',
}

/**
 * Filter criteria for portfolio snapshots.
 */
export interface SnapshotFilter {
  /** Filter by time range */
  startDate?: Timestamp;
  endDate?: Timestamp;

  /** Filter by snapshot type */
  snapshotType?: string;

  /** Limit number of results */
  limit?: number;
}

// ============================================================================
// Time Period Definitions
// ============================================================================

/**
 * Time period for analytics and reporting.
 */
export interface TimePeriod {
  /** Period type */
  type: TimePeriodType;

  /** Start timestamp */
  start: Timestamp;

  /** End timestamp */
  end: Timestamp;

  /** Period description */
  description?: string;
}

/**
 * Standard time period types.
 */
export enum TimePeriodType {
  CUSTOM = 'CUSTOM',
  LAST_HOUR = 'LAST_HOUR',
  LAST_DAY = 'LAST_DAY',
  LAST_WEEK = 'LAST_WEEK',
  LAST_MONTH = 'LAST_MONTH',
  LAST_QUARTER = 'LAST_QUARTER',
  LAST_YEAR = 'LAST_YEAR',
  INCEPTION = 'INCEPTION',
}

// ============================================================================
// Performance and Analytics Types
// ============================================================================

/**
 * Order execution statistics for performance analysis.
 */
export interface OrderExecutionStats {
  /** Time period for these stats */
  period: TimePeriod;

  /** Total number of orders placed */
  totalOrders: number;

  /** Number of orders filled */
  filledOrders: number;

  /** Number of orders cancelled */
  cancelledOrders: number;

  /** Number of orders failed */
  failedOrders: number;

  /** Fill rate percentage */
  fillRate: Decimal;

  /** Average time to fill (milliseconds) */
  averageFillTime: number;

  /** Average slippage */
  averageSlippage: Decimal;

  /** Total volume traded */
  totalVolume: Decimal;

  /** Total fees paid */
  totalFees: Decimal;

  /** Fee rate as percentage of volume */
  feeRate: Decimal;

  /** Orders by type */
  ordersByType: Map<OrderType, number>;

  /** Orders by side */
  ordersBySide: Map<TradingSide, number>;

  /** Average order size */
  averageOrderSize: Decimal;

  /** Largest order */
  largestOrder: Decimal;

  /** Smallest order */
  smallestOrder: Decimal;
}

/**
 * Order performance metrics for optimization.
 */
export interface OrderPerformanceMetrics {
  /** Current tracking period */
  trackingPeriod: TimePeriod;

  /** Order success rate */
  successRate: Decimal;

  /** Average order latency (placement to confirmation) */
  averageLatency: number;

  /** 95th percentile latency */
  p95Latency: number;

  /** 99th percentile latency */
  p99Latency: number;

  /** Order rejection rate */
  rejectionRate: Decimal;

  /** Timeout rate */
  timeoutRate: Decimal;

  /** Exchange downtime impact */
  downtimeImpact: Decimal;

  /** Slippage analysis */
  slippageAnalysis: SlippageAnalysis;

  /** Market impact analysis */
  marketImpactAnalysis: MarketImpactAnalysis;

  /** Order book timing analysis */
  timingAnalysis: OrderTimingAnalysis;
}

/**
 * Analysis of order slippage.
 */
export interface SlippageAnalysis {
  /** Average slippage */
  averageSlippage: Decimal;

  /** Median slippage */
  medianSlippage: Decimal;

  /** 95th percentile slippage */
  p95Slippage: Decimal;

  /** Maximum slippage observed */
  maxSlippage: Decimal;

  /** Slippage by order size */
  slippageBySize: Map<string, Decimal>;

  /** Slippage by trading pair */
  slippageByPair: Map<TradingPair, Decimal>;

  /** Positive slippage rate */
  positiveSlippageRate: Decimal;
}

/**
 * Analysis of market impact from orders.
 */
export interface MarketImpactAnalysis {
  /** Average market impact */
  averageImpact: Decimal;

  /** Impact by order size */
  impactBySize: Map<string, Decimal>;

  /** Impact by trading pair */
  impactByPair: Map<TradingPair, Decimal>;

  /** Recovery time analysis */
  recoveryTimeAnalysis: Map<string, number>;

  /** Liquidity utilization */
  liquidityUtilization: Decimal;
}

/**
 * Analysis of order timing relative to market conditions.
 */
export interface OrderTimingAnalysis {
  /** Fill rate by time of day */
  fillRateByHour: Map<number, Decimal>;

  /** Average spread at order placement */
  averageSpreadAtPlacement: Decimal;

  /** Order book depth at placement */
  averageDepthAtPlacement: Decimal;

  /** Volatility impact on execution */
  volatilityImpact: Decimal;

  /** Optimal timing recommendations */
  timingRecommendations: string[];
}

// ============================================================================
// Order Reconciliation Types
// ============================================================================

/**
 * Result of order reconciliation with exchange.
 */
export interface OrderReconciliationResult {
  /** Exchange reconciled */
  exchangeId: ExchangeId;

  /** Reconciliation timestamp */
  timestamp: Timestamp;

  /** Total orders checked */
  totalOrdersChecked: number;

  /** Orders that matched */
  matchedOrders: number;

  /** Orders with discrepancies */
  discrepancies: OrderDiscrepancy[];

  /** Missing orders (in system but not on exchange) */
  missingOrders: string[];

  /** Unexpected orders (on exchange but not in system) */
  unexpectedOrders: ExchangeOrderInfo[];

  /** Orders updated during reconciliation */
  updatedOrders: string[];

  /** Reconciliation success rate */
  successRate: Decimal;
}

/**
 * Discrepancy found during order reconciliation.
 */
export interface OrderDiscrepancy {
  /** Client order ID */
  clientOrderId: string;

  /** Exchange order ID */
  exchangeOrderId?: string;

  /** Type of discrepancy */
  discrepancyType: DiscrepancyType;

  /** System state */
  systemState: OrderState;

  /** Exchange state */
  exchangeState: string;

  /** System order info */
  systemOrder: InFlightOrder;

  /** Exchange order info */
  exchangeOrder?: ExchangeOrderInfo;

  /** Recommended action */
  recommendedAction: ReconciliationAction;

  /** Description of discrepancy */
  description: string;
}

/**
 * Types of discrepancies that can be found.
 */
export enum DiscrepancyType {
  STATE_MISMATCH = 'STATE_MISMATCH',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  PRICE_MISMATCH = 'PRICE_MISMATCH',
  MISSING_FILLS = 'MISSING_FILLS',
  EXTRA_FILLS = 'EXTRA_FILLS',
  EXECUTION_MISMATCH = 'EXECUTION_MISMATCH',
}

/**
 * Actions that can be taken during reconciliation.
 */
export enum ReconciliationAction {
  UPDATE_SYSTEM_STATE = 'UPDATE_SYSTEM_STATE',
  CANCEL_ORPHANED_ORDER = 'CANCEL_ORPHANED_ORDER',
  CREATE_MISSING_ORDER = 'CREATE_MISSING_ORDER',
  MARK_AS_LOST = 'MARK_AS_LOST',
  INVESTIGATE_MANUALLY = 'INVESTIGATE_MANUALLY',
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
}

/**
 * Order information from exchange.
 */
export interface ExchangeOrderInfo {
  /** Exchange order ID */
  exchangeOrderId: string;

  /** Client order ID (if available) */
  clientOrderId?: string;

  /** Trading pair */
  tradingPair: TradingPair;

  /** Order side */
  side: TradingSide;

  /** Order type */
  orderType: OrderType;

  /** Order amount */
  amount: Quantity;

  /** Order price */
  price?: Price;

  /** Current state */
  state: string;

  /** Amount executed */
  executedAmount: Quantity;

  /** Average execution price */
  averagePrice?: Price;

  /** Creation timestamp */
  creationTime: Timestamp;

  /** Last update timestamp */
  updateTime: Timestamp;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown by order management operations.
 */
export class OrderManagerError extends WaspBotError {
  constructor(message: string, orderId?: string, context?: Record<string, unknown>) {
    super(message, 'ORDER_MANAGER_ERROR', { orderId, ...context });
    this.name = 'OrderManagerError';
  }
}

/**
 * Error thrown by portfolio management operations.
 */
export class PortfolioManagerError extends WaspBotError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PORTFOLIO_MANAGER_ERROR', context);
    this.name = 'PortfolioManagerError';
  }
}

/**
 * Error thrown by order tracking operations.
 */
export class OrderTrackerError extends WaspBotError {
  constructor(message: string, orderId?: string, context?: Record<string, unknown>) {
    super(message, 'ORDER_TRACKER_ERROR', { orderId, ...context });
    this.name = 'OrderTrackerError';
  }
}

// ============================================================================
// Utility Type Definitions
// ============================================================================

/**
 * Type for utility functions that will be implemented in the core modules.
 */
export type CreateTimePeriodFunction = (
  type: TimePeriodType,
  customStart?: Timestamp,
  customEnd?: Timestamp
) => TimePeriod;

/**
 * Type for order filter matching function.
 */
export type OrderFilterFunction = (order: InFlightOrder, filter: OrderFilter) => boolean;

/**
 * Type for order sorting function.
 */
export type OrderSortFunction = (
  orders: InFlightOrder[],
  sortBy: OrderSortField,
  direction?: 'ASC' | 'DESC'
) => InFlightOrder[];

// ============================================================================
// Export Types for Convenient Importing
// ============================================================================

export default {
  // Enums
  OrderSortField,
  TimePeriodType,
  DiscrepancyType,
  ReconciliationAction,

  // Error Classes
  OrderManagerError,
  PortfolioManagerError,
  OrderTrackerError,
};
