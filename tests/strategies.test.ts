import { ArbitrageStrategy, ArbitrageConfig, ArbitrageType } from '../src/strategies/arbitrage.js';
import { BaseConnector } from '../src/connectors/base-connector.js';
import { ExchangeId, TradingPair, StrategyError } from '../src/types/common.js';
import { Logger } from '../src/core/logger.js';
import Decimal from 'decimal.js';

// Mock Logger to prevent console output during tests
jest.mock('../src/core/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

class MockConnector extends BaseConnector {
  constructor(id: ExchangeId) {
    super(id);
  }

  async connect(): Promise<void> { /* no-op */ }
  async disconnect(): Promise<void> { /* no-op */ }
  async placeOrder(): Promise<any> { return {}; }
  async cancelOrder(): Promise<any> { return {}; }
  async cancelAllOrders(): Promise<void> { /* no-op */ }
  async getOrderBook(): Promise<any> { return {}; }
  async getTicker(): Promise<any> { return {}; }
  async getAccountBalances(): Promise<any> { return {}; }
  async subscribeToTicker(): Promise<void> { /* no-op */ }
  async unsubscribeFromTicker(): Promise<void> { /* no-op */ }
}

describe('ArbitrageStrategy', () => {
  let mockConnectors: Map<ExchangeId, BaseConnector>;
  let defaultConfig: ArbitrageConfig;

  beforeEach(() => {
    mockConnectors = new Map<ExchangeId, BaseConnector>();
    mockConnectors.set(ExchangeId.BINANCE, new MockConnector(ExchangeId.BINANCE));
    mockConnectors.set(ExchangeId.KUCOIN, new MockConnector(ExchangeId.KUCOIN));

    defaultConfig = {
      strategyId: 'test-arbitrage',
      tradingPairs: [TradingPair.BTC_USDT],
      exchanges: [ExchangeId.BINANCE, ExchangeId.KUCOIN],
      minProfitThreshold: new Decimal(0.001),
      maxPositionSize: new Decimal(10),
      maxCapitalPerCycle: new Decimal(1000),
      includeFees: true,
      fees: new Map([
        [ExchangeId.BINANCE, { maker: new Decimal(0.001), taker: new Decimal(0.001) }],
        [ExchangeId.KUCOIN, { maker: new Decimal(0.001), taker: new Decimal(0.001) }],
      ]),
      slippageTolerance: new Decimal(0.0005),
      maxExecutionLatency: 500,
      opportunityCooldown: 1000,
      arbitrageType: ArbitrageType.CROSS_EXCHANGE,
      riskManagement: {
        maxDailyLoss: new Decimal(500),
        maxOpenPositions: 2,
        stopLossPercent: new Decimal(0.01),
      },
    };
  });

  it('should initialize with valid configuration', () => {
    const strategy = new ArbitrageStrategy(defaultConfig, mockConnectors);
    expect(strategy).toBeDefined();
    expect(strategy.getStatus()).toBe('STOPPED');
  });

  it('should throw StrategyError if minProfitThreshold is not positive', () => {
    const config = { ...defaultConfig, minProfitThreshold: new Decimal(0) };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Minimum profit threshold must be positive');
  });

  it('should throw StrategyError if tradingPairs is empty', () => {
    const config = { ...defaultConfig, tradingPairs: [] };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('At least one trading pair must be specified');
  });

  it('should throw StrategyError if cross-exchange arbitrage has less than 2 exchanges', () => {
    const config = { ...defaultConfig, exchanges: [ExchangeId.BINANCE], arbitrageType: ArbitrageType.CROSS_EXCHANGE };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Cross-exchange arbitrage requires at least 2 exchanges');
  });

  it('should throw StrategyError if a connector is not found for an exchange', () => {
    const config = { ...defaultConfig, exchanges: [ExchangeId.BINANCE, 'UNKNOWN_EXCHANGE' as ExchangeId] };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Connector not found for exchange: UNKNOWN_EXCHANGE');
  });

  it('should throw StrategyError if maxPositionSize is not positive', () => {
    const config = { ...defaultConfig, maxPositionSize: new Decimal(0) };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Maximum position size must be positive');
  });

  it('should throw StrategyError if maxCapitalPerCycle is not positive', () => {
    const config = { ...defaultConfig, maxCapitalPerCycle: new Decimal(0) };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Maximum capital per cycle must be positive');
  });

  it('should throw StrategyError if slippageTolerance is out of range', () => {
    let config = { ...defaultConfig, slippageTolerance: new Decimal(-0.01) };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Slippage tolerance must be between 0 and 1 (exclusive)');

    config = { ...defaultConfig, slippageTolerance: new Decimal(1) };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Slippage tolerance must be between 0 and 1 (exclusive)');
  });

  it('should throw StrategyError if maxExecutionLatency is not positive', () => {
    const config = { ...defaultConfig, maxExecutionLatency: 0 };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Maximum execution latency must be positive');
  });

  it('should throw StrategyError if opportunityCooldown is negative', () => {
    const config = { ...defaultConfig, opportunityCooldown: -100 };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Opportunity cooldown cannot be negative');
  });

  it('should throw StrategyError if includeFees is true but fees map is empty', () => {
    const config = { ...defaultConfig, includeFees: true, fees: new Map() };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Fees must be configured if includeFees is true');
  });

  it('should throw StrategyError if maxDailyLoss is not positive', () => {
    const config = { ...defaultConfig, riskManagement: { ...defaultConfig.riskManagement, maxDailyLoss: new Decimal(0) } };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Maximum daily loss must be positive');
  });

  it('should throw StrategyError if maxOpenPositions is not positive', () => {
    const config = { ...defaultConfig, riskManagement: { ...defaultConfig.riskManagement, maxOpenPositions: 0 } };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Maximum open positions must be positive');
  });

  it('should throw StrategyError if stopLossPercent is out of range', () => {
    let config = { ...defaultConfig, riskManagement: { ...defaultConfig.riskManagement, stopLossPercent: new Decimal(-0.01) } };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Stop loss percent must be between 0 and 1 (exclusive)');

    config = { ...defaultConfig, riskManagement: { ...defaultConfig.riskManagement, stopLossPercent: new Decimal(1) } };
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow(StrategyError);
    expect(() => new ArbitrageStrategy(config, mockConnectors)).toThrow('Stop loss percent must be between 0 and 1 (exclusive)');
  });
});