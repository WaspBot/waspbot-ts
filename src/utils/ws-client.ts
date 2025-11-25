/**
 * WebSocket client utility for WaspBot-TS
 */

import * as WebSocket from 'ws';
import { Logger } from '../core/logger';

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectCounter: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReconnectTimestamp: Date | null = null;
  private messageListeners: ((message: string) => void)[] = [];

  private pingIntervalMs: number;
  private pingTimeoutMs: number;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPingTimestamp: number | null = null;
  private latency: number | null = null;
  private healthCallback: ((latency: number) => void) | null = null;

  constructor(
    url: string,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
    pingIntervalMs: number = 30000, // Default to 30 seconds
    pingTimeoutMs: number = 5000 // Default to 5 seconds
  ) {
    this.url = url;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.pingIntervalMs = pingIntervalMs;
    this.pingTimeoutMs = pingTimeoutMs;
  }

  public connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      Logger.info(`WsClient: Already connected or connecting to ${this.url}`);
      return;
    }

    if (this.reconnectAttempts > 0) {
      this.isReconnecting = true;
    }

    Logger.info(
      `WsClient: Attempting to connect to ${this.url} (Attempt ${this.reconnectAttempts + 1}/${this.maxRetries + 1})`
    );
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      Logger.info(`WsClient: Connected to ${this.url}`);
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.startPing();
    };

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      // Logger.debug(`WsClient: Received message from ${this.url}: ${event.data}`);
      this.messageListeners.forEach(listener => listener(event.data.toString()));
    };

    this.ws.on('pong', () => {
      if (this.lastPingTimestamp) {
        this.latency = Date.now() - this.lastPingTimestamp;
        Logger.debug(`WsClient: Received pong from ${this.url}. Latency: ${this.latency}ms`);
        if (this.healthCallback) {
          this.healthCallback(this.latency);
        }
      }
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });

    this.ws.onerror = (event: WebSocket.ErrorEvent) => {
      Logger.error(`WsClient: WebSocket error on ${this.url}: ${event.message}`);
    };

    this.ws.onclose = (event: WebSocket.CloseEvent) => {
      this.isConnected = false;
      Logger.warn(
        `WsClient: Disconnected from ${this.url} (Code: ${event.code}, Reason: ${event.reason})`
      );
      if (this.reconnectAttempts < this.maxRetries) {
        this.reconnectAttempts++;
        this.reconnectCounter++;
        this.lastReconnectTimestamp = new Date();
        const delay = this.retryDelayMs * Math.pow(2, this.reconnectAttempts - 1);
        Logger.info(
          `WsClient: Retrying connection to ${this.url} in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxRetries})`
        );
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      } else {
        Logger.error(
          `WsClient: Max reconnect attempts reached for ${this.url}. Permanent disconnection.`
        );
        this.isReconnecting = false;
      }
      this.stopPing();
    };
  }

  private startPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private sendPing(): void {
    if (this.ws && this.isConnected) {
      this.lastPingTimestamp = Date.now();
      this.ws.ping();
      Logger.debug(`WsClient: Sent ping to ${this.url}`);

      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
      }
      this.pongTimer = setTimeout(() => {
        Logger.warn(`WsClient: Pong timeout for ${this.url}. Latency unknown.`);
        this.latency = null;
        if (this.healthCallback) {
          this.healthCallback(this.latency);
        }
      }, this.pingTimeoutMs);
    }
  }

  public send(message: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(message);
    } else {
      Logger.warn(`WsClient: Cannot send message, not connected to ${this.url}`);
    }
  }

  public close(): void {
    if (this.ws) {
      Logger.info(`WsClient: Closing connection to ${this.url}`);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.ws.close();
      this.isConnected = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0; // Reset attempts on explicit close
      this.stopPing();
      // Remove event listeners to prevent memory leaks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = null; // Nullify the WebSocket instance
    }
  }

  public onMessage(listener: (message: string) => void): void {
    if (!this.messageListeners.includes(listener)) {
      this.messageListeners.push(listener);
    }
  }

  public removeMessageListener(listener: (message: string) => void): void {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  public setHealthCallback(callback: (latency: number) => void): void {
    this.healthCallback = callback;
  }

  public getLatency(): number | null {
    return this.latency;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsReconnecting(): boolean {
    return this.isReconnecting;
  }

  public getReconnectCounter(): number {
    return this.reconnectCounter;
  }

  public getLastReconnectTimestamp(): Date | null {
    return this.lastReconnectTimestamp;
  }
}
