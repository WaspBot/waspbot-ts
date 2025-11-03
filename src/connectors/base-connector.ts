/**
 * Base connector interface for WaspBot-TS
 * 
 * This abstract class defines the core interface that all exchange connectors
 * must implement. It provides standardized methods for trading operations,
 * market data subscriptions, and account management across different exchanges.
 */

import { EventEmitter } from 'events';
import { HealthStatus,
  ValidationResult,
} from '../types/common';
import { Ticker, Trade, TradingPairInfo } from '../market-data/ticker';
import { OrderBook } from '../market-data/order-book';
import { Order } from '../order-management/order';
import { clamp } from '../utils/math';

/**
 * Configuration interface for connector initialization
 */
export interface RateLimiterConfig {
  /** The maximum number of tokens the bucket can hold. */
  capacity: number;
  /** The number of tokens added to the bucket per interval. */
  fillRate: number;
  /** The time interval in milliseconds for adding tokens. */
  interval: number;
}

/**
 * Configuration interface for connector initialization
 */
export interface ConnectorConfig {
  /** Exchange identifier */
  exchangeId: ExchangeId;
  
  /** API credentials */
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  
  /** Connection settings */
  testnet?: boolean;
  rateLimit?: number; // This can be a general rate limit, but we'll use the token bucket for more fine-grained control
  timeout?: number;
  
  /** Market data subscriptions */
  enableOrderBookUpdates?: boolean;
  enableTradeUpdates?: boolean;
  enableTickerUpdates?: boolean;
  
  /** Rate limiter configuration */
  rateLimiter?: RateLimiterConfig;
  
  /** Additional exchange-specific config */
  exchangeSpecific?: Record<string, unknown>;
}

/**
 * Account balance information
 */
export interface AccountBalance {
  asset: string;
  free: DecimalAmount;
  locked: DecimalAmount;
  total: DecimalAmount;
}

/**
 * Trading fees structure
 */
export interface TradingFees {
  maker: DecimalAmount;
  taker: DecimalAmount;
  currency: string;
}

/**
 * Order request parameters
 */
export interface OrderRequest {
  symbol: TradingPair;
  side: TradingSide;
  type: OrderType;
  quantity: Quantity;
  price?: Price;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
  stopPrice?: Price;
  icebergQty?: Quantity;
}

/**
 * Abstract base class for all exchange connectors.
 * Extends EventEmitter to provide a standardized way of emitting events related to
 * connection status, market data, and trading operations.
 *
 * Emits the following events:
 * - 'statusChanged': When the connector's internal status changes.
 * - 'connected': When the connector successfully establishes a connection.
 * - 'disconnected': When the connector disconnects.
 * - 'error': When an error occurs within the connector.
 * - 'ticker': When new ticker data is received (if subscribed).
 * - 'orderBook': When new order book data is received (if subscribed).
 * - 'trade': When new trade data is received (if subscribed).
 * - 'orderUpdate': When an order's status changes (e.g., filled, canceled).
 * - 'balanceUpdate': When account balances change.
 */
export abstract class BaseConnector extends EventEmitter {
  protected readonly config: ConnectorConfig;
  protected status: ConnectorStatus = ConnectorStatus.DISCONNECTED;
  protected lastHeartbeat: Timestamp = 0;
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number = 5;

  /**
   * Creates an instance of BaseConnector.
   * @param config The configuration object for the connector.
   */
  constructor(config: ConnectorConfig) {
    super();
    this.config = config;
    this.validateConfig(config);
  }

  // ============================================================================
  // Public Properties
  // ============================================================================

  /**
   * Get the exchange identifier
   */
  get exchangeId(): ExchangeId {
    return this.config.exchangeId;
  }

  /**
   * Get current connector status
   */
  get currentStatus(): ConnectorStatus {
    return this.status;
  }

  /**
   * Check if connector is connected and ready
   */
  get isReady(): boolean {
    return this.status === ConnectorStatus.CONNECTED;
  }

  // ============================================================================
  // Connection Management (Abstract)
  // ============================================================================

  /**
   * Establishes a connection to the exchange. This method should handle all necessary
   * authentication and WebSocket/REST API initialization.
   * Emits a 'connected' event upon successful connection.
   * @returns A Promise that resolves when the connection is successfully established.
   */
  abstract connect(): Promise<void>;

  /**
   * Terminates the connection to the exchange and cleans up any resources.
   * Emits a 'disconnected' event upon successful disconnection.
   * @returns A Promise that resolves when the disconnection is complete.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Attempts to re-establish a lost connection to the exchange.
   * This method is typically called internally by the connector's reconnection logic.
   * @returns A Promise that resolves when the reconnection is successful.
   */
  abstract reconnect(): Promise<void>;

  // ============================================================================
  // Market Data (Abstract)
  // ============================================================================

  /**
   * Retrieves a list of all available trading pairs on the exchange, along with their information.
   * @returns A Promise that resolves with an array of TradingPairInfo objects.
   */
  abstract getTradingPairs(): Promise<TradingPairInfo[]>;

  /**
   * Retrieves the current ticker information for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves with a Ticker object.
   */
  abstract getTicker(symbol: TradingPair): Promise<Ticker>;

  /**
   * Retrieves the current order book for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @param limit Optional. The maximum number of order book entries to retrieve.
   * @returns A Promise that resolves with an OrderBook object.
   */
  abstract getOrderBook(symbol: TradingPair, limit?: number): Promise<OrderBook>;

  /**
   * Retrieves recent trades for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @param limit Optional. The maximum number of trades to retrieve.
   * @returns A Promise that resolves with an array of Trade objects.
   */
  abstract getTrades(symbol: TradingPair, limit?: number): Promise<Trade[]>;

  /**
   * Subscribes to real-time ticker updates for a specific trading pair.
   * Emits 'ticker' events with Ticker objects when updates are received.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the subscription is successful.
   */
  abstract subscribeToTicker(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribes from real-time ticker updates for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the unsubscription is successful.
   */
  abstract unsubscribeFromTicker(symbol: TradingPair): Promise<void>;

  /**
   * Subscribes to real-time order book updates for a specific trading pair.
   * Emits 'orderBook' events with OrderBook objects when updates are received.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the subscription is successful.
   */
  abstract subscribeToOrderBook(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribes from real-time order book updates for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the unsubscription is successful.
   */
  abstract unsubscribeFromOrderBook(symbol: TradingPair): Promise<void>;

  /**
   * Subscribes to real-time trade updates for a specific trading pair.
   * Emits 'trade' events with Trade objects when updates are received.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the subscription is successful.
   */
  abstract subscribeToTrades(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribes from real-time trade updates for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves when the unsubscription is successful.
   */
  abstract unsubscribeFromTrades(symbol: TradingPair): Promise<void>;

  // ============================================================================
  // Trading Operations (Abstract)
  // ============================================================================

  /**
   * Places a new order on the exchange.
   * Emits an 'orderUpdate' event with the new order status.
   * @param request The OrderRequest object containing details for the order.
   * @returns A Promise that resolves with the created Order object.
   */
  abstract placeOrder(request: OrderRequest): Promise<Order>;

  /**
   * Cancels an existing order on the exchange.
   * Emits an 'orderUpdate' event with the updated order status (e.g., CANCELED).
   * @param orderId The ID of the order to cancel.
   * @param symbol The trading pair of the order.
   * @returns A Promise that resolves with the canceled Order object.
   */
  abstract cancelOrder(orderId: OrderId, symbol: TradingPair): Promise<Order>;

  /**
   * Cancels all open orders for a specific trading pair, or all open orders across all pairs if no symbol is provided.
   * Emits 'orderUpdate' events for each canceled order.
   * @param symbol Optional. The trading pair symbol to cancel orders for. If omitted, all open orders are canceled.
   * @returns A Promise that resolves with an array of canceled Order objects.
   */
  abstract cancelAllOrders(symbol?: TradingPair): Promise<Order[]>;

  /**
   * Retrieves the status of a specific order.
   * @param orderId The ID of the order to retrieve.
   * @param symbol The trading pair of the order.
   * @returns A Promise that resolves with the Order object.
   */
  abstract getOrder(orderId: OrderId, symbol: TradingPair): Promise<Order>;

  /**
   * Retrieves all currently open orders for a specific trading pair, or all open orders across all pairs if no symbol is provided.
   * @param symbol Optional. The trading pair symbol to retrieve open orders for. If omitted, all open orders are returned.
   * @returns A Promise that resolves with an array of Order objects.
   */
  abstract getOpenOrders(symbol?: TradingPair): Promise<Order[]>;

  /**
   * Retrieves the historical orders for a specific trading pair, or all historical orders across all pairs if no symbol is provided.
   * @param symbol Optional. The trading pair symbol to retrieve order history for. If omitted, all historical orders are returned.
   * @param limit Optional. The maximum number of historical orders to retrieve.
   * @returns A Promise that resolves with an array of Order objects.
   */
  abstract getOrderHistory(symbol?: TradingPair, limit?: number): Promise<Order[]>;

  // ============================================================================
  // Account Management (Abstract)
  // ============================================================================

  /**
   * Retrieves all account balances for the connected exchange.
   * Emits a 'balanceUpdate' event when balances change.
   * @returns A Promise that resolves with an array of AccountBalance objects.
   */
  abstract getBalances(): Promise<AccountBalance[]>;

  /**
   * Retrieves the account balance for a specific asset.
   * @param asset The asset symbol (e.g., 'BTC', 'USDT').
   * @returns A Promise that resolves with an AccountBalance object for the specified asset.
   */
  abstract getBalance(asset: string): Promise<AccountBalance>;

  /**
   * Retrieves the trading fees for a specific trading pair.
   * @param symbol The trading pair symbol (e.g., 'BTC/USDT').
   * @returns A Promise that resolves with a TradingFees object.
   */
  abstract getTradingFees(symbol: TradingPair): Promise<TradingFees>;

  // ============================================================================
  // Health and Monitoring
  // ============================================================================

  /**
   * Get connector health status
   */
  getHealthStatus(): HealthStatus {
    return {
      isHealthy: this.status === ConnectorStatus.CONNECTED,
      component: `${this.exchangeId}-connector`,
      message: this.status === ConnectorStatus.CONNECTED 
        ? 'Connector is healthy' 
        : `Connector status: ${this.status}`,
      lastChecked: Date.now(),
      details: {
        status: this.status,
        lastHeartbeat: this.lastHeartbeat,
        reconnectAttempts: this.reconnectAttempts,
      },
    };
  }

  /**
   * Validate connector configuration
   */
  protected validateConfig(config: ConnectorConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.exchangeId) {
      errors.push('Exchange ID is required');
    }

    if (!config.apiKey && !config.testnet) {
      warnings.push('API key not provided - some features may be limited');
    }

    if (!config.apiSecret && !config.testnet) {
      warnings.push('API secret not provided - trading features will be disabled');
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    if (!result.isValid) {
      throw new ConnectorError(
        `Invalid connector configuration: ${errors.join(', ')}`,
        this.config.exchangeId,
        { config, validationResult: result }
      );
    }

    return result;
  }

  /**
   * Updates the connector's internal status and emits corresponding events.
   * @param newStatus The new status of the connector.
   * @param reason Optional. A reason for the status change.
   *
   * Emits:
   * - 'statusChanged': { exchangeId: ExchangeId, previousStatus: ConnectorStatus, currentStatus: ConnectorStatus, timestamp: Timestamp, reason?: string }
   * - 'connected': { exchangeId: ExchangeId } (if newStatus is CONNECTED)
   * - 'disconnected': { exchangeId: ExchangeId, reason?: string } (if newStatus is DISCONNECTED)
   * - 'error': ConnectorError (if newStatus is ERROR)
   */
  protected updateStatus(newStatus: ConnectorStatus, reason?: string): void {
    const previousStatus = this.status;
    this.status = newStatus;
    this.lastHeartbeat = Date.now();

    this.emit('statusChanged', {
      exchangeId: this.exchangeId,
      previousStatus,
      currentStatus: newStatus,
      timestamp: this.lastHeartbeat,
      reason,
    });

    // Emit specific status events
    switch (newStatus) {
      case ConnectorStatus.CONNECTED:
        this.emit('connected', { exchangeId: this.exchangeId });
        break;
      case ConnectorStatus.DISCONNECTED:
        this.emit('disconnected', { exchangeId: this.exchangeId, reason });
        break;
      case ConnectorStatus.ERROR:
        this.emit('error', new ConnectorError(
          reason || 'Connector error',
          this.exchangeId
        ));
        break;
    }
  }

  /**
   * Handles the reconnection logic, including retry attempts with exponential backoff.
   * If max reconnection attempts are exceeded, the connector status is set to ERROR.
   * Emits 'error' events if reconnection attempts fail.
   * @returns A Promise that resolves when reconnection is attempted (successfully or not).
   */
  protected async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateStatus(ConnectorStatus.ERROR, 'Max reconnection attempts exceeded');
      return;
    }

    this.reconnectAttempts++;
    this.updateStatus(ConnectorStatus.RECONNECTING, `Attempt ${this.reconnectAttempts}`);

    try {
      await this.reconnect();
      this.reconnectAttempts = 0;
    } catch (error) {
      this.emit('error', new ConnectorError(
        `Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.exchangeId,
        { attempt: this.reconnectAttempts, error }
      ));

      // Wait before next attempt
      const delay = clamp(1000 * Math.pow(2, this.reconnectAttempts), 0, 30000);
      setTimeout(() => this.handleReconnection(), delay);
    }
  }

  /**
   * Emits an error event with a standardized ConnectorError object.
   * @param message A descriptive error message.
   * @param error Optional. The original error object, if any.
   * @param context Optional. Additional context to include in the error details.
   */
  protected emitError(message: string, error?: Error, context?: Record<string, unknown>): void {
    const connectorError = new ConnectorError(message, this.exchangeId, {
      originalError: error,
      ...context,
    });
    
    this.emit('error', connectorError);
  }

  /**
   * Clean up resources when disconnecting
   */
  protected cleanup(): void {
    this.removeAllListeners();
    this.reconnectAttempts = 0;
  }
}