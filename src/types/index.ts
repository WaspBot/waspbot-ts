/**
 * Core type definitions for WaspBot-TS
 *
 * This file exports all the fundamental types and interfaces
 * used throughout the trading bot framework.
 */

// Export common types and utilities
export * from './common';

// TODO: Add additional type modules as they are implemented
// Future type modules to be added:
// export * from './market';     // Market data types (Issue #4)
// export * from './orders';     // Order management types (Issue #5)
// export * from './connector';  // Exchange connector interfaces (Issue #6)
// export * from './strategy';   // Trading strategy interfaces (Issue #7)
// export * from './events';     // Event system types (Issue #8)
// export * from './config';     // Configuration types (Issue #9)

// Version information
export const WASPBOT_VERSION = '0.1.0';
export const API_VERSION = 'v1';

// Type utility exports for convenience
export type { Decimal } from 'decimal.js';
