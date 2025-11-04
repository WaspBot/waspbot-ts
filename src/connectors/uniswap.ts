/**
 * Uniswap connector for WaspBot-TS
 */

import { WsClient } from '../utils/ws-client';
import { Logger } from '../core/logger';

export class UniswapConnector {
  private wsClient: WsClient;
  private logInterval: NodeJS.Timeout | null = null;

  constructor(wsUrl: string) {
    this.wsClient = new WsClient(wsUrl);
    this.wsClient.connect();

    this.startLoggingTelemetry();
  }

  private startLoggingTelemetry(): void {
    this.logInterval = setInterval(() => {
      const reconnects = this.wsClient.getReconnectCounter();
      const lastReconnect = this.wsClient.getLastReconnectTimestamp();
      Logger.info(
        `UniswapConnector Telemetry: Reconnects = ${reconnects}, Last Reconnect = ${lastReconnect ? lastReconnect.toISOString() : 'N/A'}`
      );
    }, 60000); // Log every 60 seconds
  }

  public disconnect(): void {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    this.wsClient.close();
    Logger.info('UniswapConnector: Disconnected.');
  }

  // Placeholder for other Uniswap-specific methods
}
