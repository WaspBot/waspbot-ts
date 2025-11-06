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

export class OrderBookManager {
  private orderBook: OrderBook;
  private readonly checksumInterval: number = 1000; // Checksum every 1000 updates
  private lastChecksum: number = 0;
  private updateCount: number = 0;
  private resubscribeCallback: () => void;

  constructor(initialSnapshot: OrderBook, resubscribeCallback: () => void) {
    this.orderBook = initialSnapshot;
    this.resubscribeCallback = resubscribeCallback;
    this.calculateAndStoreChecksum();
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

    this.updateCount++;
    if (this.updateCount % this.checksumInterval === 0) {
      this.verifyChecksum();
    }
  }

  public getOrderBook(): OrderBook {
    return { ...this.orderBook };
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
    // Simple checksum: sum of prices and quantities of top N bids and asks
    const N = 10; // Number of top entries to consider for checksum
    let checksum = 0;

    for (let i = 0; i < Math.min(N, this.orderBook.bids.length); i++) {
      checksum += this.orderBook.bids[i].price.toNumber() * 1000000 + this.orderBook.bids[i].quantity.toNumber();
    }
    for (let i = 0; i < Math.min(N, this.orderBook.asks.length); i++) {
      checksum += this.orderBook.asks[i].price.toNumber() * 1000000 + this.orderBook.asks[i].quantity.toNumber();
    }
    return checksum;
  }

  private calculateAndStoreChecksum(): void {
    this.lastChecksum = this.calculateChecksum();
  }

  private verifyChecksum(): void {
    const currentChecksum = this.calculateChecksum();
    if (currentChecksum !== this.lastChecksum) {
      console.warn(`Checksum mismatch for ${this.orderBook.symbol}. Triggering resubscribe.`);
      this.resubscribeCallback();
    }
    this.lastChecksum = currentChecksum; // Update for next interval
  }
}

