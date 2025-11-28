import { OrderBookManager, OrderBook, OrderBookDiff } from '../src/market-data/order-book';
import { Decimal } from 'decimal.js';

describe('OrderBookManager Rolling Imbalance and JSON Snapshot', () => {
  const mockResubscribeCallback = jest.fn();
  const initialSnapshot: OrderBook = {
    exchangeId: 'BINANCE',
    symbol: 'BTC/USDT',
    bids: [
      { price: new Decimal('10000'), quantity: new Decimal('1') },
      { price: new Decimal('9999'), quantity: new Decimal('2') },
    ],
    asks: [
      { price: new Decimal('10001'), quantity: new Decimal('1.5') },
      { price: new Decimal('10002'), quantity: new Decimal('2.5') },
    ],
    lastUpdateId: 100,
    timestamp: Date.now(),
  };

  let orderBookManager: OrderBookManager;

  beforeEach(() => {
    orderBookManager = new OrderBookManager(initialSnapshot, mockResubscribeCallback, 3); // Window size of 3
    mockResubscribeCallback.mockClear();
  });

  it('should calculate initial bid/ask imbalance correctly', () => {
    // (bid_volume - ask_volume) / (bid_volume + ask_volume)
    // Bids: 1 + 2 = 3
    // Asks: 1.5 + 2.5 = 4
    // Imbalance: (3 - 4) / (3 + 4) = -1 / 7 = -0.142857...
    const expectedImbalance = new Decimal('-0.14285714285714285714');
    const currentImbalance = orderBookManager['calculateBidAskImbalance']();
    expect(currentImbalance.toFixed(20)).toEqual(expectedImbalance.toFixed(20));
  });

  it('should maintain rolling imbalance history', () => {
    // Initial imbalance is already calculated in constructor
    expect(orderBookManager['imbalanceHistory'].length).toBe(1);

    // Apply a diff that changes imbalance
    const diff1: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 101,
      bids: [{ price: new Decimal('10000'), quantity: new Decimal('0.5') }], // Bid volume becomes 0.5 + 2 = 2.5
      asks: [{ price: new Decimal('10001'), quantity: new Decimal('2') }], // Ask volume becomes 2 + 2.5 = 4.5
      timestamp: Date.now() + 1000,
    };
    orderBookManager.applyDiff(diff1);
    // Bids: 0.5 + 2 = 2.5
    // Asks: 2 + 2.5 = 4.5
    // Imbalance: (2.5 - 4.5) / (2.5 + 4.5) = -2 / 7 = -0.285714...
    expect(orderBookManager['imbalanceHistory'].length).toBe(2);
    expect(orderBookManager['imbalanceHistory'][1].imbalance.toFixed(20)).toEqual(new Decimal('-0.28571428571428571429').toFixed(20));

    // Apply another diff
    const diff2: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 102,
      finalUpdateId: 102,
      bids: [{ price: new Decimal('9998'), quantity: new Decimal('3') }], // New bid
      asks: [],
      timestamp: Date.now() + 2000,
    };
    orderBookManager.applyDiff(diff2);
    // Bids: 0.5 (from 10000) + 2 (from 9999) + 3 (from 9998) = 5.5
    // Asks: 2 (from 10001) + 2.5 (from 10002) = 4.5
    // Imbalance: (5.5 - 4.5) / (5.5 + 4.5) = 1 / 10 = 0.1
    expect(orderBookManager['imbalanceHistory'].length).toBe(3);
    expect(orderBookManager['imbalanceHistory'][2].imbalance.toFixed(20)).toEqual(new Decimal('0.1').toFixed(20));

    // Apply a third diff, which should cause the oldest entry to be removed (window size 3)
    const diff3: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 103,
      finalUpdateId: 103,
      bids: [],
      asks: [{ price: new Decimal('10003'), quantity: new Decimal('1') }], // New ask
      timestamp: Date.now() + 3000,
    };
    orderBookManager.applyDiff(diff3);
    // Bids: 7.5
    // Asks: 7 + 1 = 8
    // Imbalance: (7.5 - 8) / (7.5 + 8) = -0.5 / 15.5 = -0.032258...
    expect(orderBookManager['imbalanceHistory'].length).toBe(3); // Still 3, oldest removed
    expect(orderBookManager['imbalanceHistory'][0].imbalance.toFixed(20)).toEqual(new Decimal('-0.28571428571428571429').toFixed(20)); // Oldest (from diff1)
    expect(orderBookManager['imbalanceHistory'][2].imbalance.toFixed(20)).toEqual(new Decimal('0').toFixed(20)); // Newest (from diff3)
  });

  it('should calculate rolling bid/ask imbalance average correctly', () => {
    // Add some diffs to populate history
    const diff1: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 101,
      bids: [{ price: new Decimal('10000'), quantity: new Decimal('0.5') }],
      asks: [{ price: new Decimal('10001'), quantity: new Decimal('2') }],
      timestamp: Date.now() + 1000,
    };
    orderBookManager.applyDiff(diff1);

    const diff2: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 102,
      finalUpdateId: 102,
      bids: [{ price: new Decimal('9998'), quantity: new Decimal('3') }],
      asks: [],
      timestamp: Date.now() + 2000,
    };
    orderBookManager.applyDiff(diff2);

    // Imbalances:
    // 1. -0.14285714285714285714 (initial)
    // 2. -0.28571428571428571429 (after diff1)
    // 3. 0.1 (after diff2)

    // Sum: -0.14285714285714285714 + -0.28571428571428571429 + 0.1 = -0.32857142857142857143
    // Average: -0.32857142857142857143 / 3 = -0.10952380952380952381
    const expectedRollingImbalance = new Decimal('-0.10952380952380952381');
    expect(orderBookManager.getRollingBidAskImbalance()?.toFixed(20)).toEqual(expectedRollingImbalance.toFixed(20));
  });

  it('should return undefined for rolling imbalance if history is empty', () => {
    const emptyOrderBookManager = new OrderBookManager({ ...initialSnapshot, bids: [], asks: [] }, mockResubscribeCallback, 3);
    expect(emptyOrderBookManager.getRollingBidAskImbalance()).toBeUndefined();
  });

  it('should export a JSON snapshot with rolling imbalance', () => {
    // Add some diffs to populate history
    const diff1: OrderBookDiff = {
      exchangeId: 'BINANCE',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 101,
      bids: [{ price: new Decimal('10000'), quantity: new Decimal('0.5') }],
      asks: [{ price: new Decimal('10001'), quantity: new Decimal('2') }],
      timestamp: Date.now() + 1000,
    };
    orderBookManager.applyDiff(diff1);

    const snapshot = JSON.parse(orderBookManager.toJSONSnapshot());

    expect(snapshot.exchangeId).toBe('BINANCE');
    expect(snapshot.symbol).toBe('BTC/USDT');
    expect(snapshot.bids).toBeInstanceOf(Array);
    expect(snapshot.asks).toBeInstanceOf(Array);
    expect(snapshot.rollingBidAskImbalance).toBeDefined();
    expect(new Decimal(snapshot.rollingBidAskImbalance).toFixed(20)).toEqual(orderBookManager.getRollingBidAskImbalance()?.toFixed(20));
  });
});
