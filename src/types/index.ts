/**
 * Core type definitions for WaspBot-TS
 *
 * This file exports all the fundamental types and interfaces
 * used throughout the trading bot framework.
 */

// Export common types and utilities
export * from './common';

// Export market data types (Phase 2 - Issue #4)
export * from './market';

// TODO: Add additional type modules as they are implemented
// Future type modules to be added:
// export * from './orders';     // Order management types (Issue #5)
// export * from './connector';  // Exchange connector interfaces (Issue #6)
// export * from './strategy';   // Trading strategy interfaces (Issue #7)
// export * from './events';     // Event system types (Issue #8)
// export * from './config';     // Configuration types (Issue #9)

// Version information
export const WASPBOT_VERSION = '0.1.0';
export const API_VERSION = 'v1';

// Re-export Decimal for convenience (DecimalAmount is already defined in common.ts)
export { Decimal } from 'decimal.js';
