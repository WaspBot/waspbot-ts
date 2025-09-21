/**
 * Core type definitions for WaspBot-TS
 *
 * This file exports all the fundamental types and interfaces
 * used throughout the trading bot framework.
 */

// Export common types and utilities
export * from './common.js';

// Export market data types
export * from '../market-data/ticker.js';
export * from '../market-data/candles.js';
export * from '../market-data/order-book.js';

// Export order management types
export * from '../order-management/order.js';
export * from '../order-management/position.js';
export * from '../order-management/order-manager.js';

// TODO: Add remaining order management modules
// export * from './orders-validation';   // Issue #8: Risk management and validation
// export * from './orders';              // Issue #9: Final consolidated module

// TODO: Add additional type modules as they are implemented

// Version information
export const WASPBOT_VERSION = '0.1.0';
export const API_VERSION = 'v1';

// Re-export Decimal class for runtime
export { Decimal } from 'decimal.js';

// Re-export Decimal type for typing convenience
export type { Decimal as DecimalType } from 'decimal.js';
