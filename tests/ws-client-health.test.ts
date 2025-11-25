import { WsClient } from '../src/utils/ws-client';
import { Logger } from '../src/core/logger';
import WebSocket from 'ws';

// Mock WebSocket and Logger
jest.mock(\'ws\', () => {\n  const mockWebSocket = jest.fn().mockImplementation((url) => {\n    const mockWs = {\n      url,\n      onopen: jest.fn(),\n      onmessage: jest.fn(),\      onerror: jest.fn(),\n      onclose: jest.fn(),\n      send: jest.fn(),\n      close: jest.fn(),\n      ping: jest.fn(),\n      on: jest.fn(), // Mock the \'on\' method for event listeners like \'pong\'\n      readyState: mockWebSocket.CONNECTING, // Default state\n    };\n    // Simulate the \'pong\' event being emitted when ping() is called\n    mockWs.ping.mockImplementation(() => {\n      if (mockWs.on.mock.calls.some(call => call[0] === \'pong\')) {\n        // Find the pong listener and call it after a short delay to simulate network\n        setTimeout(() => {\n          const pongListener = mockWs.on.mock.calls.find(call => call[0] === \'pong\')[1];\n          pongListener();\n        }, 50);\n      }\n    });\n    return mockWs;\n  });\n  mockWebSocket.CONNECTING = 0;\n  mockWebSocket.OPEN = 1;\n  return mockWebSocket;\n});

jest.mock('../src/core/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('WsClient Health Monitoring', () => {
  const TEST_URL = 'ws://localhost:8080';
  const PING_INTERVAL_MS = 1000;
  const PING_TIMEOUT_MS = 500;

  let wsClient: WsClient;
  let mockWebSocketInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    wsClient = new WsClient(TEST_URL, 3, 100, PING_INTERVAL_MS, PING_TIMEOUT_MS);
    jest.useFakeTimers();

    wsClient.connect();
    mockWebSocketInstance = (WebSocket as jest.Mock).mock.results[0].value;
    mockWebSocketInstance.readyState = WebSocket.OPEN; // Manually set state for tests
    mockWebSocketInstance.onopen();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should send pings at the specified interval', () => {
    expect(mockWebSocketInstance.ping).not.toHaveBeenCalled();
    jest.advanceTimersByTime(PING_INTERVAL_MS);
    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(PING_INTERVAL_MS);
    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(2);
  });

  it('should calculate and update latency on pong response', () => {
    const healthCallback = jest.fn();
    wsClient.setHealthCallback(healthCallback);

    expect(wsClient.getLatency()).toBeNull();

    jest.advanceTimersByTime(PING_INTERVAL_MS); // Send ping
    // Pong is simulated to be received after 50ms in the mock
    jest.advanceTimersByTime(50); // Advance time for pong to be received

    expect(wsClient.getLatency()).toBeGreaterThanOrEqual(50);
    expect(wsClient.getLatency()).toBeLessThan(PING_TIMEOUT_MS);
    expect(healthCallback).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should set latency to null and call health callback on pong timeout', () => {
    const healthCallback = jest.fn();
    wsClient.setHealthCallback(healthCallback);

    jest.advanceTimersByTime(PING_INTERVAL_MS); // Send ping
    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(PING_TIMEOUT_MS); // Advance past pong timeout

    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Pong timeout'));
    expect(wsClient.getLatency()).toBeNull();
    expect(healthCallback).toHaveBeenCalledWith(null);
  });

  it('should stop pinging when the connection is closed', () => {
    jest.advanceTimersByTime(PING_INTERVAL_MS); // Send first ping
    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1);

    wsClient.close();
    jest.advanceTimersByTime(PING_INTERVAL_MS * 2); // Advance time past several ping intervals

    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1); // No more pings should be sent
  });

  it('should stop pinging when the connection is unexpectedly disconnected', () => {
    jest.advanceTimersByTime(PING_INTERVAL_MS); // Send first ping
    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1);

    mockWebSocketInstance.onclose({ code: 1006, reason: 'abnormal' });
    jest.advanceTimersByTime(PING_INTERVAL_MS * 2); // Advance time past several ping intervals

    expect(mockWebSocketInstance.ping).toHaveBeenCalledTimes(1); // No more pings should be sent
  });

  it('should allow setting a health callback', () => {
    const healthCallback = jest.fn();
    wsClient.setHealthCallback(healthCallback);
    expect(healthCallback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(PING_INTERVAL_MS); // Send ping
    jest.advanceTimersByTime(50); // Simulate pong received

    expect(healthCallback).toHaveBeenCalledTimes(1);
    expect(healthCallback).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should return null latency if no pong received yet', () => {
    expect(wsClient.getLatency()).toBeNull();
    jest.advanceTimersByTime(PING_INTERVAL_MS / 2); // Halfway through ping interval
    expect(wsClient.getLatency()).toBeNull();
  });
});
