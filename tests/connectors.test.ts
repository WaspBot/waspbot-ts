/**
 * Unit tests for connectors
 */

import { BinanceConnector } from '../src/connectors/binance';
import { ConnectorConfig } from '../src/connectors/base-connector';
import { Logger } from '../src/core/logger';
import { TokenBucket } from '../src/connectors/binance'; // Import TokenBucket for direct testing

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

  describe('Rate Limiter', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should apply default rate limiting for bursts of requests', async () => {
      // Default: capacity 20, fillRate 20, interval 1000ms (20 requests per second)
      const testConnector = new BinanceConnector(mockConfig);
      const internalMakeRequest = (testConnector as any).makeRequest;
      (testConnector as any).makeRequest = jest.fn(async () => {
        await internalMakeRequest.apply(testConnector);
        return {};
      });

      const numRequests = 25; // More than default capacity
      const requests = [];
      const start = Date.now();

      for (let i = 0; i < numRequests; i++) {
        requests.push(testConnector.getExchangeInfo()); // Using a simple public endpoint
      }

      // Advance timers to allow initial burst and then subsequent delays
      jest.advanceTimersByTime(1000); // Allow 1 second to pass

      await Promise.all(requests);
      const end = Date.now();

      // Expect at least 25 requests to have been attempted
      expect((testConnector as any).makeRequest).toHaveBeenCalledTimes(numRequests);

      // The first 20 requests should be almost immediate, the next 5 should be delayed.
      // With a fill rate of 20 tokens/sec, 5 extra requests will take 5/20 = 0.25 seconds (250ms) extra.
      // So total time should be around 1000ms (for first 20) + 250ms (for next 5) = 1250ms.
      // We'll check if it's greater than the initial burst time.
      expect(end - start).toBeGreaterThanOrEqual(1250);
    });

    it('should apply custom rate limiting', async () => {
      const customConfig: ConnectorConfig = {
        ...mockConfig,
        rateLimiter: {
          capacity: 5,
          fillRate: 5,
          interval: 1000, // 5 requests per second
        },
      };
      const testConnector = new BinanceConnector(customConfig);
      const internalMakeRequest = (testConnector as any).makeRequest;
      (testConnector as any).makeRequest = jest.fn(async () => {
        await internalMakeRequest.apply(testConnector);
        return {};
      });

      const numRequests = 10; // More than custom capacity
      const requests = [];
      const start = Date.now();

      for (let i = 0; i < numRequests; i++) {
        requests.push(testConnector.getExchangeInfo());
      }

      // Advance timers to allow initial burst and then subsequent delays
      jest.advanceTimersByTime(1000); // Allow 1 second to pass

      await Promise.all(requests);
      const end = Date.now();

      expect((testConnector as any).makeRequest).toHaveBeenCalledTimes(numRequests);

      // With a fill rate of 5 tokens/sec, 5 extra requests will take 5/5 = 1 second (1000ms) extra.
      // So total time should be around 1000ms (for first 5) + 1000ms (for next 5) = 2000ms.
      expect(end - start).toBeGreaterThanOrEqual(2000);
    });

    it('should maintain a single outstanding timeout for refills', async () => {
      const rateLimiterConfig = {
        capacity: 1,
        fillRate: 1,
        interval: 1000,
      };
      const bucket = new TokenBucket(rateLimiterConfig);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Acquire a token to trigger a refill schedule
      await bucket.consume(1);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      // Try to acquire another token immediately, should queue and not clear/reschedule
      const promise2 = bucket.consume(1);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Still only one setTimeout call
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      // Advance time to allow the first refill to happen
      jest.advanceTimersByTime(1000);

      // After refill, the queue should trigger another scheduleRefill
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2); // New timeout scheduled
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      await promise2; // Resolve the second request

      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    it('should drain the queue under sustained concurrent requests', async () => {
      const rateLimiterConfig = {
        capacity: 5,
        fillRate: 1,
        interval: 100,
      }; // 1 token per 100ms
      const bucket = new TokenBucket(rateLimiterConfig);

      const numRequests = 15;
      const requestPromises: Promise<void>[] = [];
      let resolvedCount = 0;

      for (let i = 0; i < numRequests; i++) {
        requestPromises.push(bucket.consume(1).then(() => resolvedCount++));
      }

      // Initially, 5 requests should pass immediately
      expect(resolvedCount).toBe(5);

      // Advance time to allow refills and draining
      // 10 remaining requests, 1 token/100ms, so 1000ms needed to drain
      jest.advanceTimersByTime(1000);

      await Promise.all(requestPromises);

      expect(resolvedCount).toBe(numRequests);
    });

    it('should consume correct tokens for different Binance endpoints', async () => {
      const customConfig: ConnectorConfig = {
        ...mockConfig,
        rateLimiter: {
          capacity: 100,
          fillRate: 100,
          interval: 1000,
        },
      };
      const testConnector = new BinanceConnector(customConfig);
      const consumeSpy = jest.spyOn((testConnector as any).rateLimiter, 'consume');

      // Mock makeRequest to resolve immediately without actual HTTP call
      (testConnector as any).makeRequest = jest.fn(async (method: string, endpoint: string, data: any, weight: number) => {
        // Simulate the actual makeRequest logic up to the point of consuming tokens
        // The consumeSpy will capture the weight
        return {};
      });

      await testConnector.getExchangeInfo();
      expect(consumeSpy).toHaveBeenCalledWith(20);

      await testConnector.getTickerPrice('BTCUSDT');
      expect(consumeSpy).toHaveBeenCalledWith(2);

      await testConnector.getTicker('ETHUSDT');
      expect(consumeSpy).toHaveBeenCalledWith(2);

      consumeSpy.mockRestore();
    });

    it('should delay requests when bucket does not have sufficient tokens for a high-weight call', async () => {
      const customConfig: ConnectorConfig = {
        ...mockConfig,
        rateLimiter: {
          capacity: 1,
          fillRate: 1,
          interval: 1000,
        },
      };
      const testConnector = new BinanceConnector(customConfig);
      const consumeSpy = jest.spyOn((testConnector as any).rateLimiter, 'consume');

      // Mock makeRequest to resolve immediately without actual HTTP call
      (testConnector as any).makeRequest = jest.fn(async (method: string, endpoint: string, data: any, weight: number) => {
        return {};
      });

      const startTime = Date.now();

      // First request consumes 1 token, bucket is empty
      await testConnector.getTickerPrice('BTCUSDT'); // weight 2, but capacity is 1, so it should queue
      expect(consumeSpy).toHaveBeenCalledWith(2);

      // Advance time by 1000ms to get 1 token back
      jest.advanceTimersByTime(1000);

      // The request should now resolve
      const endTime = Date.now();

      // Expect the total time to be at least 1000ms due to rate limiting
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);

      consumeSpy.mockRestore();
    });
  });
});