/**
 * Order book data types for WaspBot-TS
 */

import { Timestamp, ExchangeId, TradingPair, DecimalAmount } from '../types/common.js';
import { Decimal } from 'decimal.js';

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

/**
 * Rolling bid/ask imbalance metric
 */
export interface RollingImbalance {
  timestamp: Timestamp;
  imbalance: DecimalAmount;
}

export class OrderBookManager {
  private orderBook: OrderBook;
  private readonly checksumInterval: number = 1000; // Checksum every 1000 updates
  private lastChecksum: number = 0;
  private updateCount: number = 0;
  private resubscribeCallback: () => void;
  private imbalanceHistory: RollingImbalance[] = [];
  private rollingImbalanceWindowSize: number;

  constructor(initialSnapshot: OrderBook, resubscribeCallback: () => void, rollingImbalanceWindowSize: number = 100) {
    if (!initialSnapshot) {
      throw new Error('Initial snapshot cannot be null or undefined.');
    }

    const requiredFields = ['exchangeId', 'symbol', 'bids', 'asks', 'lastUpdateId', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in initialSnapshot) || initialSnapshot[field] === undefined || initialSnapshot[field] === null) {
        throw new Error(`Initial snapshot is missing required field: ${field}.`);
      }
    }

    if (!Array.isArray(initialSnapshot.bids)) {
      throw new Error('Initial snapshot bids must be an array.');
    }
    if (!Array.isArray(initialSnapshot.asks)) {
      throw new Error('Initial snapshot asks must be an array.');
    }

    // Validate and coerce bids and asks entries
    const validatedBids = OrderBookManager.validateAndCoerceOrderBookEntries(initialSnapshot.bids, 'bids');
    const validatedAsks = OrderBookManager.validateAndCoerceOrderBookEntries(initialSnapshot.asks, 'asks');

    this.orderBook = {
      ...initialSnapshot,
      bids: validatedBids,
      asks: validatedAsks,
    };
    this.resubscribeCallback = resubscribeCallback;
    this.rollingImbalanceWindowSize = rollingImbalanceWindowSize;
    // Calculate and store initial imbalance
    const initialImbalance = this.calculateBidAskImbalance();
    if (initialImbalance !== undefined) {
      this.imbalanceHistory.push({
        timestamp: initialSnapshot.timestamp,
        imbalance: initialImbalance,
      });
    }
    this.calculateAndStoreChecksum();
  }

  private static validateAndCoerceOrderBookEntries(entries: any[], side: 'bids' | 'asks'): OrderBookEntry[] {
    return entries.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`Invalid ${side} entry at index ${index}: must be an object.`);
      }
      if (!('price' in entry) || !('quantity' in entry)) {
        throw new Error(`Invalid ${side} entry at index ${index}: missing 'price' or 'quantity' field.`);
      }

      let price: Decimal;
      let quantity: Decimal;

      try {
        price = new Decimal(entry.price);
        quantity = new Decimal(entry.quantity);
      } catch (e) {
        throw new Error(`Invalid ${side} entry at index ${index}: 'price' or 'quantity' cannot be converted to Decimal. Error: ${e.message}`);
      }

      if (price.isNaN() || quantity.isNaN()) {
        throw new Error(`Invalid ${side} entry at index ${index}: 'price' or 'quantity' resulted in NaN after Decimal conversion.`);
      }

      return {
        price: price,
        quantity: quantity,
        updateId: entry.updateId, // Optional field
      };
    });
  }

  private calculateBidAskImbalance(): DecimalAmount | undefined {
    const totalBidVolume = this.orderBook.bids.reduce((sum, entry) => sum.plus(entry.quantity), new Decimal(0));
    const totalAskVolume = this.orderBook.asks.reduce((sum, entry) => sum.plus(entry.quantity), new Decimal(0));

    const totalVolume = totalBidVolume.plus(totalAskVolume);

    if (totalVolume.isZero()) {
      return undefined;
    }

    return totalBidVolume.minus(totalAskVolume).dividedBy(totalVolume) as DecimalAmount;
  }

  public applyDiff(diff: OrderBookDiff): void {
    // Validate update IDs
    if (diff.firstUpdateId !== this.orderBook.lastUpdateId + 1) {
      console.warn(`Out-of-sync order book for ${this.orderBook.symbol}. Expected firstUpdateId ${this.orderBook.lastUpdateId + 1}, got ${diff.firstUpdateId}. Triggering resubscribe.`);
      this.resubscribeCallback();
      return;
    }

    // Apply bids
    diff.bids.forEach(diffEntry => {
      this.applyEntry(this.orderBook.bids, diffEntry);
    });

    // Apply asks
    diff.asks.forEach(diffEntry => {
      this.applyEntry(this.orderBook.asks, diffEntry);
    });

    // Sort and clean up
    this.orderBook.bids = this.orderBook.bids.filter(entry => entry.quantity.gt(0)).sort((a, b) => b.price.minus(a.price).toNumber());
    this.orderBook.asks = this.orderBook.asks.filter(entry => entry.quantity.gt(0)).sort((a, b) => a.price.minus(b.price).toNumber());

    this.orderBook.lastUpdateId = diff.finalUpdateId;
    this.orderBook.timestamp = diff.timestamp;
    this.orderBook.eventTime = diff.eventTime;

    // Calculate and store rolling imbalance
    const currentImbalance = this.calculateBidAskImbalance();
    if (currentImbalance !== undefined) {
      this.imbalanceHistory.push({
        timestamp: diff.timestamp,
        imbalance: currentImbalance,
      });
      if (this.imbalanceHistory.length > this.rollingImbalanceWindowSize) {
        this.imbalanceHistory.shift(); // Remove the oldest entry
      }
    }

    this.updateCount++;
    if (this.updateCount % this.checksumInterval === 0) {
      this.verifyChecksum();
    }
  }

  public getOrderBook(): OrderBook {
    return {
      ...this.orderBook,
      bids: this.orderBook.bids.map(entry => ({ ...entry })),
      asks: this.orderBook.asks.map(entry => ({ ...entry })),
    };
  }

  public getRollingBidAskImbalance(): DecimalAmount | undefined {
    if (this.imbalanceHistory.length === 0) {
      return undefined;
    }

    const totalImbalance = this.imbalanceHistory.reduce((sum, entry) => sum.plus(entry.imbalance), new Decimal(0));
    return totalImbalance.dividedBy(this.imbalanceHistory.length) as DecimalAmount;
  }

  public toJSONSnapshot(): string {
    const orderBook = this.getOrderBook();
    const rollingImbalance = this.getRollingBidAskImbalance();

    const snapshot = {
      exchangeId: orderBook.exchangeId,
      symbol: orderBook.symbol,
      timestamp: orderBook.timestamp,
      lastUpdateId: orderBook.lastUpdateId,
      bids: orderBook.bids.map(entry => ({ price: entry.price.toString(), quantity: entry.quantity.toString() })),
      asks: orderBook.asks.map(entry => ({ price: entry.price.toString(), quantity: entry.quantity.toString() })),
      rollingBidAskImbalance: rollingImbalance ? rollingImbalance.toString() : undefined,
    };

    return JSON.stringify(snapshot, null, 2);
  }

  private applyEntry(entries: OrderBookEntry[], diffEntry: OrderBookEntry): void {
    const existingIndex = entries.findIndex(entry => entry.price.eq(diffEntry.price));

    if (diffEntry.quantity.gt(0)) {
      if (existingIndex !== -1) {
        entries[existingIndex].quantity = diffEntry.quantity;
      } else {
        entries.push(diffEntry);
      }
    } else {
      if (existingIndex !== -1) {
        entries.splice(existingIndex, 1);
      }
    }
  }

  private calculateChecksum(): number {
    const N = 10; // Number of top entries to consider for checksum
    let checksumString = '';

    for (let i = 0; i < Math.min(N, this.orderBook.bids.length); i++) {
      checksumString += this.orderBook.bids[i].price.toString() + ':' + this.orderBook.bids[i].quantity.toString() + '|';
    }
    for (let i = 0; i < Math.min(N, this.orderBook.asks.length); i++) {
      checksumString += this.orderBook.asks[i].price.toString() + ':' + this.orderBook.asks[i].quantity.toString() + '|';
    }

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < checksumString.length; i++) {
      const char = checksumString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  private calculateAndStoreChecksum(): void {
    this.lastChecksum = this.calculateChecksum();
  }

  private verifyChecksum(): void {
    const currentChecksum = this.calculateChecksum();
    if (currentChecksum !== this.lastChecksum) {
      console.warn(`Checksum mismatch for ${this.orderBook.symbol}. Triggering resubscribe.`);
      this.resubscribeCallback();
      return; // Do not update lastChecksum on mismatch
    }
    this.lastChecksum = currentChecksum; // Update only if checksums match
  }
}

