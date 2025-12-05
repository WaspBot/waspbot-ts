import { Portfolio, Balance, Position } from '../types';
import { Decimal } from 'decimal.js';

export type HistoricalReturns = {
  [symbol: string]: number[];
};
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

/**
 * Calculates the historical Value-at-Risk (VaR) for a given portfolio.
 * VaR represents the maximum expected loss over a given time horizon at a specified confidence level.
 *
 * @param portfolio The current portfolio including positions.
 * @param historicalReturns A map of symbol to an array of its historical fractional returns.
 * @param confidenceLevel The confidence level for VaR (e.g., 0.95 for 95%, 0.99 for 99%).
 * @returns The estimated VaR as a negative Decimal value (potential loss).
 */
export function calculateHistoricalVaR(
  portfolio: Portfolio,
  historicalReturns: HistoricalReturns,
  confidenceLevel: number
): Decimal {
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error("Confidence level must be between 0 and 1 (exclusive).");
  }

  const portfolioReturns: Decimal[] = [];

  // Assuming all historicalReturns arrays have the same length
  const numHistoricalPeriods = Object.values(historicalReturns)[0]?.length || 0;
  if (numHistoricalPeriods === 0) {
    return new Decimal(0); // No historical data, no risk
  }

  const totalOverallPortfolioValue = calculateTotalPortfolioValue(portfolio);
  if (totalOverallPortfolioValue.isZero()) {
    return new Decimal(0); // No value in portfolio, no risk
  }

  let sumOfRiskyPositionValues = new Decimal(0);
  const positionValues = new Map<string, Decimal>();

  for (const position of portfolio.positions.values()) {
    const pv = position.unrealizedPnl.plus(position.entryPrice.times(position.amount));
    positionValues.set(position.symbol, pv);
    sumOfRiskyPositionValues = sumOfRiskyPositionValues.plus(pv);
  }

  if (sumOfRiskyPositionValues.isZero()) {
    return new Decimal(0); // No risky assets, no VaR contribution from positions
  }

  for (let i = 0; i < numHistoricalPeriods; i++) {
    let currentPeriodPortfolioReturn = new Decimal(0);

    for (const position of portfolio.positions.values()) {
      const symbol = position.symbol;
      const returnsForSymbol = historicalReturns[symbol];

      if (returnsForSymbol && returnsForSymbol[i] !== undefined) {
        // Calculate the weight of this position relative to the total risky positions
        const pv = positionValues.get(symbol) || new Decimal(0);
        const weight = pv.dividedBy(sumOfRiskyPositionValues);

        // Add the weighted return of the position to the portfolio return for this period
        currentPeriodPortfolioReturn = currentPeriodPortfolioReturn.plus(
          weight.times(returnsForSymbol[i])
        );
      }
    }
    portfolioReturns.push(currentPeriodPortfolioReturn);
  }

  // Sort portfolio returns in ascending order
  portfolioReturns.sort((a, b) => a.minus(b).toNumber());

  // Calculate the index for the VaR percentile
  const varIndex = Math.floor((1 - confidenceLevel) * portfolioReturns.length);

  const varReturn = portfolioReturns[varIndex];

  if (!varReturn) {
    return new Decimal(0);
  }

  // VaR is expressed as an absolute monetary value, applied to the overall portfolio value
  return varReturn.times(totalOverallPortfolioValue);
}
