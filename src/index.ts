/**
 * WaspBot-TS - High-performance algorithmic trading bot framework
 *
 * Main entry point for the WaspBot library.
 * This file exports all public APIs and components.
 *
 * @author WaspBot Team
 * @license Apache-2.0
 */

// Re-export all public APIs
export * from './types';

// Core components
export * from './core/events.js';
export * from './core/clock.js';
export * from './core/logger.js';
export * from './core/state-manager.js';

// Connectors
export * from './connectors/base-connector.js';
export * from './connectors/binance.js';
export * from './connectors/kucoin.js';
export * from './connectors/uniswap.js';

// Strategies
export * from './strategies/base-strategy.js';
export * from './strategies/ping-pong.js';
export * from './strategies/trend-following.js';
export * from './strategies/arbitrage.js';

// Market data
export * from './market-data/ticker.js';
export * from './market-data/candles.js';
export * from './market-data/order-book.js';

// Order management
export * from './order-management/order.js';
export * from './order-management/order-manager.js';
export * from './order-management/position.js';

// Utils
export * from './utils/http-client.js';
export * from './utils/ws-client.js';
export * from './utils/math.js';

// Version information
export const VERSION = '0.1.0';

/**
 * Initialize WaspBot with default configuration
 */
export function initialize(): void {
  // eslint-disable-next-line no-console
  console.log(`🐝 WaspBot-TS v${VERSION} initialized`);
}
