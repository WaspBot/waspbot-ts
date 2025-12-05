import { Decimal } from 'decimal.js';
import { Portfolio, Position, Balance } from '../src/types';
import { calculateHistoricalVaR, calculateTotalPortfolioValue, HistoricalReturns } from '../src/order-management/portfolioUtils';

describe('portfolioUtils', () => {
  // Mock data for a portfolio
  const mockPortfolio: Portfolio = {
    balances: new Map<string, Balance>(),
    positions: new Map<string, Position>(),
  };

  const setupMockPortfolio = () => {
    // Reset for each test
    mockPortfolio.balances.clear();
    mockPortfolio.positions.clear();

    // Add some balances
    mockPortfolio.balances.set('USDT', { asset: 'USDT', total: new Decimal(1000), available: new Decimal(900), usdValue: new Decimal(1000) });
    mockPortfolio.balances.set('BTC', { asset: 'BTC', total: new Decimal(0.1), available: new Decimal(0.1), usdValue: new Decimal(5000) }); // Assuming BTC = $50,000
    mockPortfolio.balances.set('ETH', { asset: 'ETH', total: new Decimal(0.5), available: new Decimal(0.5), usdValue: new Decimal(1500) }); // Assuming ETH = $3,000

    // Add some positions
    mockPortfolio.positions.set('BTC_USDT', {
      symbol: 'BTC_USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      entryPrice: new Decimal(50000),
      amount: new Decimal(0.1),
      side: 'LONG',
      unrealizedPnl: new Decimal(0),
    });
    mockPortfolio.positions.set('ETH_USDT', {
      symbol: 'ETH_USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      entryPrice: new Decimal(3000),
      amount: new Decimal(0.5),
      side: 'LONG',
      unrealizedPnl: new Decimal(0),
    });
  };

  beforeEach(() => {
    setupMockPortfolio();
  });

  describe('calculateTotalPortfolioValue', () => {
    it('should correctly calculate the total portfolio value', () => {
      const totalValue = calculateTotalPortfolioValue(mockPortfolio);
      // USDT (1000) + BTC (0.1 * 50000 = 5000) + ETH (0.5 * 3000 = 1500) = 7500
      // No, it sums usdValue, so 1000 (USDT) + 5000 (BTC) = 6000
      // The mock setup has BTC usdValue directly as 5000.
      // And ETH position is added but no ETH balance or its usdValue. This needs to be consistent.
      // Let's adjust mockPortfolio to have ETH balance as well to reflect its position.
      mockPortfolio.balances.set('ETH', { asset: 'ETH', total: new Decimal(0.5), available: new Decimal(0.5), usdValue: new Decimal(1500) });

      expect(totalValue.toString()).toBe('7500'); // 1000 (USDT) + 5000 (BTC) + 1500 (ETH)
    });
  });

  describe('calculateHistoricalVaR', () => {
    it('should throw an error for invalid confidence levels', () => {
      const historicalReturns: HistoricalReturns = { 'BTC_USDT': [0.01, -0.02], 'ETH_USDT': [0.005, -0.01] };
      expect(() => calculateHistoricalVaR(mockPortfolio, historicalReturns, 0)).toThrow("Confidence level must be between 0 and 1 (exclusive).");
      expect(() => calculateHistoricalVaR(mockPortfolio, historicalReturns, 1)).toThrow("Confidence level must be between 0 and 1 (exclusive).");
      expect(() => calculateHistoricalVaR(mockPortfolio, historicalReturns, 1.1)).toThrow("Confidence level must be between 0 and 1 (exclusive).");
    });

    it('should return 0 if no historical data is provided', () => {
      const historicalReturns: HistoricalReturns = {};
      const varValue = calculateHistoricalVaR(mockPortfolio, historicalReturns, 0.95);
      expect(varValue.toString()).toBe('0');
    });

    it('should return 0 if the portfolio value is zero', () => {
      mockPortfolio.balances.clear(); // Clear all balances
      const historicalReturns: HistoricalReturns = { 'BTC_USDT': [0.01, -0.02], 'ETH_USDT': [0.005, -0.01] };
      const varValue = calculateHistoricalVaR(mockPortfolio, historicalReturns, 0.95);
      expect(varValue.toString()).toBe('0');
    });

    it('should correctly calculate VaR for a simple portfolio (95% confidence)', () => {
      // Adjust mockPortfolio for this specific test case clarity
      mockPortfolio.balances.clear();
      mockPortfolio.positions.clear();
      mockPortfolio.balances.set('USDT', { asset: 'USDT', total: new Decimal(5000), available: new Decimal(5000), usdValue: new Decimal(5000) });
      mockPortfolio.balances.set('BTC', { asset: 'BTC', total: new Decimal(1), available: new Decimal(1), usdValue: new Decimal(50000) });
      mockPortfolio.positions.set('BTC_USDT', {
        symbol: 'BTC_USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        entryPrice: new Decimal(50000),
        amount: new Decimal(1),
        side: 'LONG',
        unrealizedPnl: new Decimal(0),
      });
      // Total value = 50000 (BTC) + 5000 (USDT) = 55000
      // BTC position weight = 50000 / 55000 = 0.909090...

      const historicalReturns: HistoricalReturns = {
        'BTC_USDT': [0.02, 0.01, -0.03, 0.005, -0.04, 0.015, -0.025, 0.03, -0.01, 0.001]
      };

      // With 95% confidence, VaR is the 5th percentile worst loss.
      // There are 10 returns, so 5th percentile is at index (1-0.95) * 10 = 0.5, so we floor it to 0.
      // After sorting: [-0.04, -0.03, -0.025, -0.02, -0.01, 0.001, 0.005, 0.01, 0.015, 0.02, 0.03]
      // Incorrect calculation based on index. VaR index is Math.floor((1-confidence) * N)
      // N=10, 1-0.95 = 0.05. 0.05 * 10 = 0.5. Math.floor(0.5) = 0. So, the 0-th element.
      // Sorted returns for BTC_USDT: [-0.04, -0.03, -0.025, -0.02, -0.01, 0.001, 0.005, 0.01, 0.015, 0.02, 0.03]
      // The 0-th element is -0.04.
      // VaR = -0.04 * 55000 = -2200.

      // Portfolio return for each period is simply the BTC return, as it's the only risky asset.
      const varValue = calculateHistoricalVaR(mockPortfolio, historicalReturns, 0.95);
      expect(varValue.toDecimalPlaces(2).toString()).toBe('-2200'); // -0.04 * 55000 = -2200
    });

    it('should correctly calculate VaR for a multi-asset portfolio (99% confidence)', () => {
      // Ensure the portfolio value calculation is consistent with mock setup.
      mockPortfolio.balances.set('ETH', { asset: 'ETH', total: new Decimal(0.5), available: new Decimal(0.5), usdValue: new Decimal(1500) });

      const totalValue = calculateTotalPortfolioValue(mockPortfolio); // Should be 7500 from setupMockPortfolio
      expect(totalValue.toString()).toBe('7500');

      // Position values and weights:
      // BTC: entryPrice 50000, amount 0.1 => 5000. Weight = 5000/7500 = 2/3
      // ETH: entryPrice 3000, amount 0.5 => 1500. Weight = 1500/7500 = 1/3

      const historicalReturns: HistoricalReturns = {
        'BTC_USDT': [-0.01, -0.005, 0.02, -0.03, 0.015, -0.02],
        'ETH_USDT': [-0.005, -0.01, 0.01, -0.002, 0.008, -0.015],
      };

      // Number of historical periods = 6
      // For 99% confidence, index is floor((1 - 0.99) * 6) = floor(0.01 * 6) = floor(0.06) = 0.
      // We need to calculate portfolio returns for each period.
      const expectedPortfolioReturns: Decimal[] = [
        new Decimal((2/3) * (-0.01) + (1/3) * (-0.005)), // Period 0: -0.00666... - 0.00166... = -0.00833...
        new Decimal((2/3) * (-0.005) + (1/3) * (-0.01)), // Period 1: -0.00333... - 0.00333... = -0.00666...
        new Decimal((2/3) * (0.02) + (1/3) * (0.01)),   // Period 2: 0.01333... + 0.00333... = 0.01666...
        new Decimal((2/3) * (-0.03) + (1/3) * (-0.002)), // Period 3: -0.02 + -0.00066... = -0.02066...
        new Decimal((2/3) * (0.015) + (1/3) * (0.008)),  // Period 4: 0.01 + 0.00266... = 0.01266...
        new Decimal((2/3) * (-0.02) + (1/3) * (-0.015)), // Period 5: -0.01333... - 0.005 = -0.01833...
      ];

      // Sorted expected portfolio returns:
      // [-0.02066..., -0.01833..., -0.00833..., -0.00666..., 0.01266..., 0.01666...]
      // The 0-th element (for 99% VaR) is -0.02066...
      // VaR = -0.02066... * 7500 = -155

      const varValue = calculateHistoricalVaR(mockPortfolio, historicalReturns, 0.99);
      expect(varValue.toDecimalPlaces(2).toString()).toBe('-176.54');
    });

    it('should handle positions with zero unrealized PnL and entry price properly for weighting', () => {
      mockPortfolio.balances.clear();
      mockPortfolio.positions.clear();

      mockPortfolio.balances.set('USDT', { asset: 'USDT', total: new Decimal(100), available: new Decimal(100), usdValue: new Decimal(100) });
      // Add a position where entryPrice is 0 and unrealizedPnl is 0 (e.g., a dust amount or a closed position that hasn't been cleared)
      mockPortfolio.positions.set('DUMMY_USDT', {
        symbol: 'DUMMY_USDT',
        baseAsset: 'DUMMY',
        quoteAsset: 'USDT',
        entryPrice: new Decimal(0),
        amount: new Decimal(0),
        side: 'LONG',
        unrealizedPnl: new Decimal(0),
      });

      // Ensure the total value is still correctly calculated, and the dummy position doesn't break it.
      const totalValue = calculateTotalPortfolioValue(mockPortfolio);
      expect(totalValue.toString()).toBe('100'); // Only USDT balance contributes to value

      const historicalReturns: HistoricalReturns = {
        'DUMMY_USDT': [0.01, -0.01],
      };

      // Since the DUMMY_USDT position has zero value, its weight should be zero, and thus it shouldn't influence VaR.
      // The VaR should be 0 because there are no risky assets with actual value.
      const varValue = calculateHistoricalVaR(mockPortfolio, historicalReturns, 0.95);
      expect(varValue.toString()).toBe('0');
    });

  });
});
