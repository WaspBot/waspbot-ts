/**
 * Candlestick data types for WaspBot-TS
 */

import {
  Timestamp,
  ExchangeId,
  TradingPair,
  DecimalAmount,
} from '../types/common.js';

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