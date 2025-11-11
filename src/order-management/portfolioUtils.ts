import { Portfolio, Balance } from '../types';
import { Decimal } from 'decimal.js';

/**
 * Calculate the total portfolio value in the base currency (e.g., USD).
 * Assumes each Balance.usdValue is up-to-date.
 */
export function calculateTotalPortfolioValue(portfolio: Portfolio): Decimal {
  let total = new Decimal(0);
  for (const balance of portfolio.balances.values()) {
    total = total.plus(balance.usdValue);
  }
  return total;
}
