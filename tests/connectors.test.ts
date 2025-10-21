/**
 * Unit tests for connectors
 */

import { BinanceConnector } from '../src/connectors/binance';
import { ConnectorConfig } from '../src/connectors/base-connector';
import { Logger } from '../src/core/logger';

// Mock Logger to prevent console output during tests
jest.mock('../src/core/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BinanceConnector', () => {
  let connector: BinanceConnector;
  let mockMakeRequest: jest.Mock;

  const mockConfig: ConnectorConfig = {
    exchangeId: 'binance',
    apiKey: 'test_api_key',
    apiSecret: 'test_secret_key',
  };

  beforeEach(() => {
    connector = new BinanceConnector(mockConfig);
    // Mock the internal makeRequest method
    mockMakeRequest = jest.fn();
    (connector as any).makeRequest = mockMakeRequest;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTicker', () => {
    const symbol = 'BTCUSDT';

    it('should return a Ticker object for a valid response', async () => {
      const mockApiResponse = {
        symbol: 'BTCUSDT',
        priceChange: '-100.00',
        priceChangePercent: '-0.50',
        weightedAvgPrice: '20000.00',
        prevClosePrice: '20100.00',
        lastPrice: '20000.00',
        lastQty: '0.5',
        bidPrice: '19999.00',
        bidQty: '1.0',
        askPrice: '20001.00',
        askQty: '1.5',
        openPrice: '20100.00',
        highPrice: '20200.00',
        lowPrice: '19900.00',
        volume: '1000.00',
        quoteVolume: '20000000.00',
        openTime: 1678886400000,
        closeTime: 1678972799999,
        firstId: 100,
        lastId: 200,
        count: 100,
      };
      mockMakeRequest.mockResolvedValue(mockApiResponse);

      const ticker = await connector.getTicker(symbol);

      expect(ticker).toBeDefined();
      expect(ticker.symbol).toBe('BTCUSDT');
      expect(ticker.lastPrice).toBe('20000.00');
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if the API response is null', async () => {
      mockMakeRequest.mockResolvedValue(null);

      await expect(connector.getTicker(symbol)).rejects.toThrow(`Invalid ticker response for ${symbol}`);
      expect(Logger.error).toHaveBeenCalledWith(`BinanceConnector: Invalid response structure for ${symbol}. Response: null`);
    });

    it('should throw an error if the API response is not an object', async () => {
      mockMakeRequest.mockResolvedValue('invalid_response');

      await expect(connector.getTicker(symbol)).rejects.toThrow(`Invalid ticker response for ${symbol}`);
      expect(Logger.error).toHaveBeenCalledWith(`BinanceConnector: Invalid response structure for ${symbol}. Response: "invalid_response"`);
    });

    it('should throw an error if a required field is missing', async () => {
      const mockApiResponse = {
        symbol: 'BTCUSDT',
        priceChange: '-100.00',
        // Missing openPrice
        highPrice: '20200.00',
        lowPrice: '19900.00',
        lastPrice: '20000.00',
        volume: '1000.00',
        quoteVolume: '20000000.00',
        priceChangePercent: '-0.50',
        weightedAvgPrice: '20000.00',
        openTime: 1678886400000,
        closeTime: 1678972799999,
        count: 100,
      };
      mockMakeRequest.mockResolvedValue(mockApiResponse);

      await expect(connector.getTicker(symbol)).rejects.toThrow(`Missing required field 'openPrice' in ticker data for ${symbol}`);
      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining(`BinanceConnector: Missing or malformed field 'openPrice' in ticker data for ${symbol}.`));
    });

    it('should re-throw the error from makeRequest', async () => {
      const mockError = new Error('Network error');
      mockMakeRequest.mockRejectedValue(mockError);

      await expect(connector.getTicker(symbol)).rejects.toThrow(mockError);
      expect(Logger.error).toHaveBeenCalledWith(`BinanceConnector: Failed to get ticker for ${symbol}. Error: ${mockError}`);
    });
  });
});
