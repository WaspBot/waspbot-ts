/**
 * Order book data types for WaspBot-TS
 */

import { Timestamp, ExchangeId, TradingPair, DecimalAmount } from '../types/common.js';

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
