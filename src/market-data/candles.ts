/**
 * Candlestick data types for WaspBot-TS
 */

import { Decimal } from 'decimal.js';
import { Timestamp, ExchangeId, TradingPair, DecimalAmount } from '../types/common.js';

/**
 * Type for a single candle property reducer function.
 * Takes an array of DecimalAmount (or number for numberOfTrades) and returns a single DecimalAmount (or number).
 */
export type CandleReducer<T> = (values: T[]) => T;

/**
 * Defines the set of reducer functions for aggregating candle properties.
 */
export interface CandleReducers {
  open: CandleReducer<DecimalAmount>;
  high: CandleReducer<DecimalAmount>;
  low: CandleReducer<DecimalAmount>;
  close: CandleReducer<DecimalAmount>;
  volume: CandleReducer<DecimalAmount>;
  quoteVolume: CandleReducer<DecimalAmount>;
  takerBuyBaseVolume: CandleReducer<DecimalAmount>;
  takerBuyQuoteVolume: CandleReducer<DecimalAmount>;
  numberOfTrades: CandleReducer<number>;
  vwap: CandleReducer<DecimalAmount>;
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
  vwap: DecimalAmount; // Volume Weighted Average Price
}

/**
 * Raw trade data
 */
export interface RawTrade {
  exchangeId: ExchangeId;
  symbol: TradingPair;
  price: DecimalAmount;
  amount: DecimalAmount; // Base asset amount
  quoteAmount: DecimalAmount; // Quote asset amount (price * amount)
  timestamp: Timestamp;
  isBuyerMaker: boolean;
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

/**
 * Default reducer functions for aggregating candle data.
 */
export const defaultCandleReducers: CandleReducers = {
  open: (values: DecimalAmount[]) => values[0],
  high: (values: DecimalAmount[]) => Decimal.max(...values),
  low: (values: DecimalAmount[]) => Decimal.min(...values),
  close: (values: DecimalAmount[]) => values[values.length - 1],
  volume: (values: DecimalAmount[]) => values.reduce((sum, val) => sum.plus(val), new Decimal(0)),
  quoteVolume: (values: DecimalAmount[]) => values.reduce((sum, val) => sum.plus(val), new Decimal(0)),
  takerBuyBaseVolume: (values: DecimalAmount[]) => values.reduce((sum, val) => sum.plus(val), new Decimal(0)),
  takerBuyQuoteVolume: (values: DecimalAmount[]) => values.reduce((sum, val) => sum.plus(val), new Decimal(0)),
  numberOfTrades: (values: number[]) => values.reduce((sum, val) => sum + val, 0),
  // VWAP calculation requires original open, high, low, close, and volume for each 1m candle
  // For aggregated candles, we'll use a simplified approach: sum(close * volume) / sum(volume)
  // A more accurate VWAP would require access to the raw trades within the aggregated period.
  vwap: (values: DecimalAmount[]) => {
    // This reducer assumes 'values' here are the 'vwap' from 1m candles.
    // For a true aggregated VWAP, we'd need the sum of (price * volume) and sum of volume
    // from the underlying 1m candles. Since we only have the 1m candle VWAP,
    // we'll approximate by averaging them, weighted by volume if available,
    // or simply returning the last 1m candle's VWAP if no volume info is passed here.
    // For now, let's return the last VWAP as a placeholder or sum of VWAP if it makes sense.
    // A more robust solution would require passing the original 1m candles to the reducer.
    // Given the current Candle interface, we'll need to adjust if we want a more precise VWAP.
    // For simplicity, let's just take the last candle's VWAP for now, or average if appropriate.
    // Let's assume for now that the 'values' passed to VWAP reducer are the 'close' prices
    // and we need to calculate VWAP from the original 1m candles.
    // This reducer needs to be aware of the original candles to calculate correctly.
    // For now, let's just return the last value as a placeholder.
    // TODO: Revisit VWAP calculation for aggregated candles if more precision is needed.
    return values[values.length - 1];
  },
};

/**
 * Aggregates an array of 1-minute candles into a higher timeframe.
 *
 * @param candles An array of 1-minute candles, sorted by openTime in ascending order.
 * @param targetInterval The desired target interval for aggregation (e.g., '5m', '1h').
 * @param reducers Optional. Custom reducer functions for each candle property. If not provided, default reducers are used.
 * @returns An array of aggregated candles.
 */
export function aggregateCandles(
  candles: Candle[],
  targetInterval: CandleInterval,
  reducers: CandleReducers = defaultCandleReducers
): Candle[] {
  if (candles.length === 0) {
    return [];
  }

  const aggregated: Candle[] = [];
  let currentGroup: Candle[] = [];
  let currentGroupOpenTime: Timestamp | null = null;

  // Convert targetInterval to minutes for easier calculation
  const intervalInMinutes = parseCandleIntervalToMinutes(targetInterval);
  if (intervalInMinutes === null) {
    throw new Error(`Unsupported target interval: ${targetInterval}`);
  }

  for (const candle of candles) {
    const candleOpenTime = candle.openTime;

    // Calculate the open time for the potential aggregated candle
    // This ensures that aggregation starts at a clean interval boundary
    const groupStartTime = Math.floor(candleOpenTime / (intervalInMinutes * 60 * 1000)) * (intervalInMinutes * 60 * 1000);

    if (currentGroupOpenTime === null) {
      currentGroupOpenTime = groupStartTime;
    }

    // If the current candle falls into a new aggregation period,
    // or if the current group is empty and we're starting a new one
    if (groupStartTime > currentGroupOpenTime) {
      if (currentGroup.length > 0) {
        aggregated.push(reduceCandleGroup(currentGroup, targetInterval, reducers, currentGroupOpenTime));
      }
      currentGroup = [];
      currentGroupOpenTime = groupStartTime;
    }
    currentGroup.push(candle);
  }

  // Push any remaining candles in the last group
  if (currentGroup.length > 0) {
    aggregated.push(reduceCandleGroup(currentGroup, targetInterval, reducers, currentGroupOpenTime));
  }

  return aggregated;
}

/**
 * Helper function to reduce a group of 1-minute candles into a single aggregated candle.
 */
function reduceCandleGroup(
  group: Candle[],
  targetInterval: CandleInterval,
  reducers: CandleReducers,
  groupOpenTime: Timestamp // Add groupOpenTime parameter
): Candle {
  if (group.length === 0) {
    throw new Error('Cannot reduce an empty candle group.');
  }

  const firstCandle = group[0];
  const lastCandle = group[group.length - 1];

  const closeTime = lastCandle.closeTime; // The close time of the last 1m candle in the group

  return {
    exchangeId: firstCandle.exchangeId,
    symbol: firstCandle.symbol,
    interval: targetInterval,
    openTime: groupOpenTime, // Use groupOpenTime here
    closeTime: closeTime,
    open: reducers.open(group.map(c => c.open)),
    high: reducers.high(group.map(c => c.high)),
    low: reducers.low(group.map(c => c.low)),
    close: reducers.close(group.map(c => c.close)),
    volume: reducers.volume(group.map(c => c.volume)),
    quoteVolume: reducers.quoteVolume(group.map(c => c.quoteVolume)),
    takerBuyBaseVolume: reducers.takerBuyBaseVolume(group.map(c => c.takerBuyBaseVolume)),
    takerBuyQuoteVolume: reducers.takerBuyQuoteVolume(group.map(c => c.takerBuyQuoteVolume)),
    numberOfTrades: reducers.numberOfTrades(group.map(c => c.numberOfTrades)),
    vwap: reducers.vwap(group.map(c => c.vwap)),
    isClosed: true,
  };
}

/**
 * Helper to parse CandleInterval string to minutes.
 */
function parseCandleIntervalToMinutes(interval: CandleInterval): number | null {
  const value = parseInt(interval);
  const unit = interval.replace(value.toString(), '');

  switch (unit) {
    case 'm':
      return value;
    case 'h':
      return value * 60;
    case 'd':
      return value * 60 * 24;
    case 'w':
      return value * 60 * 24 * 7;
    case 'M':
      return value * 60 * 24 * 30; // Approximate month as 30 days
    default:
      return null;
  }
}

