import { Decimal } from 'decimal.js';
import { aggregateCandles, Candle, CandleInterval, defaultCandleReducers } from '../src/market-data/candles.js';
import { ExchangeId, TradingPair, DecimalAmount, Timestamp } from '../src/types/common.js';

describe('Candle Aggregation', () => {
  const MOCK_EXCHANGE_ID: ExchangeId = 'binance';
  const MOCK_SYMBOL: TradingPair = 'BTC-USDT';

  // Helper to create a mock 1-minute candle
  const createMockCandle = (openTime: Timestamp, values: {
    open: number; high: number; low: number; close: number; volume: number;
    quoteVolume?: number; takerBuyBaseVolume?: number; takerBuyQuoteVolume?: number;
    numberOfTrades?: number; vwap?: number;
  }): Candle => ({
    exchangeId: MOCK_EXCHANGE_ID,
    symbol: MOCK_SYMBOL,
    interval: CandleInterval.ONE_MINUTE,
    openTime: openTime,
    closeTime: openTime + 60 * 1000 - 1, // 1 minute candle
    open: new Decimal(values.open),
    high: new Decimal(values.high),
    low: new Decimal(values.low),
    close: new Decimal(values.close),
    volume: new Decimal(values.volume),
    quoteVolume: new Decimal(values.quoteVolume ?? values.volume),
    takerBuyBaseVolume: new Decimal(values.takerBuyBaseVolume ?? values.volume / 2),
    takerBuyQuoteVolume: new Decimal(values.takerBuyQuoteVolume ?? values.volume / 2),
    numberOfTrades: values.numberOfTrades ?? 100,
    isClosed: true,
    vwap: new Decimal(values.vwap ?? (values.open + values.close) / 2),
  });

  it('should aggregate 1-minute candles into 5-minute candles with default reducers', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime(); // Fixed base time
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 105, low: 98, close: 102, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 102, high: 108, low: 100, close: 107, volume: 15 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 107, high: 110, low: 105, close: 109, volume: 20 }),
      createMockCandle(baseTime + 3 * 60 * 1000, { open: 109, high: 112, low: 108, close: 111, volume: 25 }),
      createMockCandle(baseTime + 4 * 60 * 1000, { open: 111, high: 115, low: 109, close: 113, volume: 30 }),
      // Next 5-minute candle
      createMockCandle(baseTime + 5 * 60 * 1000, { open: 113, high: 118, low: 110, close: 116, volume: 35 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.FIVE_MINUTES);

    expect(aggregated.length).toBe(2);

    // First 5-minute candle
    const firstAggregated = aggregated[0];
    expect(firstAggregated.open.toNumber()).toBe(100);
    expect(firstAggregated.high.toNumber()).toBe(115);
    expect(firstAggregated.low.toNumber()).toBe(98);
    expect(firstAggregated.close.toNumber()).toBe(113);
    expect(firstAggregated.volume.toNumber()).toBe(10 + 15 + 20 + 25 + 30);
    expect(firstAggregated.interval).toBe(CandleInterval.FIVE_MINUTES);
    expect(firstAggregated.openTime).toBe(baseTime);
    expect(firstAggregated.closeTime).toBe(baseTime + 4 * 60 * 1000 + 60 * 1000 - 1);

    // Second 5-minute candle
    const secondAggregated = aggregated[1];
    expect(secondAggregated.open.toNumber()).toBe(113);
    expect(secondAggregated.high.toNumber()).toBe(118);
    expect(secondAggregated.low.toNumber()).toBe(110);
    expect(secondAggregated.close.toNumber()).toBe(116);
    expect(secondAggregated.volume.toNumber()).toBe(35);
    expect(secondAggregated.interval).toBe(CandleInterval.FIVE_MINUTES);
    expect(secondAggregated.openTime).toBe(baseTime + 5 * 60 * 1000);
    expect(secondAggregated.closeTime).toBe(baseTime + 5 * 60 * 1000 + 60 * 1000 - 1);
  });

  it('should handle an empty array of candles', () => {
    const aggregated = aggregateCandles([], CandleInterval.ONE_HOUR);
    expect(aggregated).toEqual([]);
  });

  it('should aggregate into a 1-hour candle', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime(); // Fixed base time
    const candles: Candle[] = [];
    for (let i = 0; i < 60; i++) {
      candles.push(createMockCandle(baseTime + i * 60 * 1000, { open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 10 + i }));
    }

    const aggregated = aggregateCandles(candles, CandleInterval.ONE_HOUR);
    expect(aggregated.length).toBe(1);

    const firstAggregated = aggregated[0];
    expect(firstAggregated.open.toNumber()).toBe(100);
    expect(firstAggregated.high.toNumber()).toBe(101 + 59);
    expect(firstAggregated.low.toNumber()).toBe(99);
    expect(firstAggregated.close.toNumber()).toBe(100.5 + 59);
    expect(firstAggregated.volume.toNumber()).toBe(Array.from({ length: 60 }, (_, i) => 10 + i).reduce((sum, val) => sum + val, 0));
    expect(firstAggregated.interval).toBe(CandleInterval.ONE_HOUR);
    expect(firstAggregated.openTime).toBe(baseTime);
    expect(firstAggregated.closeTime).toBe(baseTime + 59 * 60 * 1000 + 60 * 1000 - 1);
  });

  it('should use custom reducers when provided', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime(); // Fixed base time
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 105, low: 98, close: 102, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 102, high: 108, low: 100, close: 107, volume: 15 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 107, high: 110, low: 105, close: 109, volume: 20 }),
    ];

    const customReducers = {
      ...defaultCandleReducers,
      open: (values: DecimalAmount[]) => values[values.length - 1], // Custom: last open
      close: (values: DecimalAmount[]) => values[0], // Custom: first close
      volume: (values: DecimalAmount[]) => values.reduce((sum, val) => sum.plus(val), new Decimal(0)).times(2), // Custom: double the volume
    };

    const aggregated = aggregateCandles(candles, CandleInterval.FIVE_MINUTES, customReducers);

    expect(aggregated.length).toBe(1);
    const firstAggregated = aggregated[0];

    expect(firstAggregated.open.toNumber()).toBe(107); // Last open
    expect(firstAggregated.close.toNumber()).toBe(102); // First close
    expect(firstAggregated.volume.toNumber()).toBe((10 + 15 + 20) * 2); // Doubled volume
    expect(firstAggregated.high.toNumber()).toBe(110); // Default high
    expect(firstAggregated.low.toNumber()).toBe(98); // Default low
  });

  it('should handle candles that span across multiple aggregation periods correctly', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime(); // Midnight UTC
    const candles: Candle[] = [
      // First 5-minute block (00:00 - 00:04)
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 101, low: 99, close: 100, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 100, high: 102, low: 98, close: 101, volume: 10 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 101, high: 103, low: 99, close: 102, volume: 10 }),
      createMockCandle(baseTime + 3 * 60 * 1000, { open: 102, high: 104, low: 100, close: 103, volume: 10 }),
      createMockCandle(baseTime + 4 * 60 * 1000, { open: 103, high: 105, low: 101, close: 104, volume: 10 }),

      // Second 5-minute block (00:05 - 00:09)
      createMockCandle(baseTime + 5 * 60 * 1000, { open: 104, high: 106, low: 102, close: 105, volume: 10 }),
      createMockCandle(baseTime + 6 * 60 * 1000, { open: 105, high: 107, low: 103, close: 106, volume: 10 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.FIVE_MINUTES);

    expect(aggregated.length).toBe(2);

    // Verify first aggregated candle (00:00 - 00:04)
    const firstAggregated = aggregated[0];
    expect(firstAggregated.open.toNumber()).toBe(100);
    expect(firstAggregated.high.toNumber()).toBe(105);
    expect(firstAggregated.low.toNumber()).toBe(98); // Corrected expectation
    expect(firstAggregated.close.toNumber()).toBe(104);
    expect(firstAggregated.volume.toNumber()).toBe(50);
    expect(firstAggregated.openTime).toBe(baseTime);
    expect(firstAggregated.closeTime).toBe(baseTime + 4 * 60 * 1000 + 60 * 1000 - 1);

    // Verify second aggregated candle (00:05 - 00:09)
    const secondAggregated = aggregated[1];
    expect(secondAggregated.open.toNumber()).toBe(104);
    expect(secondAggregated.high.toNumber()).toBe(107);
    expect(secondAggregated.low.toNumber()).toBe(102);
    expect(secondAggregated.close.toNumber()).toBe(106);
    expect(secondAggregated.volume.toNumber()).toBe(20);
    expect(secondAggregated.openTime).toBe(baseTime + 5 * 60 * 1000);
    expect(secondAggregated.closeTime).toBe(baseTime + 6 * 60 * 1000 + 60 * 1000 - 1);
  });

  it('should aggregate a single candle into a larger interval correctly', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const singleCandle = createMockCandle(baseTime, { open: 100, high: 105, low: 98, close: 102, volume: 10 });

    const aggregated = aggregateCandles([singleCandle], CandleInterval.ONE_HOUR);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(singleCandle.open.toNumber());
    expect(result.high.toNumber()).toBe(singleCandle.high.toNumber());
    expect(result.low.toNumber()).toBe(singleCandle.low.toNumber());
    expect(result.close.toNumber()).toBe(singleCandle.close.toNumber());
    expect(result.volume.toNumber()).toBe(singleCandle.volume.toNumber());
    expect(result.interval).toBe(CandleInterval.ONE_HOUR);
    expect(result.openTime).toBe(baseTime);
    expect(result.closeTime).toBe(singleCandle.closeTime);
  });

  it('should handle non-contiguous candles within an aggregation period', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 101, low: 99, close: 100, volume: 10 }),
      // Gap for 1 minute
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 100, high: 102, low: 98, close: 101, volume: 10 }),
      // Gap for 1 minute
      createMockCandle(baseTime + 4 * 60 * 1000, { open: 101, high: 103, low: 99, close: 102, volume: 10 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.FIVE_MINUTES);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(100);
    expect(result.high.toNumber()).toBe(103);
    expect(result.low.toNumber()).toBe(98);
    expect(result.close.toNumber()).toBe(102);
    expect(result.volume.toNumber()).toBe(30);
    expect(result.openTime).toBe(baseTime);
    expect(result.closeTime).toBe(baseTime + 4 * 60 * 1000 + 60 * 1000 - 1);
  });

  it('should aggregate candles that perfectly fill the target interval', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 101, low: 99, close: 100, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 100, high: 102, low: 98, close: 101, volume: 10 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 101, high: 103, low: 99, close: 102, volume: 10 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.THREE_MINUTES);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(100);
    expect(result.high.toNumber()).toBe(103);
    expect(result.low.toNumber()).toBe(98);
    expect(result.close.toNumber()).toBe(102);
    expect(result.volume.toNumber()).toBe(30);
    expect(result.interval).toBe(CandleInterval.THREE_MINUTES);
    expect(result.openTime).toBe(baseTime);
    expect(result.closeTime).toBe(baseTime + 2 * 60 * 1000 + 60 * 1000 - 1);
  });

  it('should handle candles with identical open/high/low/close values (flat market)', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 100, low: 100, close: 100, volume: 5 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 100, high: 100, low: 100, close: 100, volume: 5 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 100, high: 100, low: 100, close: 100, volume: 5 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.THREE_MINUTES);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(100);
    expect(result.high.toNumber()).toBe(100);
    expect(result.low.toNumber()).toBe(100);
    expect(result.close.toNumber()).toBe(100);
    expect(result.volume.toNumber()).toBe(15);
  });

  it('should correctly aggregate candles with decreasing values', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 110, high: 112, low: 108, close: 109, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 109, high: 110, low: 105, close: 106, volume: 15 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 106, high: 107, low: 103, close: 104, volume: 20 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.THREE_MINUTES);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(110);
    expect(result.high.toNumber()).toBe(112);
    expect(result.low.toNumber()).toBe(103);
    expect(result.close.toNumber()).toBe(104);
    expect(result.volume.toNumber()).toBe(45);
  });

  it('should correctly aggregate candles with increasing values', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
    const candles: Candle[] = [
      createMockCandle(baseTime + 0 * 60 * 1000, { open: 100, high: 102, low: 98, close: 101, volume: 10 }),
      createMockCandle(baseTime + 1 * 60 * 1000, { open: 101, high: 105, low: 100, close: 104, volume: 15 }),
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 104, high: 108, low: 103, close: 107, volume: 20 }),
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.THREE_MINUTES);

    expect(aggregated.length).toBe(1);
    const result = aggregated[0];

    expect(result.open.toNumber()).toBe(100);
    expect(result.high.toNumber()).toBe(108);
    expect(result.low.toNumber()).toBe(98);
    expect(result.close.toNumber()).toBe(107);
    expect(result.volume.toNumber()).toBe(45);
  });

  it('should handle candles that do not perfectly align with the aggregation period start', () => {
    const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime(); // Fixed base time for alignment
    const candles: Candle[] = [
      createMockCandle(baseTime + 2 * 60 * 1000, { open: 100, high: 101, low: 99, close: 100, volume: 10 }), // 00:02
      createMockCandle(baseTime + 3 * 60 * 1000, { open: 100, high: 102, low: 98, close: 101, volume: 10 }), // 00:03
      createMockCandle(baseTime + 4 * 60 * 1000, { open: 101, high: 103, low: 99, close: 102, volume: 10 }), // 00:04
      createMockCandle(baseTime + 5 * 60 * 1000, { open: 102, high: 104, low: 100, close: 103, volume: 10 }), // 00:05
      createMockCandle(baseTime + 6 * 60 * 1000, { open: 103, high: 105, low: 101, close: 104, volume: 10 }), // 00:06
    ];

    const aggregated = aggregateCandles(candles, CandleInterval.FIVE_MINUTES);

    expect(aggregated.length).toBe(2);

    // The first aggregated candle should start at 00:00 and include candles from 00:02, 00:03, 00:04
    const firstAggregated = aggregated[0];
    expect(firstAggregated.open.toNumber()).toBe(100);
    expect(firstAggregated.high.toNumber()).toBe(103);
    expect(firstAggregated.low.toNumber()).toBe(98);
    expect(firstAggregated.close.toNumber()).toBe(102);
    expect(firstAggregated.volume.toNumber()).toBe(30);
    expect(firstAggregated.openTime).toBe(baseTime); // Corrected expectation
    expect(firstAggregated.closeTime).toBe(baseTime + 4 * 60 * 1000 + 60 * 1000 - 1);

    // The second aggregated candle should start at 00:05 and include candles from 00:05, 00:06
    const secondAggregated = aggregated[1];
    expect(secondAggregated.open.toNumber()).toBe(102);
    expect(secondAggregated.high.toNumber()).toBe(105);
    expect(secondAggregated.low.toNumber()).toBe(100);
    expect(secondAggregated.close.toNumber()).toBe(104);
    expect(secondAggregated.volume.toNumber()).toBe(20);
    expect(secondAggregated.openTime).toBe(baseTime + 5 * 60 * 1000);
    expect(secondAggregated.closeTime).toBe(baseTime + 6 * 60 * 1000 + 60 * 1000 - 1);
  });
});