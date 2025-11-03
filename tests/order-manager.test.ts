import { SimpleOrderManager, createInFlightOrder } from '../src/order-management/simpleOrderManager';
import { CreateOrderRequest, OrderState } from '../src/types/orders-basic';
import { ExchangeId, OrderType, TradingSide, TradingPair } from '../src/types/common';

describe('SimpleOrderManager', () => {
  let orderManager: SimpleOrderManager;

  beforeEach(() => {
    orderManager = new SimpleOrderManager();
  });

  const mockCreateOrderRequest: CreateOrderRequest = {
    tradingPair: 'BTC_USDT',
    clientOrderId: 'test-order-123',
    side: TradingSide.BUY,
    orderType: OrderType.LIMIT,
    price: 50000,
    amount: 0.001,
  };

  describe('placeOrder', () => {
    it('should successfully place an order', async () => {
      const result = await orderManager.placeOrder(mockCreateOrderRequest);
      expect(result.success).toBe(true);
      expect(result.clientOrderId).toBe(mockCreateOrderRequest.clientOrderId);

      const order = await orderManager.getOrder(mockCreateOrderRequest.clientOrderId);
      expect(order).toBeDefined();
      expect(order?.state).toBe(OrderState.OPEN);
    });

    it('should return an error for invalid order requests', async () => {
      const invalidRequest = { ...mockCreateOrderRequest, quantity: 0 }; // Invalid quantity
      const result = await orderManager.placeOrder(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.clientOrderId).toBe(invalidRequest.clientOrderId);
    });
  });

  describe('cancelOrder', () => {
    it('should successfully cancel an existing order', async () => {
      await orderManager.placeOrder(mockCreateOrderRequest);
      const result = await orderManager.cancelOrder(mockCreateOrderRequest.clientOrderId);

      expect(result.success).toBe(true);
      expect(result.clientOrderId).toBe(mockCreateOrderRequest.clientOrderId);
      expect(result.currentState).toBe(OrderState.CANCELLED);

      const order = await orderManager.getOrder(mockCreateOrderRequest.clientOrderId);
      expect(order).toBeDefined();
      expect(order?.state).toBe(OrderState.CANCELLED);
    });

    it('should return an error if the order is not found', async () => {
      const result = await orderManager.cancelOrder('non-existent-order');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
      expect(result.currentState).toBe(OrderState.UNKNOWN);
    });

    it('should return an error if the order is already in a terminal state', async () => {
      await orderManager.placeOrder(mockCreateOrderRequest);
      await orderManager.cancelOrder(mockCreateOrderRequest.clientOrderId); // Cancel it once

      const result = await orderManager.cancelOrder(mockCreateOrderRequest.clientOrderId); // Try to cancel again
      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
      expect(result.currentState).toBe(OrderState.CANCELLED);
    });
  });

  describe('getActiveOrders', () => {
    it('should return only active orders', async () => {
      const order1Request = { ...mockCreateOrderRequest, clientOrderId: 'order-1' };
      const order2Request = { ...mockCreateOrderRequest, clientOrderId: 'order-2' };
      const order3Request = { ...mockCreateOrderRequest, clientOrderId: 'order-3' };

      await orderManager.placeOrder(order1Request);
      await orderManager.placeOrder(order2Request);
      await orderManager.placeOrder(order3Request);

      // Cancel order 2
      await orderManager.cancelOrder(order2Request.clientOrderId);

      const activeOrders = await orderManager.getActiveOrders();
      expect(activeOrders.length).toBe(2);
      expect(activeOrders.some(order => order.clientOrderId === 'order-1')).toBe(true);
      expect(activeOrders.some(order => order.clientOrderId === 'order-3')).toBe(true);
      expect(activeOrders.some(order => order.clientOrderId === 'order-2')).toBe(false);
    });
  });

  describe('markOrderFailed', () => {
    it('should mark an order as failed and stop tracking it', async () => {
      await orderManager.placeOrder(mockCreateOrderRequest);
      await orderManager.markOrderFailed(mockCreateOrderRequest.clientOrderId, 'Network error');

      const order = await orderManager.getOrder(mockCreateOrderRequest.clientOrderId);
      expect(order).toBeNull(); // Should be stopped tracking

      const failedOrder = orderManager.getOrdersByState(OrderState.FAILED);
      expect(failedOrder.length).toBe(0); // Should not be in tracked orders
    });
  });

  describe('InFlightOrderImpl terminal states', () => {
    it('should set isDone to true for DONE state', async () => {
      const inFlightOrder = createInFlightOrder(mockCreateOrderRequest);
      inFlightOrder.updateState(OrderState.DONE);
      expect(inFlightOrder.isDone).toBe(true);
    });

    it('should set isDone to true for FILLED state', async () => {
      const inFlightOrder = createInFlightOrder(mockCreateOrderRequest);
      inFlightOrder.updateState(OrderState.FILLED);
      expect(inFlightOrder.isDone).toBe(true);
    });

    it('should set isDone to true for CANCELLED state', async () => {
      const inFlightOrder = createInFlightOrder(mockCreateOrderRequest);
      inFlightOrder.updateState(OrderState.CANCELLED);
      expect(inFlightOrder.isDone).toBe(true);
    });

    it('should set isDone to true for FAILED state', async () => {
      const inFlightOrder = createInFlightOrder(mockCreateOrderRequest);
      inFlightOrder.updateState(OrderState.FAILED);
      expect(inFlightOrder.isDone).toBe(true);
    });

    it('should set isDone to false for OPEN state', async () => {
      const inFlightOrder = createInFlightOrder(mockCreateOrderRequest);
      inFlightOrder.updateState(OrderState.OPEN);
      expect(inFlightOrder.isDone).toBe(false);
    });
  });
});
