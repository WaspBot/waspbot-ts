import { Ticker, TickerManager } from '../src/market-data/ticker';
import { DecimalAmount } from '../src/types/common';
import { Decimal } from 'decimal.js'; // Import Decimal

describe('TickerManager', () => {
  let mockTicker1: Ticker;
  let mockTicker2: Ticker;
  let mockTicker3: Ticker;

  beforeEach(() => {
    mockTicker1 = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      openPrice: new Decimal('10000') as DecimalAmount,
      highPrice: new Decimal('10100') as DecimalAmount,
      lowPrice: new Decimal('9900') as DecimalAmount,
      lastPrice: new Decimal('10050') as DecimalAmount,
      volume: new Decimal('10') as DecimalAmount,
      quoteVolume: new Decimal('100500') as DecimalAmount,
      priceChange: new Decimal('50') as DecimalAmount,
      priceChangePercent: new Decimal('0.5') as DecimalAmount,
      weightedAvgPrice: new Decimal('10025') as DecimalAmount,
      bidPrice: new Decimal('10040') as DecimalAmount,
      bidQuantity: new Decimal('2') as DecimalAmount,
      askPrice: new Decimal('10060') as DecimalAmount,
      askQuantity: new Decimal('3') as DecimalAmount,
      openTime: Date.now() - 30000,
      closeTime: Date.now(),
      count: 100,
      timestamp: Date.now(),
    };

    mockTicker2 = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      openPrice: new Decimal('10050') as DecimalAmount,
      highPrice: new Decimal('10150') as DecimalAmount,
      lowPrice: new Decimal('9950') as DecimalAmount,
      lastPrice: new Decimal('10100') as DecimalAmount,
      volume: new Decimal('20') as DecimalAmount,
      quoteVolume: new Decimal('202000') as DecimalAmount,
      priceChange: new Decimal('50') as DecimalAmount,
      priceChangePercent: new Decimal('0.5') as DecimalAmount,
      weightedAvgPrice: new Decimal('10075') as DecimalAmount,
      bidPrice: new Decimal('10090') as DecimalAmount,
      bidQuantity: new Decimal('5') as DecimalAmount,
      askPrice: new Decimal('10110') as DecimalAmount,
      askQuantity: new Decimal('7') as DecimalAmount,
      openTime: Date.now() - 20000,
      closeTime: Date.now(),
      count: 110,
      timestamp: Date.now(),
    };

    mockTicker3 = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      openPrice: new Decimal('10100') as DecimalAmount,
      highPrice: new Decimal('10200') as DecimalAmount,
      lowPrice: new Decimal('10000') as DecimalAmount,
      lastPrice: new Decimal('10150') as DecimalAmount,
      volume: new Decimal('15') as DecimalAmount,
      quoteVolume: new Decimal('152250') as DecimalAmount,
      priceChange: new Decimal('50') as DecimalAmount,
      priceChangePercent: new Decimal('0.5') as DecimalAmount,
      weightedAvgPrice: new Decimal('10125') as DecimalAmount,
      bidPrice: new Decimal('10140') as DecimalAmount,
      bidQuantity: new Decimal('4') as DecimalAmount,
      askPrice: new Decimal('10160') as DecimalAmount,
      askQuantity: new Decimal('6') as DecimalAmount,
      openTime: Date.now() - 10000,
      closeTime: Date.now(),
      count: 120,
      timestamp: Date.now(),
    };
  });

  describe('constructor', () => {
    it('should initialize with a given window size', () => {
      const manager = new TickerManager(5);
      expect(manager).toBeInstanceOf(TickerManager);
    });

    it('should throw an error for invalid window size (0)', () => {
      expect(() => new TickerManager(0)).toThrow('Window size must be a positive number.');
    });

    it('should throw an error for invalid window size (negative)', () => {
      expect(() => new TickerManager(-1)).toThrow('Window size must be a positive number.');
    });
  });

  describe('addTicker', () => {
    it('should add tickers correctly', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1);
      expect(manager['tickers'].length).toBe(1);
      expect(manager['tickers'][0]).toEqual(mockTicker1);
    });

    it('should maintain the window size by removing the oldest ticker', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1);
      manager.addTicker(mockTicker2);
      manager.addTicker(mockTicker3);

      expect(manager['tickers'].length).toBe(2);
      expect(manager['tickers'][0]).toEqual(mockTicker2);
      expect(manager['tickers'][1]).toEqual(mockTicker3);
    });
  });

  describe('vwap', () => {
    it('should return undefined when no tickers are present', () => {
      const manager = new TickerManager(2);
      expect(manager.vwap).toBeUndefined();
    });

    it('should calculate VWAP correctly with multiple tickers', () => {
      const manager = new TickerManager(3);
      manager.addTicker(mockTicker1);
      manager.addTicker(mockTicker2);
      manager.addTicker(mockTicker3);

      // (100500 + 202000 + 152250) / (10 + 20 + 15) = 454750 / 45 = 10094.444444444445
      const expectedVwap = new Decimal('10094.444444444445');
      expect(manager.vwap).toEqual(expectedVwap);
    });

    it('should handle cases where total volume is zero', () => {
      const manager = new TickerManager(1);
      const tickerWithZeroVolume = { ...mockTicker1, volume: new Decimal('0') as DecimalAmount, quoteVolume: new Decimal('0') as DecimalAmount };
      manager.addTicker(tickerWithZeroVolume);
      expect(manager.vwap).toBeUndefined();
    });
  });

  describe('bidAskSpread', () => {
    it('should return undefined when no tickers are present', () => {
      const manager = new TickerManager(2);
      expect(manager.bidAskSpread).toBeUndefined();
    });

    it('should return undefined if bidPrice or askPrice are missing in the latest ticker', () => {
      const manager = new TickerManager(1);
      const tickerWithoutBid = { ...mockTicker1, bidPrice: undefined };
      manager.addTicker(tickerWithoutBid);
      expect(manager.bidAskSpread).toBeUndefined();

      const tickerWithoutAsk = { ...mockTicker1, askPrice: undefined };
      manager.addTicker(tickerWithoutAsk);
      expect(manager.bidAskSpread).toBeUndefined();
    });

    it('should calculate bid-ask spread correctly using the latest ticker', () => {
      const manager = new TickerManager(3);
      manager.addTicker(mockTicker1);
      manager.addTicker(mockTicker2);
      manager.addTicker(mockTicker3);

      // Latest ticker is mockTicker3: askPrice (10160) - bidPrice (10140) = 20
      const expectedSpread = new Decimal('20');
      expect(manager.bidAskSpread).toEqual(expectedSpread);
    });
  });
});