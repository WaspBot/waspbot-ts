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
import { Decimal } from 'decimal.js';

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

export class TickerManager {
  private windowSize: number;
  private tickers: Ticker[] = [];

  constructor(windowSize: number) {
    if (windowSize <= 0) {
      throw new Error('Window size must be a positive number.');
    }
    this.windowSize = windowSize;
  }

  addTicker(ticker: Ticker): void {
    this.tickers.push(ticker);
    if (this.tickers.length > this.windowSize) {
      this.tickers.shift(); // Remove the oldest ticker
    }
  }

  get vwap(): DecimalAmount | undefined {
    if (this.tickers.length === 0) {
      return undefined;
    }

    let totalVolume = new Decimal(0);
    let totalQuoteVolume = new Decimal(0);

    for (const ticker of this.tickers) {
      totalVolume = totalVolume.plus(new Decimal(ticker.volume));
      totalQuoteVolume = totalQuoteVolume.plus(new Decimal(ticker.quoteVolume));
    }

    if (totalVolume.isZero()) {
      return undefined;
    }

    return totalQuoteVolume.dividedBy(totalVolume) as DecimalAmount;
  }

  get bidAskSpread(): DecimalAmount | undefined {
    if (this.tickers.length === 0) {
      return undefined;
    }

    // Use the latest ticker for bid/ask spread
    const latestTicker = this.tickers[this.tickers.length - 1];

    if (latestTicker.bidPrice && latestTicker.askPrice) {
      const bid = new Decimal(latestTicker.bidPrice);
      const ask = new Decimal(latestTicker.askPrice);
      return ask.minus(bid) as DecimalAmount;
    }

    return undefined;
  }
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
