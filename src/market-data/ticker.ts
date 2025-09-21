/**
 * Ticker data types for WaspBot-TS
 */

import {
  Timestamp,
  ExchangeId,
  TradingPair,
  TradeId,
  DecimalAmount,
  TradingSide,
} from '../types/common.js';

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