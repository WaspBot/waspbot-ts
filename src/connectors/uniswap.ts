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

  /**
   * Executes a token swap on Uniswap.
   * @param tokenIn The address or symbol of the input token.
   * @param tokenOut The address or symbol of the output token.
   * @param amountIn The amount of the input token to swap.
   * @param slippageTolerance The maximum acceptable slippage percentage (e.g., 0.5 for 0.5%). Defaults to 0.5%.
   * @param transactionDeadline The time in minutes until the transaction expires. Defaults to 20 minutes.
   */
  public async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    slippageTolerance: number = 0.5, // 0.5%
    transactionDeadline: number = 20 // 20 minutes
  ): Promise<void> {
    // Input validation
    if (typeof amountIn !== 'number' || !Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error('Invalid amountIn: Must be a positive, finite number.');
    }
    if (typeof slippageTolerance !== 'number' || !Number.isFinite(slippageTolerance) || slippageTolerance < 0 || slippageTolerance > 100) {
      throw new Error('Invalid slippageTolerance: Must be a finite number between 0 and 100 (inclusive).');
    }
    if (typeof transactionDeadline !== 'number' || !Number.isFinite(transactionDeadline) || transactionDeadline <= 0) {
      throw new Error('Invalid transactionDeadline: Must be a positive, finite number.');
    }

    Logger.info(
      `UniswapConnector: Executing swap from ${amountIn} ${tokenIn} to ${tokenOut} with ` +
        `slippage tolerance of ${slippageTolerance}% and a transaction deadline of ${transactionDeadline} minutes.`
    );
    // Placeholder for actual Uniswap swap logic
    // In a real implementation, this would involve interacting with the Uniswap SDK
    // to build and execute the swap transaction.
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
