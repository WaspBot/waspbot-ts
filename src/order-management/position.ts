/**
 * Portfolio and Position Management Types for WaspBot-TS
 *
 * This module provides comprehensive types for portfolio tracking, position management,
 * and account state aggregation. It's designed to work with the core order types
 * from orders-basic.ts to provide complete portfolio management capabilities.
 *
 * Key concepts:
 * - Position: Individual asset/trading pair position tracking
 * - Balance: Account balance information for specific assets
 * - Portfolio: Complete account state with aggregated metrics
 * - Balance Updates: Real-time balance change events
 * - Portfolio Analytics: Performance metrics and risk calculations
 */

import { Price, Quantity, Timestamp, DecimalAmount } from '../types/common';
import { PositionSide, PositionMode, PositionAction } from '../order-management/order';

// ============================================================================
// Position Management Types
// ============================================================================

/**
 * Represents a trading position in a specific asset or trading pair.
 * Tracks both spot holdings and derivative positions with comprehensive metrics.
 */
export interface Position {
  /** Asset symbol or trading pair identifier */
  symbol: string;

  /** Position size (positive for long, negative for short, zero for flat) */
  size: Quantity;

  /** Position side classification */
  side: PositionSide;

  /** Average entry price for the position */
  entryPrice: Price;

  /** Current mark price used for unrealized PnL calculation */
  markPrice: Price;

  /** Unrealized profit and loss */
  unrealizedPnl: DecimalAmount;

  /** Realized profit and loss from closed portions */
  realizedPnl: DecimalAmount;

  /** Percentage return on the position */
  percentage: DecimalAmount;

  /** Leverage multiplier used (1 for spot positions) */
  leverage: number;

  /** Position mode for derivative trading */
  positionMode: PositionMode;

  /** Margin requirement for this position */
  margin: DecimalAmount;

  /** Notional value of the position (size * mark price) */
  notional: DecimalAmount;

  /** Maintenance margin requirement */
  maintenanceMargin: DecimalAmount;

  /** Initial margin requirement */
  initialMargin: DecimalAmount;

  /** Liquidation price (for leveraged positions) */
  liquidationPrice?: Price;

  /** Funding fees accumulated (for perpetual positions) */
  fundingFees: DecimalAmount;

  /** Total fees paid for this position */
  totalFees: DecimalAmount;

  /** Position age in milliseconds */
  age: number;

  /** Last update timestamp */
  lastUpdateTime: Timestamp;

  /** Exchange where this position is held */
  exchangeId: string;

  /** Additional metadata for position tracking */
  metadata: Record<string, unknown>;
}

/**
 * Position summary for quick overview and aggregation.
 */
export interface PositionSummary {
  /** Total number of positions */
  totalPositions: number;

  /** Number of long positions */
  longPositions: number;

  /** Number of short positions */
  shortPositions: number;

  /** Total unrealized PnL across all positions */
  totalUnrealizedPnl: DecimalAmount;

  /** Total realized PnL across all positions */
  totalRealizedPnl: DecimalAmount;

  /** Total notional value of all positions */
  totalNotional: DecimalAmount;

  /** Total margin used across all positions */
  totalMargin: DecimalAmount;

  /** Largest position by notional value */
  largestPosition?: Position;

  /** Most profitable position */
  mostProfitablePosition?: Position;

  /** Least profitable position */
  leastProfitablePosition?: Position;
}

// ============================================================================
// Balance Management Types
// ============================================================================

/**
 * Account balance information for a specific asset.
 * Tracks total, available, and locked amounts with detailed breakdown.
 */
export interface Balance {
  /** Asset symbol (e.g., 'BTC', 'ETH', 'USDT') */
  asset: string;

  /** Total balance (available + locked) */
  total: Quantity;

  /** Available balance (not locked in orders or positions) */
  available: Quantity;

  /** Locked balance (in open orders) */
  locked: Quantity;

  /** Balance reserved for positions (margin) */
  reserved: Quantity;

  /** Borrowed amount (for margin trading) */
  borrowed: Quantity;

  /** Interest owed on borrowed amount */
  interest: DecimalAmount;

  /** USD equivalent value (for aggregation) */
  usdValue: DecimalAmount;

  /** Current asset price in USD */
  usdPrice: Price;

  /** Last update timestamp */
  lastUpdateTime: Timestamp;

  /** Exchange where this balance is held */
  exchangeId: string;

  /** Account type (spot, margin, futures, etc.) */
  accountType: AccountType;
}

/**
 * Account type classification for balance segregation.
 */
export enum AccountType {
  /** Spot trading account */
  SPOT = 'SPOT',

  /** Margin trading account */
  MARGIN = 'MARGIN',

  /** Futures trading account */
  FUTURES = 'FUTURES',

  /** Options trading account */
  OPTIONS = 'OPTIONS',

  /** Lending/borrowing account */
  LENDING = 'LENDING',

  /** Staking account */
  STAKING = 'STAKING',

  /** Cross-margin account */
  CROSS_MARGIN = 'CROSS_MARGIN',

  /** Isolated margin account */
  ISOLATED_MARGIN = 'ISOLATED_MARGIN',
}

/**
 * Balance update event representing a change in account balance.
 * Used for real-time balance tracking and audit trails.
 */
export interface BalanceUpdate {
  /** Asset being updated */
  asset: string;

  /** Exchange identifier */
  exchangeId: string;

  /** Account type */
  accountType: AccountType;

  /** Previous balance state */
  previousBalance: Balance;

  /** New balance state */
  newBalance: Balance;

  /** Change in total balance */
  deltaTotal: Quantity;

  /** Change in available balance */
  deltaAvailable: Quantity;

  /** Change in locked balance */
  deltaLocked: Quantity;

  /** Update timestamp */
  updateTimestamp: Timestamp;

  /** Trigger that caused the balance update */
  trigger: BalanceUpdateTrigger;

  /** Reference to related order or transaction */
  reference?: string;

  /** Additional context about the update */
  context: Record<string, unknown>;
}

/**
 * Types of events that can trigger balance updates.
 */
export enum BalanceUpdateTrigger {
  /** Order execution (fill) */
  ORDER_FILL = 'ORDER_FILL',

  /** Order placement (locking funds) */
  ORDER_PLACED = 'ORDER_PLACED',

  /** Order cancellation (unlocking funds) */
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  /** Deposit to account */
  DEPOSIT = 'DEPOSIT',

  /** Withdrawal from account */
  WITHDRAWAL = 'WITHDRAWAL',

  /** Transfer between accounts */
  TRANSFER = 'TRANSFER',

  /** Funding fee payment */
  FUNDING_FEE = 'FUNDING_FEE',

  /** Interest payment */
  INTEREST = 'INTEREST',

  /** Liquidation */
  LIQUIDATION = 'LIQUIDATION',

  /** Manual adjustment */
  ADJUSTMENT = 'ADJUSTMENT',

  /** System correction */
  CORRECTION = 'CORRECTION',
}

// ============================================================================
// Portfolio Management Types
// ============================================================================

/**
 * Complete portfolio state with aggregated positions and balances.
 * Provides a comprehensive view of the entire trading account.
 */
export interface Portfolio {
  /** Portfolio identifier */
  id: string;

  /** All account balances by asset */
  balances: Map<string, Balance>;

  /** All active positions by symbol */
  positions: Map<string, Position>;

  /** Total portfolio value in base currency (USD) */
  totalValue: DecimalAmount;

  /** Total equity (total value - borrowed amounts) */
  totalEquity: DecimalAmount;

  /** Total unrealized PnL across all positions */
  totalUnrealizedPnl: DecimalAmount;

  /** Total realized PnL for the session/period */
  totalRealizedPnl: DecimalAmount;

  /** Portfolio performance percentage from inception */
  totalReturnPercentage: DecimalAmount;

  /** Daily performance percentage */
  dailyReturnPercentage: DecimalAmount;

  /** Total margin used across all positions */
  totalMarginUsed: DecimalAmount;

  /** Available margin for new positions */
  availableMargin: DecimalAmount;

  /** Margin utilization percentage */
  marginUtilization: DecimalAmount;

  /** Current leverage ratio */
  leverageRatio: DecimalAmount;

  /** Portfolio risk score (0-100) */
  riskScore: number;

  /** Maximum drawdown from peak value */
  maxDrawdown: DecimalAmount;

  /** Current drawdown from peak */
  currentDrawdown: DecimalAmount;

  /** Sharpe ratio (risk-adjusted return) */
  sharpeRatio: DecimalAmount;

  /** Total fees paid across all positions */
  totalFeesPaid: DecimalAmount;

  /** Last update timestamp */
  lastUpdateTime: Timestamp;

  /** Exchanges included in this portfolio */
  exchanges: string[];

  /** Base currency for value calculations */
  baseCurrency: string;
}

/**
 * Portfolio performance metrics for analysis and reporting.
 */
export interface PortfolioPerformance {
  /** Time period for this performance calculation */
  period: PerformancePeriod;

  /** Start date of the period */
  startDate: Timestamp;

  /** End date of the period */
  endDate: Timestamp;

  /** Starting portfolio value */
  startingValue: DecimalAmount;

  /** Ending portfolio value */
  endingValue: DecimalAmount;

  /** Total return amount */
  totalReturn: DecimalAmount;

  /** Total return percentage */
  totalReturnPercentage: DecimalAmount;

  /** Annualized return percentage */
  annualizedReturn: DecimalAmount;

  /** Maximum portfolio value during period */
  maxValue: DecimalAmount;

  /** Minimum portfolio value during period */
  minValue: DecimalAmount;

  /** Maximum drawdown during period */
  maxDrawdown: DecimalAmount;

  /** Number of winning periods */
  winningPeriods: number;

  /** Number of losing periods */
  losingPeriods: number;

  /** Win rate percentage */
  winRate: DecimalAmount;

  /** Average winning amount */
  avgWin: DecimalAmount;

  /** Average losing amount */
  avgLoss: DecimalAmount;

  /** Profit factor (gross profit / gross loss) */
  profitFactor: DecimalAmount;

  /** Sharpe ratio for the period */
  sharpeRatio: DecimalAmount;

  /** Sortino ratio (downside deviation) */
  sortinoRatio: DecimalAmount;

  /** Calmar ratio (annual return / max drawdown) */
  calmarRatio: DecimalAmount;

  /** Standard deviation of returns */
  volatility: DecimalAmount;

  /** Beta relative to market benchmark */
  beta: DecimalAmount;

  /** Alpha (excess return over benchmark) */
  alpha: DecimalAmount;

  /** Total number of trades executed */
  totalTrades: number;

  /** Total fees paid during period */
  totalFees: DecimalAmount;

  /** Fee percentage of total return */
  feeImpact: DecimalAmount;
}

/**
 * Time periods for performance analysis.
 */
export enum PerformancePeriod {
  /** Intraday performance */
  INTRADAY = 'INTRADAY',

  /** Daily performance */
  DAILY = 'DAILY',

  /** Weekly performance */
  WEEKLY = 'WEEKLY',

  /** Monthly performance */
  MONTHLY = 'MONTHLY',

  /** Quarterly performance */
  QUARTERLY = 'QUARTERLY',

  /** Yearly performance */
  YEARLY = 'YEARLY',

  /** Since inception */
  INCEPTION = 'INCEPTION',

  /** Custom date range */
  CUSTOM = 'CUSTOM',
}

// ============================================================================
// Portfolio Analytics and Risk Management
// ============================================================================

/**
 * Risk metrics for portfolio assessment and management.
 */
export interface PortfolioRisk {
  /** Overall risk score (0-100, higher = riskier) */
  overallRiskScore: number;

  /** Concentration risk by asset */
  concentrationRisk: Map<string, DecimalAmount>;

  /** Concentration risk by exchange */
  exchangeConcentrationRisk: Map<string, DecimalAmount>;

  /** Leverage risk assessment */
  leverageRisk: number;

  /** Liquidity risk by position */
  liquidityRisk: Map<string, number>;

  /** Currency exposure risk */
  currencyExposure: Map<string, DecimalAmount>;

  /** Correlation risk between positions */
  correlationRisk: DecimalAmount;

  /** Value at Risk (VaR) calculations */
  valueAtRisk: VaRCalculation;

  /** Expected Shortfall (Conditional VaR) */
  expectedShortfall: DecimalAmount;

  /** Maximum theoretical loss */
  maxTheoreticalLoss: DecimalAmount;

  /** Time to liquidation estimate */
  timeToLiquidation?: number;

  /** Risk limits and violations */
  riskLimits: RiskLimits;

  /** Last risk assessment timestamp */
  lastAssessment: Timestamp;
}

/**
 * Value at Risk calculation with different confidence levels.
 */
export interface VaRCalculation {
  /** 1-day VaR at 95% confidence */
  var95_1d: DecimalAmount;

  /** 1-day VaR at 99% confidence */
  var99_1d: DecimalAmount;

  /** 7-day VaR at 95% confidence */
  var95_7d: DecimalAmount;

  /** 7-day VaR at 99% confidence */
  var99_7d: DecimalAmount;

  /** Method used for VaR calculation */
  method: VaRMethod;

  /** Historical period used for calculation */
  historicalPeriod: number;

  /** Calculation timestamp */
  calculatedAt: Timestamp;
}

/**
 * Methods for calculating Value at Risk.
 */
export enum VaRMethod {
  /** Historical simulation */
  HISTORICAL = 'HISTORICAL',

  /** Parametric (normal distribution) */
  PARAMETRIC = 'PARAMETRIC',

  /** Monte Carlo simulation */
  MONTE_CARLO = 'MONTE_CARLO',
}

/**
 * Risk limits and current violations.
 */
export interface RiskLimits {
  /** Maximum portfolio value */
  maxPortfolioValue?: DecimalAmount;

  /** Maximum single position size */
  maxPositionSize?: DecimalAmount;

  /** Maximum concentration per asset */
  maxAssetConcentration?: DecimalAmount;

  /** Maximum leverage ratio */
  maxLeverage?: DecimalAmount;

  /** Maximum daily loss */
  maxDailyLoss?: DecimalAmount;

  /** Maximum drawdown */
  maxDrawdown?: DecimalAmount;

  /** Current limit violations */
  violations: RiskViolation[];

  /** Risk limit update timestamp */
  lastUpdated: Timestamp;
}

/**
 * Risk limit violation information.
 */
export interface RiskViolation {
  /** Type of limit violated */
  limitType: RiskLimitType;

  /** Current value */
  currentValue: DecimalAmount;

  /** Limit value */
  limitValue: DecimalAmount;

  /** Severity of violation */
  severity: ViolationSeverity;

  /** When the violation occurred */
  violationTime: Timestamp;

  /** Description of the violation */
  description: string;

  /** Recommended actions */
  recommendedActions: string[];
}

/**
 * Types of risk limits that can be violated.
 */
export enum RiskLimitType {
  PORTFOLIO_VALUE = 'PORTFOLIO_VALUE',
  POSITION_SIZE = 'POSITION_SIZE',
  ASSET_CONCENTRATION = 'ASSET_CONCENTRATION',
  LEVERAGE = 'LEVERAGE',
  DAILY_LOSS = 'DAILY_LOSS',
  DRAWDOWN = 'DRAWDOWN',
  VAR_LIMIT = 'VAR_LIMIT',
}

/**
 * Severity levels for risk violations.
 */
export enum ViolationSeverity {
  /** Minor violation, monitor */
  LOW = 'LOW',

  /** Moderate violation, take action */
  MEDIUM = 'MEDIUM',

  /** Serious violation, immediate action required */
  HIGH = 'HIGH',

  /** Critical violation, emergency stop */
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// Portfolio Aggregation and Reporting
// ============================================================================

/**
 * Portfolio snapshot for historical tracking and comparison.
 */
export interface PortfolioSnapshot {
  /** Snapshot identifier */
  id: string;

  /** Snapshot timestamp */
  timestamp: Timestamp;

  /** Complete portfolio state at this time */
  portfolio: Portfolio;

  /** Performance metrics for this snapshot */
  performance: PortfolioPerformance;

  /** Risk assessment at this time */
  risk: PortfolioRisk;

  /** Snapshot type/trigger */
  snapshotType: SnapshotType;

  /** Description or notes */
  description?: string;
}

/**
 * Types of portfolio snapshots.
 */
export enum SnapshotType {
  /** Scheduled periodic snapshot */
  SCHEDULED = 'SCHEDULED',

  /** Manual snapshot */
  MANUAL = 'MANUAL',

  /** Event-triggered snapshot */
  EVENT_TRIGGERED = 'EVENT_TRIGGERED',

  /** End-of-day snapshot */
  END_OF_DAY = 'END_OF_DAY',

  /** End-of-month snapshot */
  END_OF_MONTH = 'END_OF_MONTH',

  /** Risk violation snapshot */
  RISK_VIOLATION = 'RISK_VIOLATION',
}

/**
 * Portfolio comparison between two time points.
 */
export interface PortfolioComparison {
  /** Start portfolio snapshot */
  startSnapshot: PortfolioSnapshot;

  /** End portfolio snapshot */
  endSnapshot: PortfolioSnapshot;

  /** Value change */
  valueChange: DecimalAmount;

  /** Percentage change */
  percentageChange: DecimalAmount;

  /** Position changes */
  positionChanges: Map<string, PositionChange>;

  /** Balance changes */
  balanceChanges: Map<string, BalanceChange>;

  /** New positions added */
  newPositions: Position[];

  /** Positions closed */
  closedPositions: Position[];

  /** Performance comparison */
  performanceComparison: PerformanceComparison;

  /** Risk change analysis */
  riskComparison: RiskComparison;
}

/**
 * Change in a specific position between snapshots.
 */
export interface PositionChange {
  /** Position symbol */
  symbol: string;

  /** Previous position state */
  previous?: Position;

  /** Current position state */
  current?: Position;

  /** Change in size */
  sizeChange: Quantity;

  /** Change in unrealized PnL */
  pnlChange: DecimalAmount;

  /** Change in margin */
  marginChange: DecimalAmount;

  /** Change type */
  changeType: PositionChangeType;
}

/**
 * Types of position changes.
 */
export enum PositionChangeType {
  /** Position opened */
  OPENED = 'OPENED',

  /** Position closed */
  CLOSED = 'CLOSED',

  /** Position size increased */
  INCREASED = 'INCREASED',

  /** Position size decreased */
  DECREASED = 'DECREASED',

  /** Position unchanged */
  UNCHANGED = 'UNCHANGED',
}

/**
 * Change in account balance between snapshots.
 */
export interface BalanceChange {
  /** Asset symbol */
  asset: string;

  /** Previous balance */
  previous: Balance;

  /** Current balance */
  current: Balance;

  /** Change in total balance */
  totalChange: Quantity;

  /** Change in available balance */
  availableChange: Quantity;

  /** Change in locked balance */
  lockedChange: Quantity;
}

/**
 * Performance comparison between time periods.
 */
export interface PerformanceComparison {
  /** Previous period performance */
  previous: PortfolioPerformance;

  /** Current period performance */
  current: PortfolioPerformance;

  /** Change in return percentage */
  returnChange: DecimalAmount;

  /** Change in Sharpe ratio */
  sharpeChange: DecimalAmount;

  /** Change in maximum drawdown */
  drawdownChange: DecimalAmount;

  /** Change in win rate */
  winRateChange: DecimalAmount;
}

/**
 * Risk comparison between time periods.
 */
export interface RiskComparison {
  /** Previous risk assessment */
  previous: PortfolioRisk;

  /** Current risk assessment */
  current: PortfolioRisk;

  /** Change in overall risk score */
  riskScoreChange: number;

  /** Change in VaR */
  varChange: DecimalAmount;

  /** New risk violations */
  newViolations: RiskViolation[];

  /** Resolved risk violations */
  resolvedViolations: RiskViolation[];
}

// ============================================================================
// Export Types for Convenient Importing
// ============================================================================

export default {
  // Position types
  PositionSide,
  PositionMode,
  PositionAction,

  // Account types
  AccountType,
  BalanceUpdateTrigger,

  // Performance types
  PerformancePeriod,
  VaRMethod,
  RiskLimitType,
  ViolationSeverity,

  // Snapshot types
  SnapshotType,
  PositionChangeType,
};
