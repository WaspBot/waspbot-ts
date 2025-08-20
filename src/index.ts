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

// Version information
export const VERSION = '0.1.0';

/**
 * Initialize WaspBot with default configuration
 */
export function initialize(): void {
  // eslint-disable-next-line no-console
  console.log(`🐝 WaspBot-TS v${VERSION} initialized`);
}
