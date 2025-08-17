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

// Export order management types (Phase 3 - Issues #5-#9)
export * from './orders-basic';  // Issue #5: Core order types and lifecycle

// TODO: Add remaining order management modules
// export * from './orders-portfolio';    // Issue #6: Portfolio and position management
// export * from './orders-management';   // Issue #7: Order management services
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
