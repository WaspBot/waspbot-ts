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
export * from './core/events';
export * from './core/clock';
export * from './core/logger';
export * from './core/state-manager';

// Connectors
export * from './connectors/base-connector';
export * from './connectors/binance';
export * from './connectors/kucoin';
export * from './connectors/uniswap';

// Strategies
export * from './strategies/base-strategy';
export * from './strategies/ping-pong';
export * from './strategies/trend-following';
export * from './strategies/arbitrage';

// Market data
export * from './market-data/ticker';
export * from './market-data/candles';
export * from './market-data/order-book';

// Order management
export * from './order-management/order';
export * from './order-management/order-manager';
export * from './order-management/position';

// Utils
export * from './utils/http-client';
export * from './utils/ws-client';
export * from './utils/math';

import { Logger } from './core/logger';
import { loadConfig, AppConfig } from './utils/config';

// Version information
export const VERSION = '0.1.0';

/**
 * Initialize WaspBot with default configuration
 */
export function initialize(): AppConfig {
  // eslint-disable-next-line no-console
  console.log(`🐝 WaspBot-TS v${VERSION} initialized`);

  const requiredConfigKeys = [
    'NODE_ENV',
    'API_KEY',
    'API_SECRET',
    // Add other essential configuration keys here
  ];

  const config = loadConfig('config.json', requiredConfigKeys);
  Logger.info('Configuration loaded successfully.');
  // Logger.debug('Loaded config:', config); // Uncomment for debugging

  return config;
}
