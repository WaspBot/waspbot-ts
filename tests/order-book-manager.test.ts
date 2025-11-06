import { OrderBookManager, OrderBook, OrderBookDiff, OrderBookEntry } from '../src/market-data/order-book';
import { Decimal } from 'decimal.js';

describe('OrderBookManager', () => {
  let initialSnapshot: OrderBook;
  let resubscribeMock: jest.Mock;

  beforeEach(() => {
    resubscribeMock = jest.fn();
    initialSnapshot = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      bids: [
        { price: new Decimal(100), quantity: new Decimal(1) },
        { price: new Decimal(99), quantity: new Decimal(2) },
      ],
      asks: [
        { price: new Decimal(101), quantity: new Decimal(1) },
        { price: new Decimal(102), quantity: new Decimal(2) },
      ],
      lastUpdateId: 100,
      timestamp: Date.now(),
    };
  });

  it('should initialize with a given snapshot', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    const orderBook = manager.getOrderBook();

    expect(orderBook.exchangeId).toBe(initialSnapshot.exchangeId);
    expect(orderBook.symbol).toBe(initialSnapshot.symbol);
    expect(orderBook.bids).toEqual(initialSnapshot.bids);
    expect(orderBook.asks).toEqual(initialSnapshot.asks);
    expect(orderBook.lastUpdateId).toBe(initialSnapshot.lastUpdateId);
  });

  it('should apply diffs correctly (add, update, remove bids)', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    const diff: OrderBookDiff = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 102,
      bids: [
        { price: new Decimal(100), quantity: new Decimal(0.5) }, // Update existing
        { price: new Decimal(98), quantity: new Decimal(3) },   // Add new
        { price: new Decimal(99), quantity: new Decimal(0) },   // Remove existing
      ],
      asks: [],
      timestamp: Date.now(),
    };
    manager.applyDiff(diff);

    const orderBook = manager.getOrderBook();
    expect(orderBook.bids.length).toBe(2);
    expect(orderBook.bids[0]).toEqual({ price: new Decimal(100), quantity: new Decimal(0.5) });
    expect(orderBook.bids[1]).toEqual({ price: new Decimal(98), quantity: new Decimal(3) });
    expect(orderBook.lastUpdateId).toBe(102);
  });

  it('should apply diffs correctly (add, update, remove asks)', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    const diff: OrderBookDiff = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 102,
      bids: [],
      asks: [
        { price: new Decimal(101), quantity: new Decimal(0.5) }, // Update existing
        { price: new Decimal(103), quantity: new Decimal(3) },   // Add new
        { price: new Decimal(102), quantity: new Decimal(0) },   // Remove existing
      ],
      timestamp: Date.now(),
    };
    manager.applyDiff(diff);

    const orderBook = manager.getOrderBook();
    expect(orderBook.asks.length).toBe(2);
    expect(orderBook.asks[0]).toEqual({ price: new Decimal(101), quantity: new Decimal(0.5) });
    expect(orderBook.asks[1]).toEqual({ price: new Decimal(103), quantity: new Decimal(3) });
    expect(orderBook.lastUpdateId).toBe(102);
  });

  it('should trigger resubscribe if firstUpdateId is out of sync', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    const diff: OrderBookDiff = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      firstUpdateId: 105, // Out of sync
      finalUpdateId: 106,
      bids: [],
      asks: [],
      timestamp: Date.now(),
    };
    manager.applyDiff(diff);

    expect(resubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('should trigger resubscribe if checksums diverge', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    // Manually modify the internal order book to cause a checksum mismatch
    // @ts-ignore - Accessing private property for testing purposes
    manager.orderBook.bids.push({ price: new Decimal(90), quantity: new Decimal(1) });

    // Apply a dummy diff to trigger checksum verification
    const diff: OrderBookDiff = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 102,
      bids: [],
      asks: [],
      timestamp: Date.now(),
    };

    // To trigger the checksum verification, we need to make sure updateCount reaches checksumInterval
    // For testing, we can temporarily set checksumInterval to 1
    // @ts-ignore - Accessing private property for testing purposes
    manager.checksumInterval = 1;
    manager.applyDiff(diff);

    expect(resubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('should not trigger resubscribe if checksums match', () => {
    const manager = new OrderBookManager(initialSnapshot, resubscribeMock);
    const diff: OrderBookDiff = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      firstUpdateId: 101,
      finalUpdateId: 102,
      bids: [],
      asks: [],
      timestamp: Date.now(),
    };

    // @ts-ignore
    manager.checksumInterval = 1;
    manager.applyDiff(diff);

    expect(resubscribeMock).not.toHaveBeenCalled();
  });

  // New validation tests
  it('should throw an error if initialSnapshot is null', () => {
    expect(() => new OrderBookManager(null as any, resubscribeMock)).toThrow('Initial snapshot cannot be null or undefined.');
  });

  it('should throw an error if initialSnapshot is undefined', () => {
    expect(() => new OrderBookManager(undefined as any, resubscribeMock)).toThrow('Initial snapshot cannot be null or undefined.');
  });

  it('should throw an error if initialSnapshot is missing exchangeId', () => {
    const invalidSnapshot = { ...initialSnapshot, exchangeId: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: exchangeId.');
  });

  it('should throw an error if initialSnapshot is missing symbol', () => {
    const invalidSnapshot = { ...initialSnapshot, symbol: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: symbol.');
  });

  it('should throw an error if initialSnapshot is missing bids', () => {
    const invalidSnapshot = { ...initialSnapshot, bids: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: bids.');
  });

  it('should throw an error if initialSnapshot is missing asks', () => {
    const invalidSnapshot = { ...initialSnapshot, asks: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: asks.');
  });

  it('should throw an error if initialSnapshot is missing lastUpdateId', () => {
    const invalidSnapshot = { ...initialSnapshot, lastUpdateId: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: lastUpdateId.');
  });

  it('should throw an error if initialSnapshot is missing timestamp', () => {
    const invalidSnapshot = { ...initialSnapshot, timestamp: undefined as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot is missing required field: timestamp.');
  });

  it('should throw an error if bids is not an array', () => {
    const invalidSnapshot = { ...initialSnapshot, bids: {} as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot bids must be an array.');
  });

  it('should throw an error if asks is not an array', () => {
    const invalidSnapshot = { ...initialSnapshot, asks: "not an array" as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Initial snapshot asks must be an array.');
  });

  it('should throw an error if a bid entry is not an object', () => {
    const invalidSnapshot = { ...initialSnapshot, bids: [null as any] };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow('Invalid bids entry at index 0: must be an object.');
  });

  it('should throw an error if an ask entry is missing price', () => {
    const invalidSnapshot = { ...initialSnapshot, asks: [{ quantity: new Decimal(1) }] as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow(`Invalid asks entry at index 0: missing 'price' or 'quantity' field.`);
  });

  it('should throw an error if a bid entry has non-Decimal price', () => {
    const invalidSnapshot = { ...initialSnapshot, bids: [{ price: "abc", quantity: new Decimal(1) }] as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow(/Invalid bids entry at index 0: 'price' or 'quantity' cannot be converted to Decimal./);
  });

  it('should throw an error if an ask entry has non-Decimal quantity', () => {
    const invalidSnapshot = { ...initialSnapshot, asks: [{ price: new Decimal(100), quantity: {} }] as any };
    expect(() => new OrderBookManager(invalidSnapshot, resubscribeMock)).toThrow(/Invalid asks entry at index 0: 'price' or 'quantity' cannot be converted to Decimal./);
  });

  it('should correctly convert string/number prices and quantities to Decimal', () => {
    const snapshotWithStringsAndNumbers: OrderBook = {
      exchangeId: 'binance',
      symbol: 'BTC/USDT',
      bids: [
        { price: "100.5", quantity: 1.5 } as any,
      ],
      asks: [
        { price: 101.5, quantity: "2.5" } as any,
      ],
      lastUpdateId: 100,
      timestamp: Date.now(),
    };
    const manager = new OrderBookManager(snapshotWithStringsAndNumbers, resubscribeMock);
    const orderBook = manager.getOrderBook();

    expect(orderBook.bids[0].price).toEqual(new Decimal("100.5"));
    expect(orderBook.bids[0].quantity).toEqual(new Decimal("1.5"));
    expect(orderBook.asks[0].price).toEqual(new Decimal("101.5"));
    expect(orderBook.asks[0].quantity).toEqual(new Decimal("2.5"));
  });
});
