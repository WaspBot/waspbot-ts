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
  private spreadHistory: Decimal[] = [];
  private priceHistory: Decimal[] = [];

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

    if (ticker.bidPrice && ticker.askPrice) {
      const bid = new Decimal(ticker.bidPrice);
      const ask = new Decimal(ticker.askPrice);
      this.spreadHistory.push(ask.minus(bid));
      if (this.spreadHistory.length > this.windowSize) {
        this.spreadHistory.shift();
      }
    }

    this.priceHistory.push(new Decimal(ticker.lastPrice));
    if (this.priceHistory.length > this.windowSize) {
      this.priceHistory.shift();
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

  get rollingSpreadWidth(): DecimalAmount | undefined {
    if (this.spreadHistory.length === 0) {
      return undefined;
    }
    const sum = this.spreadHistory.reduce((acc, spread) => acc.plus(spread), new Decimal(0));
    return sum.dividedBy(this.spreadHistory.length) as DecimalAmount;
  }

  get shortTermVolatility(): DecimalAmount | undefined {
    if (this.priceHistory.length < 2) {
      return undefined;
    }

    const logReturns: Decimal[] = [];
    for (let i = 1; i < this.priceHistory.length; i++) {
      const currentPrice = this.priceHistory[i];
      const previousPrice = this.priceHistory[i - 1];
      if (!previousPrice.isZero() && !currentPrice.isZero()) {
        logReturns.push(currentPrice.dividedBy(previousPrice).ln());
      }
    }

    if (logReturns.length === 0) {
      return undefined;
    }

    const sumReturns = logReturns.reduce((acc, ret) => acc.plus(ret), new Decimal(0));
    const meanReturn = sumReturns.dividedBy(logReturns.length);

    const sumOfSquaredDifferences = logReturns.reduce(
      (acc, ret) => acc.plus(ret.minus(meanReturn).pow(2)),
      new Decimal(0),
    );

    // Using sample standard deviation (n-1 degrees of freedom)
    if (logReturns.length < 2) {
      return undefined;
    }

    const variance = sumOfSquaredDifferences.dividedBy(new Decimal(logReturns.length - 1));
    return variance.sqrt() as DecimalAmount;
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
