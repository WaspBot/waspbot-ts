import { InFlightOrder, OrderState } from '../src/types/orders-basic';
import { isOrderInState, filterInFlightOrdersByState } from '../src/order-management/orderUtils';

describe('orderUtils', () => {
  const mockOrder: InFlightOrder = {
    clientOrderId: 'test-order-123',
    exchangeId: 'binance',
    tradingPair: 'BTC_USDT',
    side: 'BUY',
    orderType: 'LIMIT',
    price: 50000,
    amount: 0.001,
    state: OrderState.OPEN,
    exchangeInternalId: 'exchange-id-123',
    placedAt: Date.now(),
    trades: [],
    isDone: false,
    updateState: jest.fn(),
    updateTrades: jest.fn(),
  };

  describe('isOrderInState', () => {
    it('should return true if the order state matches', () => {
      const order = { ...mockOrder, state: OrderState.OPEN };
      expect(isOrderInState(order, OrderState.OPEN)).toBe(true);
    });

    it('should return false if the order state does not match', () => {
      const order = { ...mockOrder, state: OrderState.OPEN };
      expect(isOrderInState(order, OrderState.FILLED)).toBe(false);
    });
  });

  describe('filterInFlightOrdersByState', () => {
    it('should filter orders by the specified state', () => {
      const order1 = { ...mockOrder, clientOrderId: 'order-1', state: OrderState.OPEN };
      const order2 = { ...mockOrder, clientOrderId: 'order-2', state: OrderState.FILLED };
      const order3 = { ...mockOrder, clientOrderId: 'order-3', state: OrderState.OPEN };

      const orders = [order1, order2, order3];
      const filteredOrders = filterInFlightOrdersByState(orders, OrderState.OPEN);

      expect(filteredOrders.length).toBe(2);
      expect(filteredOrders.some(order => order.clientOrderId === 'order-1')).toBe(true);
      expect(filteredOrders.some(order => order.clientOrderId === 'order-3')).toBe(true);
      expect(filteredOrders.some(order => order.clientOrderId === 'order-2')).toBe(false);
    });

    it('should return an empty array if no orders match the state', () => {
      const order1 = { ...mockOrder, clientOrderId: 'order-1', state: OrderState.FILLED };
      const order2 = { ...mockOrder, clientOrderId: 'order-2', state: OrderState.CANCELLED };
      const orders = [order1, order2];
      const filteredOrders = filterInFlightOrdersByState(orders, OrderState.OPEN);
      expect(filteredOrders.length).toBe(0);
    });

    it('should return an empty array if the input array is empty', () => {
      const orders: InFlightOrder[] = [];
      const filteredOrders = filterInFlightOrdersByState(orders, OrderState.OPEN);
      expect(filteredOrders.length).toBe(0);
    });
  });
});
