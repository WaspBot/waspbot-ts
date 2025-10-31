/**
 * Binance connector for WaspBot-TS
 */

import { HttpClient, HttpError, HttpClientConfig } from '../utils/http-client';

import { Logger } from '../core/logger';

import { BaseConnector, ConnectorConfig, AccountBalance, TradingFees, OrderRequest } from './base-connector';

import { ExchangeId, TradingPair, OrderId } from '../types/common';

import { Ticker, Trade, TradingPairInfo } from '../market-data/ticker';

import { OrderBook } from '../market-data/order-book';

import { Order } from '../order-management/order';

import { ConnectorStatus } from '../types/common';



const BINANCE_API_BASE_URL = 'https://api.binance.com';



export class BinanceConnector extends BaseConnector {

  private httpClient: HttpClient;



  constructor(config: ConnectorConfig) {

    super(config);

    const httpClientConfig: HttpClientConfig = {

      baseURL: BINANCE_API_BASE_URL,

      timeout: config.timeout || 5000, // 5 seconds timeout or from config

      headers: {

        'Content-Type': 'application/json',

        // Add API-KEY and signature for authenticated endpoints if needed

      },

      retries: (config.exchangeSpecific && config.exchangeSpecific['maxRetries'] as number) || 3,

      retryDelay: (retryCount: number) => {

        const delay = ((config.exchangeSpecific && config.exchangeSpecific['retryDelayMs'] as number) || 1000) * Math.pow(2, retryCount - 1);

        Logger.warn(`BinanceConnector: Retrying request in ${delay}ms...`);

        return delay;

      },

    };

    this.httpClient = new HttpClient(httpClientConfig);

  }



  private async makeRequest<T>(method: 'get' | 'post', endpoint: string, data?: any): Promise<T> {

    try {

      const response = await (method === 'get' ? this.httpClient.get<T>(endpoint, { params: data }) : this.httpClient.post<T>(endpoint, data));

      return response;

    } catch (error) {

      if (error instanceof HttpError) {

        Logger.error(`BinanceConnector: Request to ${error.url} failed. Status: ${error.status}, Method: ${error.method}, Is Network Error: ${error.isNetworkError}, Message: ${error.message}`);

        throw error;

      } else {

        Logger.error(`BinanceConnector: An unexpected error occurred for ${endpoint}: ${error}`);

        throw error;

      }

    }

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

      if (!response || typeof response !== 'object') {
        Logger.error(`BinanceConnector: Invalid response structure for ${symbol}. Response: ${JSON.stringify(response)}`);
        throw new Error(`Invalid ticker response for ${symbol}`);
      }

      // Validate essential fields
      const requiredFields = [
        'symbol', 'openPrice', 'highPrice', 'lowPrice', 'lastPrice',
        'volume', 'quoteVolume', 'priceChange', 'priceChangePercent',
        'weightedAvgPrice', 'openTime', 'closeTime', 'count',
      ];

      for (const field of requiredFields) {
        if (!(field in response) || response[field] === null || response[field] === undefined) {
          Logger.error(`BinanceConnector: Missing or malformed field '${field}' in ticker data for ${symbol}. Response: ${JSON.stringify(response)}`);
          throw new Error(`Missing required field '${field}' in ticker data for ${symbol}`);
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
      if (error instanceof HttpError) {
        Logger.error(`BinanceConnector: Failed to get ticker for ${symbol}. Status: ${error.status}, Message: ${error.message}`);
      } else {
        Logger.error(`BinanceConnector: Failed to get ticker for ${symbol}. Error: ${error}`);
      }
      throw error; // Re-throw the error
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
