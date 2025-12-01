import { Ticker, TickerManager } from '../src/market-data/ticker';
import { DecimalAmount } from '../src/types/common';
import { Decimal } from 'decimal.js'; // Import Decimal

describe('TickerManager', () => {
  let mockTicker1: Ticker;
  let mockTicker2: Ticker;
  let mockTicker3: Ticker;
  let mockTicker4: Ticker;
  let mockTicker5: Ticker;


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

    // Ticker with different spread for rolling spread width test
    mockTicker4 = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      openPrice: new Decimal('10150') as DecimalAmount,
      highPrice: new Decimal('10250') as DecimalAmount,
      lowPrice: new Decimal('10050') as DecimalAmount,
      lastPrice: new Decimal('10200') as DecimalAmount,
      volume: new Decimal('12') as DecimalAmount,
      quoteVolume: new Decimal('122400') as DecimalAmount,
      priceChange: new Decimal('50') as DecimalAmount,
      priceChangePercent: new Decimal('0.5') as DecimalAmount,
      weightedAvgPrice: new Decimal('10175') as DecimalAmount,
      bidPrice: new Decimal('10190') as DecimalAmount,
      bidQuantity: new Decimal('3') as DecimalAmount,
      askPrice: new Decimal('10220') as DecimalAmount, // Spread of 30
      askQuantity: new Decimal('5') as DecimalAmount,
      openTime: Date.now() - 5000,
      closeTime: Date.now(),
      count: 130,
      timestamp: Date.now(),
    };

    // Ticker with same spread as mockTicker1 for volatility test
    mockTicker5 = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      openPrice: new Decimal('10200') as DecimalAmount,
      highPrice: new Decimal('10300') as DecimalAmount,
      lowPrice: new Decimal('10100') as DecimalAmount,
      lastPrice: new Decimal('10250') as DecimalAmount,
      volume: new Decimal('18') as DecimalAmount,
      quoteVolume: new Decimal('184500') as DecimalAmount,
      priceChange: new Decimal('50') as DecimalAmount,
      priceChangePercent: new Decimal('0.5') as DecimalAmount,
      weightedAvgPrice: new Decimal('10225') as DecimalAmount,
      bidPrice: new Decimal('10240') as DecimalAmount,
      bidQuantity: new Decimal('6') as DecimalAmount,
      askPrice: new Decimal('10260') as DecimalAmount, // Spread of 20
      askQuantity: new Decimal('8') as DecimalAmount,
      openTime: Date.now(),
      closeTime: Date.now(),
      count: 140,
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

    it('should correctly store bid/ask spread in spreadHistory', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1); // Spread 20
      manager.addTicker(mockTicker4); // Spread 30
      expect(manager['spreadHistory'].length).toBe(2);
      expect(manager['spreadHistory'][0]).toEqual(new Decimal(20));
      expect(manager['spreadHistory'][1]).toEqual(new Decimal(30));
    });

    it('should correctly store lastPrice in priceHistory', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1); // Last Price 10050
      manager.addTicker(mockTicker2); // Last Price 10100
      expect(manager['priceHistory'].length).toBe(2);
      expect(manager['priceHistory'][0]).toEqual(new Decimal(10050));
      expect(manager['priceHistory'][1]).toEqual(new Decimal(10100));
    });

    it('should maintain spreadHistory window size', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1); // Spread 20
      manager.addTicker(mockTicker4); // Spread 30
      manager.addTicker(mockTicker5); // Spread 20 (newest)

      expect(manager['spreadHistory'].length).toBe(2);
      expect(manager['spreadHistory'][0]).toEqual(new Decimal(30)); // Oldest (mockTicker1) should be removed
      expect(manager['spreadHistory'][1]).toEqual(new Decimal(20));
    });

    it('should maintain priceHistory window size', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1); // Price 10050
      manager.addTicker(mockTicker2); // Price 10100
      manager.addTicker(mockTicker3); // Price 10150

      expect(manager['priceHistory'].length).toBe(2);
      expect(manager['priceHistory'][0]).toEqual(new Decimal(10100)); // Oldest (mockTicker1) should be removed
      expect(manager['priceHistory'][1]).toEqual(new Decimal(10150));
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

  describe('rollingSpreadWidth', () => {
    it('should return undefined when no tickers are present', () => {
      const manager = new TickerManager(2);
      expect(manager.rollingSpreadWidth).toBeUndefined();
    });

    it('should calculate rolling spread width correctly with a single ticker', () => {
      const manager = new TickerManager(1);
      manager.addTicker(mockTicker1); // Spread 20
      expect(manager.rollingSpreadWidth).toEqual(new Decimal(20));
    });

    it('should calculate rolling spread width correctly with multiple tickers within window', () => {
      const manager = new TickerManager(3);
      manager.addTicker(mockTicker1); // Spread 20
      manager.addTicker(mockTicker2); // Spread 20
      manager.addTicker(mockTicker4); // Spread 30

      // (20 + 20 + 30) / 3 = 70 / 3 = 23.333333333333333333
      const expectedRollingSpread = new Decimal('23.333333333333333333');
      expect(manager.rollingSpreadWidth).toEqual(expectedRollingSpread);
    });

    it('should calculate rolling spread width correctly when window size is exceeded', () => {
      const manager = new TickerManager(2);
      manager.addTicker(mockTicker1); // Spread 20 (removed)
      manager.addTicker(mockTicker4); // Spread 30
      manager.addTicker(mockTicker5); // Spread 20

      // (30 + 20) / 2 = 25
      const expectedRollingSpread = new Decimal(25);
      expect(manager.rollingSpreadWidth).toEqual(expectedRollingSpread);
    });
  });

  describe('shortTermVolatility', () => {
    it('should return undefined when no tickers are present', () => {
      const manager = new TickerManager(2);
      expect(manager.shortTermVolatility).toBeUndefined();
    });

    it('should return undefined when only one ticker is present', () => {
      const manager = new TickerManager(1);
      manager.addTicker(mockTicker1);
      expect(manager.shortTermVolatility).toBeUndefined();
    });

    it('should calculate short-term volatility correctly with multiple tickers', () => {
      const manager = new TickerManager(3); // Window size 3
      // Prices: 10050, 10100, 10150
      manager.addTicker(mockTicker1);
      manager.addTicker(mockTicker2);
      manager.addTicker(mockTicker3);

      // Log returns:
      // ln(10100/10050) = ln(1.0049751243781094) = 0.0049627706
      // ln(10150/10100) = ln(1.004950495049505) = 0.0049383604

      // Mean log return: (0.0049627706 + 0.0049383604) / 2 = 0.0049505655
      // Differences from mean:
      // 0.0049627706 - 0.0049505655 = 0.0000122051
      // 0.0049383604 - 0.0049505655 = -0.0000122051

      // Squared differences:
      // (0.0000122051)^2 = 1.4896444801e-10
      // (-0.0000122051)^2 = 1.4896444801e-10

      // Sum of squared differences = 2.9792889602e-10

      // Variance (sample, n-1): 2.9792889602e-10 / (2 - 1) = 2.9792889602e-10
      // Volatility (sqrt of variance): sqrt(2.9792889602e-10) = 0.000017260565

      const expectedVolatility = new Decimal('0.000017260565'); // Approximate value, adjust precision if needed
      expect(manager.shortTermVolatility?.toFixed(12)).toEqual(expectedVolatility.toFixed(12));
    });

    it('should return 0 volatility for constant prices', () => {
      const manager = new TickerManager(3);
      const constantPriceTicker1 = { ...mockTicker1, lastPrice: new Decimal('10000') as DecimalAmount };
      const constantPriceTicker2 = { ...mockTicker2, lastPrice: new Decimal('10000') as DecimalAmount };
      const constantPriceTicker3 = { ...mockTicker3, lastPrice: new Decimal('10000') as DecimalAmount };

      manager.addTicker(constantPriceTicker1);
      manager.addTicker(constantPriceTicker2);
      manager.addTicker(constantPriceTicker3);

      expect(manager.shortTermVolatility).toEqual(new Decimal(0));
    });

    it('should calculate short-term volatility correctly when window size is exceeded', () => {
      const manager = new TickerManager(2); // Window size 2
      // Prices: 10050 (removed), 10100, 10150 (current window)
      manager.addTicker(mockTicker1);
      manager.addTicker(mockTicker2);
      manager.addTicker(mockTicker3);

      // Current window prices: 10100, 10150
      // Log return: ln(10150/10100) = ln(1.004950495049505) = 0.0049383604

      // With only one log return, mean is the return itself.
      // Sum of squared differences for (n-1) = 1 is 0.
      // This case should not happen given the current implementation where n-1 is used for variance,
      // and it expects at least 2 log returns for meaningful standard deviation.
      // Re-evaluate the test for shortTermVolatility with window size 2 and 3 tickers to confirm
      // the expected behavior with (n-1) in standard deviation.

      // As per the code, if logReturns.length < 2, it returns undefined.
      // In this specific test case, logReturns.length will be 1 (from 10100, 10150).
      // So, it should return undefined.

      expect(manager.shortTermVolatility).toBeUndefined();
    });
  });
});
