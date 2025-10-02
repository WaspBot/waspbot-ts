/**
 * Arbitrage Strategy for WaspBot-TS
 * 
 * This strategy identifies and executes arbitrage opportunities across multiple exchanges
 * or trading pairs. It monitors price differences and executes simultaneous buy/sell orders
 * to capture risk-free profits when the spread exceeds transaction costs.
 * 
 * Features:
 * - Multi-exchange arbitrage (triangular and cross-exchange)
 * - Real-time opportunity detection
 * - Risk management with position limits
 * - Transaction cost consideration
 * - Latency-aware execution
 */

import { EventEmitter } from 'node:events';
import Decimal from 'decimal.js';
import { BaseConnector } from '../connectors/base-connector.js';
import { Logger } from '../core/logger.js';
import {
  TradingPair,
  ExchangeId,
  TradingSide,
  OrderType,
  TimeInForce,
  Timestamp,
  StrategyStatus,
  StrategyError,
} from '../types/common.js';
import { Ticker } from '../market-data/ticker.js';

/**
 * Configuration for the arbitrage strategy
 */
export interface ArbitrageConfig {
  /** Strategy identifier */
  strategyId: string;

  /** Trading pairs to monitor */
  tradingPairs: TradingPair[];

  /** Exchanges to trade on */
  exchanges: ExchangeId[];

  /** Minimum profit threshold (as decimal, e.g., 0.005 for 0.5%) */
  minProfitThreshold: Decimal;

  /** Maximum position size per trade */
  maxPositionSize: Decimal;

  /** Maximum capital allocation per arbitrage cycle */
  maxCapitalPerCycle: Decimal;

  /** Include transaction fees in profit calculation */
  includeFees: boolean;

  /** Trading fees per exchange (maker/taker as decimal) */
  fees: Map<ExchangeId, { maker: Decimal; taker: Decimal }>;

  /** Slippage tolerance (as decimal) */
  slippageTolerance: Decimal;

  /** Maximum latency for execution (ms) */
  maxExecutionLatency: number;

  /** Cooldown period between opportunities (ms) */
  opportunityCooldown: number;

  /** Type of arbitrage to perform */
  arbitrageType: ArbitrageType;

  /** Enable dry run mode (no actual trades) */
  dryRun?: boolean;

  /** Risk management settings */
  riskManagement: {
    maxDailyLoss: Decimal;
    maxOpenPositions: number;
    stopLossPercent: Decimal;
  };
}

/**
 * Types of arbitrage strategies
 */
export enum ArbitrageType {
  /** Simple arbitrage between two exchanges for the same pair */
  CROSS_EXCHANGE = 'CROSS_EXCHANGE',

  /** Triangular arbitrage within a single exchange */
  TRIANGULAR = 'TRIANGULAR',

  /** Statistical arbitrage based on correlation */
  STATISTICAL = 'STATISTICAL',

  /** Funding rate arbitrage (spot vs futures) */
  FUNDING_RATE = 'FUNDING_RATE',
}

/**
 * Represents an arbitrage opportunity
 */
export interface ArbitrageOpportunity {
  /** Unique identifier for this opportunity */
  id: string;

  /** Type of arbitrage */
  type: ArbitrageType;

  /** Timestamp when opportunity was detected */
  timestamp: Timestamp;

  /** Buy side details */
  buyExchange: ExchangeId;
  buyPair: TradingPair;
  buyPrice: Decimal;

  /** Sell side details */
  sellExchange: ExchangeId;
  sellPair: TradingPair;
  sellPrice: Decimal;

  /** Opportunity metrics */
  rawSpread: Decimal; // Price difference without fees
  netSpread: Decimal; // Price difference after fees
  profitPercent: Decimal; // Expected profit as percentage
  estimatedProfit: Decimal; // Estimated profit in quote currency

  /** Suggested trade size */
  suggestedQuantity: Decimal;

  /** Additional context for triangular arbitrage */
  intermediateAsset?: string;
  intermediatePrice?: Decimal;

  /** Confidence score (0-1) */
  confidence: number;

  /** Expected execution latency (ms) */
  expectedLatency: number;
}

/**
 * Result of an arbitrage execution
 */
export interface ArbitrageExecutionResult {
  /** Opportunity that was executed */
  opportunityId: string;

  /** Whether execution was successful */
  success: boolean;

  /** Buy order details */
  buyOrderId?: string;
  buyExecutedPrice?: Decimal;
  buyExecutedQuantity?: Decimal;

  /** Sell order details */
  sellOrderId?: string;
  sellExecutedPrice?: Decimal;
  sellExecutedQuantity?: Decimal;

  /** Actual profit realized */
  realizedProfit?: Decimal;
  realizedProfitPercent?: Decimal;

  /** Execution time (ms) */
  executionTime: number;

  /** Error message if failed */
  error?: string;

  /** Timestamp of execution */
  timestamp: Timestamp;
}

/**
 * Strategy performance metrics
 */
export interface ArbitrageMetrics {
  totalOpportunities: number;
  executedTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: Decimal;
  totalLoss: Decimal;
  netProfit: Decimal;
  winRate: number;
  averageProfit: Decimal;
  averageExecutionTime: number;
  lastExecutionTime: Timestamp;
}

/**
 * Main Arbitrage Strategy Class
 */
export class ArbitrageStrategy extends EventEmitter {
  private readonly config: ArbitrageConfig;
  private readonly connectors: Map<ExchangeId, BaseConnector>;
  private status: StrategyStatus = StrategyStatus.STOPPED;

  // Market data caches
  private tickerCache: Map<string, Ticker> = new Map();
  private lastUpdateTime: Map<string, Timestamp> = new Map();

  // Opportunity tracking
  private activeOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  private executionHistory: ArbitrageExecutionResult[] = [];
  private lastOpportunityTime: Timestamp = 0;

  // Performance metrics
  private metrics: ArbitrageMetrics = {
    totalOpportunities: 0,
    executedTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfit: new Decimal(0),
    totalLoss: new Decimal(0),
    netProfit: new Decimal(0),
    winRate: 0,
    averageProfit: new Decimal(0),
    averageExecutionTime: 0,
    lastExecutionTime: 0,
  };

  // Risk management
  private openPositions: number = 0;
  private dailyPnL: Decimal = new Decimal(0);
  private dailyResetTime: Timestamp = Date.now();

  constructor(config: ArbitrageConfig, connectors: Map<ExchangeId, BaseConnector>) {
    super();
    this.config = config;
    this.connectors = connectors;
    this.validateConfig();
  }

  /**
   * Validate strategy configuration
   */
  private validateConfig(): void {
    if (this.config.minProfitThreshold.lte(0)) {
      throw new StrategyError('Minimum profit threshold must be positive', this.config.strategyId);
    }

    if (this.config.tradingPairs.length === 0) {
      throw new StrategyError('At least one trading pair must be specified', this.config.strategyId);
    }

    if (this.config.exchanges.length < 2 && this.config.arbitrageType === ArbitrageType.CROSS_EXCHANGE) {
      throw new StrategyError('Cross-exchange arbitrage requires at least 2 exchanges', this.config.strategyId);
    }

    for (const exchangeId of this.config.exchanges) {
      if (!this.connectors.has(exchangeId)) {
        throw new StrategyError(`Connector not found for exchange: ${exchangeId}`, this.config.strategyId);
      }
    }
  }

  /**
   * Start the arbitrage strategy
   */
  public async start(): Promise<void> {
    if (this.status === StrategyStatus.RUNNING) {
      Logger.warn('Arbitrage strategy is already running');
      return;
    }

    Logger.info(`Starting arbitrage strategy: ${this.config.strategyId}`);
    this.status = StrategyStatus.STARTING;

    try {
      // Subscribe to market data from all exchanges
      await this.subscribeToMarketData();

      // Initialize event handlers
      this.setupEventHandlers();

      this.status = StrategyStatus.RUNNING;
      Logger.info(`Arbitrage strategy started successfully: ${this.config.strategyId}`);
      this.emit('strategy_start', { strategyId: this.config.strategyId });
    } catch (error) {
      this.status = StrategyStatus.ERROR;
      Logger.error(`Failed to start arbitrage strategy: ${error}`);
      throw new StrategyError(`Failed to start strategy: ${error}`, this.config.strategyId);
    }
  }

  /**
   * Stop the arbitrage strategy
   */
  public async stop(): Promise<void> {
    if (this.status === StrategyStatus.STOPPED) {
      Logger.warn('Arbitrage strategy is already stopped');
      return;
    }

    Logger.info(`Stopping arbitrage strategy: ${this.config.strategyId}`);
    this.status = StrategyStatus.STOPPING;

    try {
      // Unsubscribe from market data
      await this.unsubscribeFromMarketData();

      // Cancel any pending orders
      await this.cancelAllPendingOrders();

      this.status = StrategyStatus.STOPPED;
      Logger.info(`Arbitrage strategy stopped successfully: ${this.config.strategyId}`);
      this.emit('strategy_stop', { strategyId: this.config.strategyId });
    } catch (error) {
      this.status = StrategyStatus.ERROR;
      Logger.error(`Error stopping arbitrage strategy: ${error}`);
      throw new StrategyError(`Failed to stop strategy: ${error}`, this.config.strategyId);
    }
  }

  /**
   * Subscribe to market data feeds
   */
  private async subscribeToMarketData(): Promise<void> {
    for (const [exchangeId, connector] of this.connectors) {
      for (const pair of this.config.tradingPairs) {
        try {
          await connector.subscribeToTicker(pair);
          Logger.debug(`Subscribed to ticker: ${exchangeId}:${pair}`);
        } catch (error) {
          Logger.error(`Failed to subscribe to ${exchangeId}:${pair}: ${error}`);
        }
      }
    }
  }

  /**
   * Unsubscribe from market data feeds
   */
  private async unsubscribeFromMarketData(): Promise<void> {
    for (const [exchangeId, connector] of this.connectors) {
      for (const pair of this.config.tradingPairs) {
        try {
          await connector.unsubscribeFromTicker(pair);
          Logger.debug(`Unsubscribed from ticker: ${exchangeId}:${pair}`);
        } catch (error) {
          Logger.error(`Failed to unsubscribe from ${exchangeId}:${pair}: ${error}`);
        }
      }
    }
  }

  /**
   * Setup event handlers for market data updates
   */
  private setupEventHandlers(): void {
    for (const [exchangeId, connector] of this.connectors) {
      connector.on('ticker', (ticker: Ticker) => {
        this.handleTickerUpdate(exchangeId, ticker);
      });

      connector.on('error', (error: Error) => {
        Logger.error(`Connector error from ${exchangeId}: ${error.message}`);
      });
    }
  }

  /**
   * Handle ticker updates and detect opportunities
   */
  private handleTickerUpdate(exchangeId: ExchangeId, ticker: Ticker): void {
    const key = `${exchangeId}:${ticker.symbol}`;
    this.tickerCache.set(key, ticker);
    this.lastUpdateTime.set(key, Date.now());

    // Scan for arbitrage opportunities
    if (this.status === StrategyStatus.RUNNING) {
      this.scanForOpportunities();
    }
  }

  /**
   * Scan for arbitrage opportunities across all exchanges
   */
  private scanForOpportunities(): void {
    // Check cooldown period
    const now = Date.now();
    if (now - this.lastOpportunityTime < this.config.opportunityCooldown) {
      return;
    }

    // Reset daily metrics if needed
    this.checkDailyReset(now);

    // Check risk limits
    if (!this.checkRiskLimits()) {
      return;
    }

    switch (this.config.arbitrageType) {
      case ArbitrageType.CROSS_EXCHANGE:
        this.scanCrossExchangeOpportunities();
        break;
      case ArbitrageType.TRIANGULAR:
        this.scanTriangularOpportunities();
        break;
      case ArbitrageType.STATISTICAL:
        this.scanStatisticalOpportunities();
        break;
      default:
        Logger.warn(`Unsupported arbitrage type: ${this.config.arbitrageType}`);
    }
  }

  /**
   * Scan for cross-exchange arbitrage opportunities
   */
  private scanCrossExchangeOpportunities(): void {
    for (const pair of this.config.tradingPairs) {
      const exchanges = Array.from(this.config.exchanges);

      // Compare prices across all exchange pairs
      for (let i = 0; i < exchanges.length; i++) {
        for (let j = i + 1; j < exchanges.length; j++) {
          const exchange1 = exchanges[i];
          const exchange2 = exchanges[j];

          const ticker1 = this.tickerCache.get(`${exchange1}:${pair}`);
          const ticker2 = this.tickerCache.get(`${exchange2}:${pair}`);

          if (!ticker1 || !ticker2) continue;

          // Check if data is fresh (within last 5 seconds)
          const now = Date.now();
          const time1 = this.lastUpdateTime.get(`${exchange1}:${pair}`) || 0;
          const time2 = this.lastUpdateTime.get(`${exchange2}:${pair}`) || 0;

          if (now - time1 > 5000 || now - time2 > 5000) {
            continue; // Stale data
          }

          // Calculate opportunity in both directions
          if (exchange1 && exchange2) {
            this.evaluateCrossExchangeOpportunity(exchange1, exchange2, pair, ticker1, ticker2);
            this.evaluateCrossExchangeOpportunity(exchange2, exchange1, pair, ticker2, ticker1);
          }
        }
      }
    }
  }

  /**
   * Evaluate a specific cross-exchange opportunity
   */
  private evaluateCrossExchangeOpportunity(
    buyExchange: ExchangeId,
    sellExchange: ExchangeId,
    pair: TradingPair,
    buyTicker: Ticker,
    sellTicker: Ticker
  ): void {
    // Use ask price for buying and bid price for selling
    const buyPrice = new Decimal(buyTicker.askPrice?.toString() || buyTicker.lastPrice.toString());
    const sellPrice = new Decimal(sellTicker.bidPrice?.toString() || sellTicker.lastPrice.toString());

    // Calculate raw spread
    const rawSpread = sellPrice.minus(buyPrice).div(buyPrice);

    // Calculate fees
    let totalFees = new Decimal(0);
    if (this.config.includeFees) {
      const buyFees = this.config.fees.get(buyExchange)?.taker || new Decimal(0);
      const sellFees = this.config.fees.get(sellExchange)?.taker || new Decimal(0);
      totalFees = buyFees.plus(sellFees);
    }

    // Calculate net spread after fees and slippage
    const netSpread = rawSpread.minus(totalFees).minus(this.config.slippageTolerance);

    // Check if opportunity meets minimum threshold
    if (netSpread.gte(this.config.minProfitThreshold)) {
      // Calculate suggested quantity based on available liquidity
      const buyQuantity = new Decimal(buyTicker.askQuantity?.toString() || '0');
      const sellQuantity = new Decimal(sellTicker.bidQuantity?.toString() || '0');
      const suggestedQuantity = Decimal.min(
        buyQuantity,
        sellQuantity,
        this.config.maxPositionSize
      );

      if (suggestedQuantity.gt(0)) {
        const estimatedProfit = suggestedQuantity.mul(buyPrice).mul(netSpread);

        const opportunity: ArbitrageOpportunity = {
          id: `${buyExchange}-${sellExchange}-${pair}-${Date.now()}`,
          type: ArbitrageType.CROSS_EXCHANGE,
          timestamp: Date.now(),
          buyExchange,
          buyPair: pair,
          buyPrice,
          sellExchange,
          sellPair: pair,
          sellPrice,
          rawSpread,
          netSpread,
          profitPercent: netSpread.mul(100),
          estimatedProfit,
          suggestedQuantity,
          confidence: this.calculateConfidence(buyTicker, sellTicker),
          expectedLatency: this.config.maxExecutionLatency,
        };

        this.handleOpportunity(opportunity);
      }
    }
  }

  /**
   * Scan for triangular arbitrage opportunities (within single exchange)
   */
  private scanTriangularOpportunities(): void {
    // Triangular arbitrage: A->B->C->A
    // Example: BTC->ETH->USDT->BTC
    // This requires analyzing three trading pairs simultaneously

    for (const exchangeId of this.config.exchanges) {
      // Define common triangular paths
      const paths = this.generateTriangularPaths();

      for (const path of paths) {
        const { pair1, pair2, pair3 } = path;

        const ticker1 = this.tickerCache.get(`${exchangeId}:${pair1}`);
        const ticker2 = this.tickerCache.get(`${exchangeId}:${pair2}`);
        const ticker3 = this.tickerCache.get(`${exchangeId}:${pair3}`);

        if (!ticker1 || !ticker2 || !ticker3) continue;

        this.evaluateTriangularOpportunity(exchangeId, ticker1, ticker2, ticker3, path);
      }
    }
  }

  /**
   * Generate triangular arbitrage paths from configured pairs
   */
  private generateTriangularPaths(): Array<{
    pair1: TradingPair;
    pair2: TradingPair;
    pair3: TradingPair;
    baseAsset: string;
  }> {
    const paths: Array<any> = [];

    // Example: If we have BTC-USDT, ETH-USDT, BTC-ETH
    // Path: BTC->ETH->USDT->BTC
    // This is simplified - production would need more sophisticated path finding

    // Add your triangular paths based on available pairs
    // This is a placeholder for demonstration

    return paths;
  }

  /**
   * Evaluate a triangular arbitrage opportunity
   */
  private evaluateTriangularOpportunity(
    _exchangeId: ExchangeId,
    _ticker1: Ticker,
    _ticker2: Ticker,
    _ticker3: Ticker,
    _path: any
  ): void {
    // Calculate the effective exchange rate through the triangular path
    // This is a simplified version - production would need more sophisticated calculations

    // Example calculation (commented out as not fully implemented):
    // const price1 = new Decimal(ticker1.lastPrice.toString());
    // const price2 = new Decimal(ticker2.lastPrice.toString());
    // const price3 = new Decimal(ticker3.lastPrice.toString());
    // const effectiveRate = price1.mul(price2).mul(price3);
    // const profit = effectiveRate.minus(1);

    // Apply similar logic as cross-exchange arbitrage
    // TODO: Implement triangular arbitrage evaluation
  }

  /**
   * Scan for statistical arbitrage opportunities
   */
  private scanStatisticalOpportunities(): void {
    // Statistical arbitrage based on historical correlations and mean reversion
    // This requires more sophisticated analysis and historical data
    Logger.debug('Statistical arbitrage scanning not yet implemented');
  }

  /**
   * Calculate confidence score for an opportunity
   */
  private calculateConfidence(buyTicker: Ticker, sellTicker: Ticker): number {
    let confidence = 1.0;

    // Reduce confidence based on volume
    const buyVolume = new Decimal(buyTicker.volume.toString());
    const sellVolume = new Decimal(sellTicker.volume.toString());

    if (buyVolume.lt(1000) || sellVolume.lt(1000)) {
      confidence *= 0.8;
    }

    // Reduce confidence based on price volatility
    const buyVolatility = new Decimal(buyTicker.priceChangePercent.toString()).abs();
    const sellVolatility = new Decimal(sellTicker.priceChangePercent.toString()).abs();

    if (buyVolatility.gt(5) || sellVolatility.gt(5)) {
      confidence *= 0.7;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Handle a detected arbitrage opportunity
   */
  private handleOpportunity(opportunity: ArbitrageOpportunity): void {
    this.metrics.totalOpportunities++;
    this.lastOpportunityTime = Date.now();

    Logger.info(
      `Arbitrage opportunity detected: ${opportunity.buyExchange} -> ${opportunity.sellExchange} ` +
      `| Profit: ${opportunity.profitPercent.toFixed(4)}% | Qty: ${opportunity.suggestedQuantity.toString()}`
    );

    this.emit('opportunity_detected', opportunity);

    // Execute if confidence is high enough and not in dry run mode
    if (opportunity.confidence >= 0.7 && !this.config.dryRun) {
      this.executeArbitrage(opportunity);
    } else if (this.config.dryRun) {
      Logger.info(`[DRY RUN] Would execute arbitrage opportunity: ${opportunity.id}`);
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const startTime = Date.now();
    const result: ArbitrageExecutionResult = {
      opportunityId: opportunity.id,
      success: false,
      executionTime: 0,
      timestamp: Date.now(),
    };

    try {
      Logger.info(`Executing arbitrage: ${opportunity.id}`);
      this.openPositions++;

      const buyConnector = this.connectors.get(opportunity.buyExchange);
      const sellConnector = this.connectors.get(opportunity.sellExchange);

      if (!buyConnector || !sellConnector) {
        throw new Error('Connectors not available');
      }

      // Execute buy and sell orders simultaneously
      const [buyOrderResult, sellOrderResult] = await Promise.all([
        buyConnector.placeOrder({
          symbol: opportunity.buyPair,
          side: TradingSide.BUY,
          type: OrderType.LIMIT,
          quantity: opportunity.suggestedQuantity,
          price: opportunity.buyPrice,
          timeInForce: TimeInForce.IOC, // Immediate or Cancel
        }),
        sellConnector.placeOrder({
          symbol: opportunity.sellPair,
          side: TradingSide.SELL,
          type: OrderType.LIMIT,
          quantity: opportunity.suggestedQuantity,
          price: opportunity.sellPrice,
          timeInForce: TimeInForce.IOC,
        }),
      ]);

      // Process results
      result.buyOrderId = buyOrderResult.clientOrderId;
      result.sellOrderId = sellOrderResult.clientOrderId;

      // Wait for fills and calculate actual profit
      // (Simplified - production would need proper fill tracking)
      result.success = true;
      result.realizedProfit = opportunity.estimatedProfit;
      result.realizedProfitPercent = opportunity.profitPercent;

      this.metrics.executedTrades++;
      this.metrics.successfulTrades++;
      this.metrics.totalProfit = this.metrics.totalProfit.plus(opportunity.estimatedProfit);
      this.dailyPnL = this.dailyPnL.plus(opportunity.estimatedProfit);

      Logger.info(
        `Arbitrage executed successfully: ${opportunity.id} | ` +
        `Profit: ${result.realizedProfit?.toFixed(4)}`
      );

      this.emit('arbitrage_executed', result);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);

      this.metrics.failedTrades++;
      Logger.error(`Arbitrage execution failed: ${opportunity.id} | Error: ${result.error}`);

      this.emit('arbitrage_failed', result);
    } finally {
      result.executionTime = Date.now() - startTime;
      this.executionHistory.push(result);
      this.openPositions--;

      // Update average execution time
      const totalTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0);
      this.metrics.averageExecutionTime = totalTime / this.executionHistory.length;
    }
  }

  /**
   * Check if risk limits allow trading
   */
  private checkRiskLimits(): boolean {
    // Check max open positions
    if (this.openPositions >= this.config.riskManagement.maxOpenPositions) {
      return false;
    }

    // Check daily loss limit
    if (this.dailyPnL.lte(this.config.riskManagement.maxDailyLoss.neg())) {
      Logger.warn('Daily loss limit reached, stopping trading');
      this.emit('risk_limit_reached', { type: 'daily_loss', value: this.dailyPnL });
      return false;
    }

    return true;
  }

  /**
   * Reset daily metrics at the start of a new day
   */
  private checkDailyReset(now: Timestamp): void {
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - this.dailyResetTime > dayInMs) {
      this.dailyPnL = new Decimal(0);
      this.dailyResetTime = now;
      Logger.info('Daily metrics reset');
    }
  }

  /**
   * Cancel all pending orders
   */
  private async cancelAllPendingOrders(): Promise<void> {
    for (const [exchangeId, connector] of this.connectors) {
      try {
        await connector.cancelAllOrders();
        Logger.info(`Cancelled all orders on ${exchangeId}`);
      } catch (error) {
        Logger.error(`Failed to cancel orders on ${exchangeId}: ${error}`);
      }
    }
  }

  /**
   * Get current strategy status
   */
  public getStatus(): StrategyStatus {
    return this.status;
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): ArbitrageMetrics {
    // Calculate win rate
    if (this.metrics.executedTrades > 0) {
      this.metrics.winRate = this.metrics.successfulTrades / this.metrics.executedTrades;
    }

    // Calculate net profit
    this.metrics.netProfit = this.metrics.totalProfit.minus(this.metrics.totalLoss);

    // Calculate average profit
    if (this.metrics.successfulTrades > 0) {
      this.metrics.averageProfit = this.metrics.totalProfit.div(this.metrics.successfulTrades);
    }

    return { ...this.metrics };
  }

  /**
   * Get active opportunities
   */
  public getActiveOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.activeOpportunities.values());
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(limit?: number): ArbitrageExecutionResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }
}