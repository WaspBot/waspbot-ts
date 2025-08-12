/**
 * Market data types for WaspBot-TS
 *
 * This module provides comprehensive market data structures and interfaces
 * compatible with major cryptocurrency exchanges, inspired by Hummingbot's architecture.
 */

import {
  Timestamp,
  ExchangeId,
  TradingPair,
  TradeId,
  DecimalAmount,
  TradingSide,
  HealthStatus,
} from './common';

// ============================================================================
// Basic Market Data Types
// ============================================================================

/**
 * Trading pair information with metadata
 */
export interface TradingPairInfo {
  symbol: TradingPair;
  baseAsset: string;
  quoteAsset: string;
  status: TradingPairStatus;
  minPrice?: DecimalAmount;
  maxPrice?: DecimalAmount;
  minQuantity?: DecimalAmount;
  maxQuantity?: DecimalAmount;
  stepSize?: DecimalAmount;
  tickSize?: DecimalAmount;
  minNotional?: DecimalAmount;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  permissions: string[];
}

export enum TradingPairStatus {
  TRADING = 'TRADING',
  HALT = 'HALT',
  BREAK = 'BREAK',
  AUCTION_MATCH = 'AUCTION_MATCH',
  PRE_TRADING = 'PRE_TRADING',
  POST_TRADING = 'POST_TRADING',
}

/**
 * Real-time ticker information for a trading pair
 */
export interface Ticker {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  openPrice: DecimalAmount;
  highPrice: DecimalAmount;
  lowPrice: DecimalAmount;
  lastPrice: DecimalAmount;
  volume: DecimalAmount;
  quoteVolume: DecimalAmount;
  priceChange: DecimalAmount;
  priceChangePercent: DecimalAmount;
  weightedAvgPrice: DecimalAmount;
  prevClosePrice?: DecimalAmount;
  lastQuantity?: DecimalAmount;
  bidPrice?: DecimalAmount;
  bidQuantity?: DecimalAmount;
  askPrice?: DecimalAmount;
  askQuantity?: DecimalAmount;
  openTime: Timestamp;
  closeTime: Timestamp;
  firstId?: TradeId;
  lastId?: TradeId;
  count: number;
  timestamp: Timestamp;
}

/**
 * Individual trade execution data
 */
export interface Trade {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  tradeId: TradeId;
  orderId?: string;
  price: DecimalAmount;
  quantity: DecimalAmount;
  quoteQuantity: DecimalAmount;
  side: TradingSide;
  timestamp: Timestamp;
  isBuyerMaker: boolean;
  isBestMatch?: boolean;
}

/**
 * OHLCV candlestick data
 */
export interface Candle {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  interval: CandleInterval;
  openTime: Timestamp;
  closeTime: Timestamp;
  open: DecimalAmount;
  high: DecimalAmount;
  low: DecimalAmount;
  close: DecimalAmount;
  volume: DecimalAmount;
  quoteVolume: DecimalAmount;
  takerBuyBaseVolume: DecimalAmount;
  takerBuyQuoteVolume: DecimalAmount;
  numberOfTrades: number;
  isClosed: boolean;
}

export enum CandleInterval {
  ONE_MINUTE = '1m',
  THREE_MINUTES = '3m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  TWO_HOURS = '2h',
  FOUR_HOURS = '4h',
  SIX_HOURS = '6h',
  EIGHT_HOURS = '8h',
  TWELVE_HOURS = '12h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1M',
}

// ============================================================================
// Order Book Types
// ============================================================================

/**
 * Order book entry representing a price level
 */
export interface OrderBookEntry {
  price: DecimalAmount;
  quantity: DecimalAmount;
  updateId?: number;
}

/**
 * Complete order book snapshot
 */
export interface OrderBook {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
  timestamp: Timestamp;
  eventTime?: Timestamp;
}

/**
 * Order book differential update
 */
export interface OrderBookDiff {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  firstUpdateId: number;
  finalUpdateId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Timestamp;
  eventTime?: Timestamp;
}

/**
 * Order book query result for price/volume calculations
 */
export interface OrderBookQueryResult {
  price: DecimalAmount;
  quantity: DecimalAmount;
  totalVolume: DecimalAmount;
  totalQuoteVolume: DecimalAmount;
  averagePrice: DecimalAmount;
  priceImpact: DecimalAmount;
}

// ============================================================================
// Market Analysis Types
// ============================================================================

/**
 * Market depth analysis for liquidity assessment
 */
export interface MarketDepth {
  symbol: TradingPair;
  exchangeId: ExchangeId;
  timestamp: Timestamp;
  bidDepth: DepthLevel[];
  askDepth: DepthLevel[];
  midPrice: DecimalAmount;
  spread: DecimalAmount;
  spreadPercentage: DecimalAmount;
  totalBidVolume: DecimalAmount;
  totalAskVolume: DecimalAmount;
  imbalanceRatio: DecimalAmount; // (bid_volume - ask_volume) / (bid_volume + ask_volume)
}

export interface DepthLevel {
  price: DecimalAmount;
  quantity: DecimalAmount;
  cumulativeVolume: DecimalAmount;
  cumulativeQuoteVolume: DecimalAmount;
  orderCount?: number;
}

/**
 * Volume analysis for market activity assessment
 */
export interface VolumeAnalysis {
  symbol: TradingPair;
  exchangeId: ExchangeId;
  timestamp: Timestamp;
  period: string; // e.g., '1h', '24h', '7d'
  totalVolume: DecimalAmount;
  totalQuoteVolume: DecimalAmount;
  buyVolume: DecimalAmount;
  sellVolume: DecimalAmount;
  buyToSellRatio: DecimalAmount;
  averageTradeSize: DecimalAmount;
  medianTradeSize: DecimalAmount;
  largeTradeThreshold: DecimalAmount;
  largeTradeCount: number;
  largeTradeVolume: DecimalAmount;
  volumeWeightedAveragePrice: DecimalAmount;
}

/**
 * Liquidity metrics for market making strategies
 */
export interface LiquidityMetrics {
  symbol: TradingPair;
  exchangeId: ExchangeId;
  timestamp: Timestamp;
  topOfBookSpread: DecimalAmount;
  topOfBookSpreadBps: DecimalAmount; // basis points
  effectiveSpread: DecimalAmount;
  effectiveSpreadBps: DecimalAmount;
  depthAt5Bps: DecimalAmount; // liquidity within 5 basis points of mid
  depthAt10Bps: DecimalAmount;
  depthAt25Bps: DecimalAmount;
  depthAt50Bps: DecimalAmount;
  depthAt100Bps: DecimalAmount;
  averageOrderSize: DecimalAmount;
  orderBookSlope: DecimalAmount; // price impact per unit volume
  resilienceScore: DecimalAmount; // recovery speed after large trades
  liquidityScore: DecimalAmount; // overall liquidity assessment
}

// ============================================================================
// Market Data Feed and Subscription Types
// ============================================================================

/**
 * Market data subscription configuration
 */
export interface MarketDataSubscription {
  id: string;
  exchangeId: ExchangeId;
  symbol: TradingPair;
  dataTypes: MarketDataType[];
  isActive: boolean;
  lastUpdate: Timestamp;
  errorCount: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export enum MarketDataType {
  TICKER = 'ticker',
  ORDER_BOOK_SNAPSHOT = 'orderBookSnapshot',
  ORDER_BOOK_DIFF = 'orderBookDiff',
  TRADE = 'trade',
  CANDLES = 'candles',
  MARKET_DEPTH = 'marketDepth',
  VOLUME_ANALYSIS = 'volumeAnalysis',
  LIQUIDITY_METRICS = 'liquidityMetrics',
}

/**
 * Market data feed status tracking
 */
export interface MarketDataFeedStatus {
  exchangeId: ExchangeId;
  status: FeedStatus;
  connectedStreams: number;
  totalStreams: number;
  lastHeartbeat: Timestamp;
  avgLatency: number; // milliseconds
  errorRate: number; // errors per minute
  dataRate: number; // messages per second
  reconnectCount: number;
  uptime: number; // milliseconds since last connect
  health: HealthStatus;
}

export enum FeedStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE',
}

/**
 * Generic market data event wrapper
 */
export interface MarketDataEvent<T = any> {
  type: MarketDataType;
  exchangeId: ExchangeId;
  symbol: TradingPair;
  timestamp: Timestamp;
  data: T;
  latency?: number; // milliseconds from exchange timestamp
  sequence?: number; // for ordering events
}

// ============================================================================
// Price Calculation and Aggregation Utilities
// ============================================================================

/**
 * Price calculation configuration
 */
export interface PriceCalculationConfig {
  method: PriceCalculationMethod;
  sources: ExchangeId[];
  weights?: Record<ExchangeId, number>;
  outlierThreshold?: number; // standard deviations
  maxAge?: number; // milliseconds
  minSources?: number;
}

export enum PriceCalculationMethod {
  SIMPLE_AVERAGE = 'simple_average',
  WEIGHTED_AVERAGE = 'weighted_average',
  VOLUME_WEIGHTED_AVERAGE = 'volume_weighted_average',
  MEDIAN = 'median',
  MODE = 'mode',
}

/**
 * Aggregated price information from multiple sources
 */
export interface AggregatedPrice {
  symbol: TradingPair;
  timestamp: Timestamp;
  price: DecimalAmount;
  method: PriceCalculationMethod;
  sources: ExchangeId[];
  confidence: number; // 0-1 scale
  spread: DecimalAmount;
  volume: DecimalAmount;
  sourceCount: number;
  outliers: ExchangeId[];
}

/**
 * Market data cache configuration
 */
export interface MarketDataCacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // number of entries
  compressionEnabled: boolean;
  persistToDisk: boolean;
  cleanupInterval: number; // milliseconds
}

/**
 * Market data statistics for monitoring
 */
export interface MarketDataStatistics {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  dataType: MarketDataType;
  period: string;
  messageCount: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  errorCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
  gapCount: number;
  dataQualityScore: number; // 0-1 scale
  timestamp: Timestamp;
}

// ============================================================================
// Market Data Provider Interface
// ============================================================================

/**
 * Market data provider interface for exchange connectors
 */
export interface MarketDataProvider {
  exchangeId: ExchangeId;

  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): MarketDataFeedStatus;

  // Subscription management
  subscribe(subscription: MarketDataSubscription): Promise<void>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getActiveSubscriptions(): MarketDataSubscription[];

  // Data retrieval
  getTicker(symbol: TradingPair): Promise<Ticker>;
  getOrderBook(symbol: TradingPair, limit?: number): Promise<OrderBook>;
  getTrades(symbol: TradingPair, limit?: number): Promise<Trade[]>;
  getCandles(symbol: TradingPair, interval: CandleInterval, limit?: number): Promise<Candle[]>;

  // Market analysis
  getMarketDepth(symbol: TradingPair, limit?: number): Promise<MarketDepth>;
  getVolumeAnalysis(symbol: TradingPair, period: string): Promise<VolumeAnalysis>;
  getLiquidityMetrics(symbol: TradingPair): Promise<LiquidityMetrics>;

  // Utility methods
  calculatePrice(config: PriceCalculationConfig): Promise<AggregatedPrice>;
  getStatistics(symbol?: TradingPair, dataType?: MarketDataType): Promise<MarketDataStatistics[]>;
}

// ============================================================================
// Market Data Event Handlers
// ============================================================================

export type TickerHandler = (ticker: Ticker) => void;
export type OrderBookHandler = (orderBook: OrderBook) => void;
export type OrderBookDiffHandler = (diff: OrderBookDiff) => void;
export type TradeHandler = (trade: Trade) => void;
export type CandleHandler = (candle: Candle) => void;
export type MarketDepthHandler = (depth: MarketDepth) => void;
export type VolumeAnalysisHandler = (analysis: VolumeAnalysis) => void;
export type LiquidityMetricsHandler = (metrics: LiquidityMetrics) => void;

/**
 * Market data event handlers registry
 */
export interface MarketDataEventHandlers {
  onTicker?: TickerHandler;
  onOrderBook?: OrderBookHandler;
  onOrderBookDiff?: OrderBookDiffHandler;
  onTrade?: TradeHandler;
  onCandle?: CandleHandler;
  onMarketDepth?: MarketDepthHandler;
  onVolumeAnalysis?: VolumeAnalysisHandler;
  onLiquidityMetrics?: LiquidityMetricsHandler;
  onError?: (error: Error) => void;
  onStatusChange?: (status: MarketDataFeedStatus) => void;
}

// ============================================================================
// Utility Functions Types
// ============================================================================

/**
 * Order book utility functions interface
 */
export interface OrderBookUtils {
  getMidPrice(orderBook: OrderBook): DecimalAmount;
  getSpread(orderBook: OrderBook): DecimalAmount;
  getSpreadPercentage(orderBook: OrderBook): DecimalAmount;
  getBestBid(orderBook: OrderBook): OrderBookEntry | null;
  getBestAsk(orderBook: OrderBook): OrderBookEntry | null;
  getPriceForVolume(
    orderBook: OrderBook,
    volume: DecimalAmount,
    side: TradingSide
  ): OrderBookQueryResult;
  getVolumeForPrice(orderBook: OrderBook, price: DecimalAmount, side: TradingSide): DecimalAmount;
  calculatePriceImpact(
    orderBook: OrderBook,
    volume: DecimalAmount,
    side: TradingSide
  ): DecimalAmount;
  validateOrderBook(orderBook: OrderBook): boolean;
}

/**
 * Price utility functions interface
 */
export interface PriceUtils {
  calculateVWAP(trades: Trade[], period?: number): DecimalAmount;
  calculateTWAP(
    prices: Array<{ price: DecimalAmount; timestamp: Timestamp }>,
    period?: number
  ): DecimalAmount;
  detectAnomalies(prices: DecimalAmount[], threshold?: number): number[];
  normalizePrice(price: DecimalAmount, decimals: number): DecimalAmount;
  formatPrice(price: DecimalAmount, symbol: TradingPair): string;
}

/**
 * Volume utility functions interface
 */
export interface VolumeUtils {
  aggregateVolumeByPeriod(
    trades: Trade[],
    interval: CandleInterval
  ): Record<Timestamp, DecimalAmount>;
  calculateMovingAverage(volumes: DecimalAmount[], window: number): DecimalAmount[];
  detectVolumeSurges(volumes: DecimalAmount[], threshold?: number): number[];
  normalizeVolume(volume: DecimalAmount, symbol: TradingPair): DecimalAmount;
}

// Export all types for easy import
export type {
  // Re-export from common for convenience
  Timestamp,
  ExchangeId,
  TradingPair,
  TradeId,
  DecimalAmount,
  TradingSide,
};
