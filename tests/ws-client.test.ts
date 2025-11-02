import { WsClient } from '../src/utils/ws-client';
import { Logger } from '../src/core/logger';
import WebSocket from 'ws';

// Mock WebSocket and Logger
jest.mock('ws', () => {
  return jest.fn().mockImplementation((url) => {
    return {
      url,
      onopen: jest.fn(),
      onmessage: jest.fn(),
      onerror: jest.fn(),
      onclose: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.CONNECTING, // Default state
    };
  });
});

jest.mock('../src/core/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('WsClient', () => {
  const TEST_URL = 'ws://localhost:8080';
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100; // Shorter delay for tests

  let wsClient: WsClient;
  let mockWebSocketInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    wsClient = new WsClient(TEST_URL, MAX_RETRIES, RETRY_DELAY_MS);
    mockWebSocketInstance = (WebSocket as jest.Mock).mock.results[0].value;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should connect to the WebSocket server', () => {
    wsClient.connect();
    expect(WebSocket).toHaveBeenCalledWith(TEST_URL);
    expect(mockWebSocketInstance.onopen).toBeDefined();
    expect(mockWebSocketInstance.onmessage).toBeDefined();
    expect(mockWebSocketInstance.onerror).toBeDefined();
    expect(mockWebSocketInstance.onclose).toBeDefined();
  });

  it('should set isConnected to true on successful connection', () => {
    wsClient.connect();
    mockWebSocketInstance.onopen();
    expect(wsClient.getIsConnected()).toBe(true);
    expect(wsClient.getIsReconnecting()).toBe(false);
  });

  it('should send messages when connected', () => {
    wsClient.connect();
    mockWebSocketInstance.onopen();
    wsClient.send('test message');
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith('test message');
  });

  it('should not send messages when not connected', () => {
    wsClient.send('test message');
    expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(`WsClient: Cannot send message, not connected to ${TEST_URL}`);
  });

  it('should close the connection', () => {
    wsClient.connect();
    mockWebSocketInstance.onopen();
    wsClient.close();
    expect(mockWebSocketInstance.close).toHaveBeenCalled();
    expect(wsClient.getIsConnected()).toBe(false);
    expect(wsClient.getIsReconnecting()).toBe(false);
  });

  it('should handle incoming messages', () => {
    const listener = jest.fn();
    wsClient.onMessage(listener);
    wsClient.connect();
    mockWebSocketInstance.onopen();

    const messageEvent = { data: 'hello' } as WebSocket.MessageEvent;
    mockWebSocketInstance.onmessage(messageEvent);

    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('should attempt to reconnect with exponential backoff on close', () => {
    wsClient.connect();
    mockWebSocketInstance.onclose({ code: 1006, reason: 'abnormal' });

    // First reconnect attempt
    expect(wsClient.getIsReconnecting()).toBe(true);
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining(`Retrying connection to ${TEST_URL} in ${RETRY_DELAY_MS}ms... (Attempt 1/${MAX_RETRIES})`));
    jest.advanceTimersByTime(RETRY_DELAY_MS);
    expect(WebSocket).toHaveBeenCalledTimes(2); // Original + 1 reconnect

    // Second reconnect attempt
    (WebSocket as jest.Mock).mock.results[1].value.onclose({ code: 1006, reason: 'abnormal' });
    const delay2 = RETRY_DELAY_MS * Math.pow(2, 1); // 1st reconnect attempt is index 1
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining(`Retrying connection to ${TEST_URL} in ${delay2}ms... (Attempt 2/${MAX_RETRIES})`));
    jest.advanceTimersByTime(delay2);
    expect(WebSocket).toHaveBeenCalledTimes(3);

    // Third reconnect attempt
    (WebSocket as jest.Mock).mock.results[2].value.onclose({ code: 1006, reason: 'abnormal' });
    const delay3 = RETRY_DELAY_MS * Math.pow(2, 2); // 2nd reconnect attempt is index 2
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining(`Retrying connection to ${TEST_URL} in ${delay3}ms... (Attempt 3/${MAX_RETRIES})`));
    jest.advanceTimersByTime(delay3);
    expect(WebSocket).toHaveBeenCalledTimes(4);
  });

  it('should stop reconnecting after max retries', () => {
    wsClient.connect();
    mockWebSocketInstance.onclose({ code: 1006, reason: 'abnormal' }); // Attempt 1
    jest.advanceTimersByTime(RETRY_DELAY_MS);
    (WebSocket as jest.Mock).mock.results[1].value.onclose({ code: 1006, reason: 'abnormal' }); // Attempt 2
    jest.advanceTimersByTime(RETRY_DELAY_MS * 2);
    (WebSocket as jest.Mock).mock.results[2].value.onclose({ code: 1006, reason: 'abnormal' }); // Attempt 3
    jest.advanceTimersByTime(RETRY_DELAY_MS * 4);
    (WebSocket as jest.Mock).mock.results[3].value.onclose({ code: 1006, reason: 'abnormal' }); // Attempt 4 (max retries reached)

    expect(Logger.error).toHaveBeenCalledWith(`WsClient: Max reconnect attempts reached for ${TEST_URL}. Permanent disconnection.`);
    expect(wsClient.getIsReconnecting()).toBe(false);
    expect(WebSocket).toHaveBeenCalledTimes(4); // Original + 3 retries
  });

  it('should expose the reconnecting state', () => {
    expect(wsClient.getIsReconnecting()).toBe(false);
    wsClient.connect();
    expect(wsClient.getIsReconnecting()).toBe(false); // Not reconnecting yet, just connecting

    mockWebSocketInstance.onclose({ code: 1006, reason: 'abnormal' });
    expect(wsClient.getIsReconnecting()).toBe(true); // Now reconnecting
    jest.advanceTimersByTime(RETRY_DELAY_MS);

    (WebSocket as jest.Mock).mock.results[1].value.onopen();
    expect(wsClient.getIsReconnecting()).toBe(false); // Reconnected
  });

  it('should not add duplicate message listeners', () => {
    const listener = jest.fn();
    wsClient.onMessage(listener);
    wsClient.onMessage(listener); // Try to add the same listener again

    wsClient.connect();
    mockWebSocketInstance.onopen();

    const messageEvent = { data: 'hello' } as WebSocket.MessageEvent;
    mockWebSocketInstance.onmessage(messageEvent);

    expect(listener).toHaveBeenCalledTimes(1); // Should only be called once
  });

  it('should remove message listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    wsClient.onMessage(listener1);
    wsClient.onMessage(listener2);
    wsClient.removeMessageListener(listener1);

    wsClient.connect();
    mockWebSocketInstance.onopen();

    const messageEvent = { data: 'hello' } as WebSocket.MessageEvent;
    mockWebSocketInstance.onmessage(messageEvent);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith('hello');
  });

  it('should reset reconnect attempts on explicit close', () => {
    wsClient.connect();
    mockWebSocketInstance.onclose({ code: 1006, reason: 'abnormal' }); // Start reconnecting
    jest.advanceTimersByTime(RETRY_DELAY_MS); // First retry
    expect(wsClient.getIsReconnecting()).toBe(true);

    wsClient.close(); // Explicit close
    expect(wsClient.getIsReconnecting()).toBe(false);
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining(`Closing connection to ${TEST_URL}`));

    // Advance past the pending reconnection timer and verify no reconnection happens
    const initialCallCount = (WebSocket as jest.Mock).mock.calls.length;
    jest.advanceTimersByTime(RETRY_DELAY_MS * 10); // Advance well past any pending timer
    expect(WebSocket).toHaveBeenCalledTimes(initialCallCount); // No new connection attempts

    // Try connecting again, should not be in a reconnecting state
    wsClient.connect();
    expect(wsClient.getIsReconnecting()).toBe(false);
    mockWebSocketInstance.onopen();
    expect(wsClient.getIsConnected()).toBe(true);
  });
});
