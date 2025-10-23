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
  private reconnectCounter: number = 0;
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

    Logger.info(`WsClient: Attempting to connect to ${this.url} (Attempt ${this.reconnectAttempts + 1}/${this.maxRetries + 1})`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      Logger.info(`WsClient: Connected to ${this.url}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
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
        setTimeout(() => this.connect(), delay);
      } else {
        Logger.error(`WsClient: Max reconnect attempts reached for ${this.url}. Permanent disconnection.`);
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
      this.ws.close();
      this.isConnected = false;
      this.reconnectAttempts = 0; // Reset attempts on explicit close
    }
  }

  public onMessage(listener: (message: string) => void): void {
    this.messageListeners.push(listener);
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getReconnectCounter(): number {
    return this.reconnectCounter;
  }

  public getLastReconnectTimestamp(): Date | null {
    return this.lastReconnectTimestamp;
  }
}
