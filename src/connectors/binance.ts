/**
 * Binance connector for WaspBot-TS
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

import { Logger } from '../core/logger';

import { BaseConnector, ConnectorConfig, AccountBalance, TradingFees, OrderRequest } from './base-connector';

import { ExchangeId, TradingPair, OrderId } from '../types/common';

import { Ticker, Trade, TradingPairInfo } from '../market-data/ticker';

import { OrderBook } from '../market-data/order-book';

import { Order } from '../order-management/order';

import { ConnectorStatus } from '../types/common';



const BINANCE_API_BASE_URL = 'https://api.binance.com';



export class BinanceConnector extends BaseConnector {

  private httpClient: AxiosInstance;

  private maxRetries: number;

  private retryDelayMs: number;



  constructor(config: ConnectorConfig) {

    super(config);

    this.httpClient = axios.create({

      baseURL: BINANCE_API_BASE_URL,

      timeout: config.timeout || 5000, // 5 seconds timeout or from config

      headers: {

        'Content-Type': 'application/json',

        // Add API-KEY and signature for authenticated endpoints if needed

      },

    });

    this.maxRetries = (config.exchangeSpecific && config.exchangeSpecific['maxRetries'] as number) || 3;

    this.retryDelayMs = (config.exchangeSpecific && config.exchangeSpecific['retryDelayMs'] as number) || 1000;

  }



  private async makeRequest<T>(method: 'get' | 'post', endpoint: string, data?: any): Promise<T> {

    let attempts = 0;

    while (attempts <= this.maxRetries) {

      try {

        const response = await (method === 'get' ? this.httpClient.get(endpoint, { params: data }) : this.httpClient.post(endpoint, data));

        return response.data as T;

      } catch (error) {

        if (axios.isAxiosError(error)) {

          const axiosError = error as AxiosError;

          const status = axiosError.response?.status;

          const isTransient = !status || (status >= 500 && status < 600) || axiosError.code === 'ECONNABORTED' || axiosError.code === 'ENOTFOUND';



          Logger.error(`BinanceConnector: Request to ${endpoint} failed (Attempt ${attempts + 1}/${this.maxRetries + 1}). Status: ${status}, Code: ${axiosError.code}, Message: ${axiosError.message}`);



          if (isTransient && attempts < this.maxRetries) {

            attempts++;

            const delay = this.retryDelayMs * Math.pow(2, attempts - 1);

            Logger.warn(`BinanceConnector: Retrying request to ${endpoint} in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));

          } else {

            Logger.error(`BinanceConnector: Max retry attempts reached or non-transient error for ${endpoint}.`);

            throw error; // Re-throw non-transient errors or after max retries

          }

        } else {

          Logger.error(`BinanceConnector: An unexpected error occurred for ${endpoint}: ${error}`);

          throw error;

        }

      }

    }

    throw new Error("BinanceConnector: Should not reach here - max retries exceeded.");

  }



  // ============================================================================

  // Connection Management

  // ============================================================================



  public async connect(): Promise<void> {

    Logger.info(`BinanceConnector: Connecting to ${this.exchangeId}`);

    // Implement actual connection logic (e.g., WebSocket connections) here

    this.updateStatus(ConnectorStatus.CONNECTED);

  }



  public async disconnect(): Promise<void> {

    Logger.info(`BinanceConnector: Disconnecting from ${this.exchangeId}`);

    // Implement actual disconnection logic here

    this.updateStatus(ConnectorStatus.DISCONNECTED);

  }



  public async reconnect(): Promise<void> {

    Logger.info(`BinanceConnector: Reconnecting to ${this.exchangeId}`);

    // Implement actual reconnection logic here

    this.updateStatus(ConnectorStatus.RECONNECTING);

  }



  // ============================================================================

  // Market Data

  // ============================================================================



  public async getTradingPairs(): Promise<TradingPairInfo[]> {

    Logger.warn(`BinanceConnector: getTradingPairs not fully implemented.`);

    return [];

  }



  public async getTicker(symbol: TradingPair): Promise<Ticker> {
    try {
      const response = await this.makeRequest<any>('get', '/api/v3/ticker/24hr', { symbol });

      // Validate essential fields
      const requiredFields = [
        'symbol', 'openPrice', 'highPrice', 'lowPrice', 'lastPrice',
        'volume', 'quoteVolume', 'priceChange', 'priceChangePercent',
        'weightedAvgPrice', 'openTime', 'closeTime', 'count',
      ];

      for (const field of requiredFields) {
        if (!(field in response) || response[field] === null || response[field] === undefined) {
          Logger.error(`BinanceConnector: Missing or malformed field '${field}' in ticker data for ${symbol}. Response: ${JSON.stringify(response)}`);
          return {} as Ticker; // Early return malformed data
        }
      }

      // Map Binance API response to Ticker interface
      const ticker: Ticker = {
        exchangeId: this.exchangeId,
        symbol: response.symbol,
        openPrice: response.openPrice,
        highPrice: response.highPrice,
        lowPrice: response.lowPrice,
        lastPrice: response.lastPrice,
        volume: response.volume,
        quoteVolume: response.quoteVolume,
        priceChange: response.priceChange,
        priceChangePercent: response.priceChangePercent,
        weightedAvgPrice: response.weightedAvgPrice,
        prevClosePrice: response.prevClosePrice,
        lastQuantity: response.lastQty,
        bidPrice: response.bidPrice,
        bidQuantity: response.bidQty,
        askPrice: response.askPrice,
        askQuantity: response.askQty,
        openTime: response.openTime,
        closeTime: response.closeTime,
        firstId: response.firstId,
        lastId: response.lastId,
        count: response.count,
        timestamp: Date.now(), // Use current timestamp for when data was received
      };

      return ticker;
    } catch (error) {
      Logger.error(`BinanceConnector: Failed to get ticker for ${symbol}. Error: ${error}`);
      return {} as Ticker; // Return empty Ticker on error
    }
  }



  public async getOrderBook(symbol: TradingPair, limit?: number): Promise<OrderBook> {

    Logger.warn(`BinanceConnector: getOrderBook not fully implemented for ${symbol}.`);

    return {} as OrderBook;

  }



  public async getTrades(symbol: TradingPair, limit?: number): Promise<Trade[]> {

    Logger.warn(`BinanceConnector: getTrades not fully implemented for ${symbol}.`);

    return [];

  }



  public async subscribeToTicker(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: subscribeToTicker not fully implemented for ${symbol}.`);

  }



  public async unsubscribeFromTicker(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: unsubscribeFromTicker not fully implemented for ${symbol}.`);

  }



  public async subscribeToOrderBook(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: subscribeToOrderBook not fully implemented for ${symbol}.`);

  }



  public async unsubscribeFromOrderBook(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: unsubscribeFromOrderBook not fully implemented for ${symbol}.`);

  }



  public async subscribeToTrades(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: subscribeToTrades not fully implemented for ${symbol}.`);

  }



  public async unsubscribeFromTrades(symbol: TradingPair): Promise<void> {

    Logger.warn(`BinanceConnector: unsubscribeFromTrades not fully implemented for ${symbol}.`);

  }



  // ============================================================================

  // Trading Operations

  // ============================================================================



  public async placeOrder(request: OrderRequest): Promise<Order> {

    Logger.warn(`BinanceConnector: placeOrder not fully implemented.`);

    return {} as Order;

  }



  public async cancelOrder(orderId: OrderId, symbol: TradingPair): Promise<Order> {

    Logger.warn(`BinanceConnector: cancelOrder not fully implemented.`);

    return {} as Order;

  }



  public async cancelAllOrders(symbol?: TradingPair): Promise<Order[]> {

    Logger.warn(`BinanceConnector: cancelAllOrders not fully implemented.`);

    return [];

  }



  public async getOrder(orderId: OrderId, symbol: TradingPair): Promise<Order> {

    Logger.warn(`BinanceConnector: getOrder not fully implemented.`);

    return {} as Order;

  }



  public async getOpenOrders(symbol?: TradingPair): Promise<Order[]> {

    Logger.warn(`BinanceConnector: getOpenOrders not fully implemented.`);

    return [];

  }



  public async getOrderHistory(symbol?: TradingPair, limit?: number): Promise<Order[]> {

    Logger.warn(`BinanceConnector: getOrderHistory not fully implemented.`);

    return [];

  }



  // ============================================================================

  // Account Management

  // ============================================================================



  public async getBalances(): Promise<AccountBalance[]> {

    Logger.warn(`BinanceConnector: getBalances not fully implemented.`);

    return [];

  }



  public async getBalance(asset: string): Promise<AccountBalance> {

    Logger.warn(`BinanceConnector: getBalance not fully implemented for ${asset}.`);

    return {} as AccountBalance;

  }



  public async getTradingFees(symbol: TradingPair): Promise<TradingFees> {

    Logger.warn(`BinanceConnector: getTradingFees not fully implemented for ${symbol}.`);

    return {} as TradingFees;

  }



  // Example public endpoint method

  public async getExchangeInfo(): Promise<any> {

    return this.makeRequest('get', '/api/v3/exchangeInfo');

  }



  // Example public endpoint method

  public async getTickerPrice(symbol: string): Promise<any> {

    return this.makeRequest('get', '/api/v3/ticker/price', { symbol });

  }

}
