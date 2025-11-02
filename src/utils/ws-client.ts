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

  constructor(url: string, maxRetries: number = 3, retryDelayMs: number = 1000) {
    this.url = url;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      Logger.info(`WsClient: Already connected or connecting to ${this.url}`);
      return;
    }

    if (this.reconnectAttempts > 0) {
      this.isReconnecting = true;
    }

    Logger.info(`WsClient: Attempting to connect to ${this.url} (Attempt ${this.reconnectAttempts + 1}/${this.maxRetries + 1})`);
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
    };

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      // Logger.debug(`WsClient: Received message from ${this.url}: ${event.data}`);
      this.messageListeners.forEach(listener => listener(event.data.toString()));
    };

    this.ws.onerror = (event: WebSocket.ErrorEvent) => {
      Logger.error(`WsClient: WebSocket error on ${this.url}: ${event.message}`);
    };

    this.ws.onclose = (event: WebSocket.CloseEvent) => {
      this.isConnected = false;
      Logger.warn(`WsClient: Disconnected from ${this.url} (Code: ${event.code}, Reason: ${event.reason})`);
      if (this.reconnectAttempts < this.maxRetries) {
        this.reconnectAttempts++;
        this.reconnectCounter++;
        this.lastReconnectTimestamp = new Date();
        const delay = this.retryDelayMs * Math.pow(2, this.reconnectAttempts - 1);
        Logger.info(`WsClient: Retrying connection to ${this.url} in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxRetries})`);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      } else {
        Logger.error(`WsClient: Max reconnect attempts reached for ${this.url}. Permanent disconnection.`);
        this.isReconnecting = false;
      }
    };
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
