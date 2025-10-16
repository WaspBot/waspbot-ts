/**
 * Base connector interface for WaspBot-TS
 * 
 * This abstract class defines the core interface that all exchange connectors
 * must implement. It provides standardized methods for trading operations,
 * market data subscriptions, and account management across different exchanges.
 */

import { EventEmitter } from 'events';
import {
  ExchangeId,
  TradingPair,
  ConnectorStatus,
  OrderId,
  TradingSide,
  OrderType,
  TimeInForce,
  Price,
  Quantity,
  DecimalAmount,
  Timestamp,
  ConnectorError,
  HealthStatus,
  ValidationResult,
} from '../types/common.js';
import { Ticker, Trade, TradingPairInfo } from '../market-data/ticker.js';
import { OrderBook } from '../market-data/order-book.js';
import { Order } from '../order-management/order.js';

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
  rateLimit?: number;
  timeout?: number;
  
  /** Market data subscriptions */
  enableOrderBookUpdates?: boolean;
  enableTradeUpdates?: boolean;
  enableTickerUpdates?: boolean;
  
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
 * Abstract base class for all exchange connectors
 */
export abstract class BaseConnector extends EventEmitter {
  protected readonly config: ConnectorConfig;
  protected status: ConnectorStatus = ConnectorStatus.DISCONNECTED;
  protected lastHeartbeat: Timestamp = 0;
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number = 5;

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
   * Connect to the exchange
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the exchange
   */
  abstract disconnect(): Promise<void>;

  /**
   * Reconnect to the exchange
   */
  abstract reconnect(): Promise<void>;

  // ============================================================================
  // Market Data (Abstract)
  // ============================================================================

  /**
   * Get list of available trading pairs
   */
  abstract getTradingPairs(): Promise<TradingPairInfo[]>;

  /**
   * Get current ticker for a trading pair
   */
  abstract getTicker(symbol: TradingPair): Promise<Ticker>;

  /**
   * Get order book for a trading pair
   */
  abstract getOrderBook(symbol: TradingPair, limit?: number): Promise<OrderBook>;

  /**
   * Get recent trades for a trading pair
   */
  abstract getTrades(symbol: TradingPair, limit?: number): Promise<Trade[]>;

  /**
   * Subscribe to ticker updates
   */
  abstract subscribeToTicker(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribe from ticker updates
   */
  abstract unsubscribeFromTicker(symbol: TradingPair): Promise<void>;

  /**
   * Subscribe to order book updates
   */
  abstract subscribeToOrderBook(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribe from order book updates
   */
  abstract unsubscribeFromOrderBook(symbol: TradingPair): Promise<void>;

  /**
   * Subscribe to trade updates
   */
  abstract subscribeToTrades(symbol: TradingPair): Promise<void>;

  /**
   * Unsubscribe from trade updates
   */
  abstract unsubscribeFromTrades(symbol: TradingPair): Promise<void>;

  // ============================================================================
  // Trading Operations (Abstract)
  // ============================================================================

  /**
   * Place a new order
   */
  abstract placeOrder(request: OrderRequest): Promise<Order>;

  /**
   * Cancel an existing order
   */
  abstract cancelOrder(orderId: OrderId, symbol: TradingPair): Promise<Order>;

  /**
   * Cancel all open orders for a symbol
   */
  abstract cancelAllOrders(symbol?: TradingPair): Promise<Order[]>;

  /**
   * Get order status
   */
  abstract getOrder(orderId: OrderId, symbol: TradingPair): Promise<Order>;

  /**
   * Get all open orders
   */
  abstract getOpenOrders(symbol?: TradingPair): Promise<Order[]>;

  /**
   * Get order history
   */
  abstract getOrderHistory(symbol?: TradingPair, limit?: number): Promise<Order[]>;

  // ============================================================================
  // Account Management (Abstract)
  // ============================================================================

  /**
   * Get account balances
   */
  abstract getBalances(): Promise<AccountBalance[]>;

  /**
   * Get balance for a specific asset
   */
  abstract getBalance(asset: string): Promise<AccountBalance>;

  /**
   * Get trading fees for a symbol
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
   * Update connector status and emit events
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
   * Handle reconnection logic
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
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.handleReconnection(), delay);
    }
  }

  /**
   * Emit error event with proper formatting
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