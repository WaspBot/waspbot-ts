import {
  OrderManager,
  OrderPlacementResult,
  OrderCancellationResult,
} from '../types/orders-management';
import {
  CreateOrderRequest,
  OrderState,
  validateCreateOrderRequest,
  InFlightOrder,
} from '../types/orders-basic';
import {
  WaspBotError,
  ExchangeId,
  TradingPair,
  TradingSide,
  OrderType,
  Price,
  Quantity,
  TimeInForce,
  PositionAction,
} from '../types/common';
import { isOrderInState, filterInFlightOrdersByState } from './orderUtils';

class InFlightOrderImpl implements InFlightOrder {
  id: string;
  state: OrderState;
  creationTimestamp: number;
  lastUpdateTimestamp: number;
  isPendingCreate!: boolean;
  isOpen!: boolean;
  isDone!: boolean;
  isFilled!: boolean;
  isCancelled!: boolean;

  // Properties from CreateOrderRequest
  exchangeId: ExchangeId;
  tradingPair: TradingPair;
  clientOrderId: string;
  side: TradingSide;
  orderType: OrderType;
  price?: Price;
  quantity: Quantity;
  timeInForce?: TimeInForce;
  positionAction?: PositionAction;

  private _fillPromise: Promise<any>;
  private _resolveFill!: (v: any) => void;
  private _rejectFill!: (e: any) => void;

  private _cancelPromise: Promise<any>;
  private _resolveCancel!: (v: any) => void;
  private _rejectCancel!: (e: any) => void;

  constructor(req: CreateOrderRequest) {
    this.id = req.clientOrderId;
    this.state = OrderState.PENDING_CREATE;
    this.creationTimestamp = Date.now();
    this.lastUpdateTimestamp = this.creationTimestamp;

    // Copy request properties
    this.exchangeId = req.exchangeId;
    this.tradingPair = req.tradingPair;
    this.clientOrderId = req.clientOrderId;
    this.side = req.side;
    this.orderType = req.orderType;
    this.price = req.price;
    this.quantity = req.quantity;
    this.timeInForce = req.timeInForce;
    this.positionAction = req.positionAction;

    this.updateStateFlags();

    this._fillPromise = new Promise<any>((res, rej) => {
      this._resolveFill = res;
      this._rejectFill = rej;
    });
    this._cancelPromise = new Promise<any>((res, rej) => {
      this._resolveCancel = res;
      this._rejectCancel = rej;
    });
  }

  private updateStateFlags() {
    this.isPendingCreate = this.state === OrderState.PENDING_CREATE;
    this.isOpen = this.state === OrderState.OPEN;
    this.isDone = [
      OrderState.DONE,
      OrderState.FILLED,
      OrderState.CANCELLED,
      OrderState.FAILED,
    ].includes(this.state);
    this.isFilled = this.state === OrderState.FILLED;
    this.isCancelled = this.state === OrderState.CANCELLED;
  }

  updateState(newState: OrderState) {
    this.state = newState;
    this.lastUpdateTimestamp = Date.now();
    this.updateStateFlags();

    if (newState === OrderState.FILLED) {
      this._resolveFill(this);
    } else if (newState === OrderState.CANCELLED) {
      this._resolveCancel(this);
    } else if (newState === OrderState.FAILED) {
      this._rejectFill(new WaspBotError(`Order ${this.id} failed.`));
      this._rejectCancel(new WaspBotError(`Order ${this.id} failed.`));
    }
  }

  failOrder(error: Error) {
    this.state = OrderState.FAILED;
    this.lastUpdateTimestamp = Date.now();
    this.updateStateFlags();
    this._rejectFill(error);
    this._rejectCancel(error);
  }

  waitForFill(): Promise<any> {
    return this._fillPromise;
  }

  waitForCancel(): Promise<any> {
    return this._cancelPromise;
  }
}

function createInFlightOrder(req: CreateOrderRequest): InFlightOrder {
  return new InFlightOrderImpl(req);
}

export class SimpleOrderManager implements OrderManager {
  private orders: Map<string, InFlightOrder> = new Map();

  async placeOrder(request: CreateOrderRequest): Promise<OrderPlacementResult> {
    try {
      validateCreateOrderRequest(request);
    } catch (error) {
      if (error instanceof WaspBotError) {
        return {
          success: false,
          clientOrderId: request.clientOrderId,
          error: error.message,
          timestamp: Date.now(),
        };
      } else {
        throw error;
      }
    }

    const inFlightOrder = new InFlightOrderImpl(request);
    this.orders.set(request.clientOrderId, inFlightOrder);

    // Simulate an immediate state update to OPEN or PENDING_CREATE
    // In a real scenario, this would come from a connector
    inFlightOrder.updateState(OrderState.OPEN);

    return {
      success: true,
      clientOrderId: request.clientOrderId,
      timestamp: Date.now(),
    };
  }

  async cancelOrder(clientOrderId: string): Promise<OrderCancellationResult> {
    const order = this.orders.get(clientOrderId);
    if (!order) {
      return {
        success: false,
        clientOrderId,
        error: 'Order not found',
        currentState: OrderState.UNKNOWN,
        timestamp: Date.now(),
      };
    }

    if (isOrderInState(order, [OrderState.CANCELLED, OrderState.FILLED, OrderState.FAILED])) {
      return {
        success: false,
        clientOrderId,
        error: `Order is already in a terminal state: ${order.state}`,
        currentState: order.state,
        timestamp: Date.now(),
      };
    }

    // Simulate cancellation
    order.updateState(OrderState.PENDING_CANCEL);
    // In a real scenario, a connector would confirm cancellation and call processOrderUpdate
    order.updateState(OrderState.CANCELLED);

    return {
      success: true,
      clientOrderId,
      currentState: order.state,
      timestamp: Date.now(),
    };
  }

  async processOrderUpdate(update: any): Promise<void> {
    const order = this.orders.get(update.clientOrderId);
    if (order) {
      order.updateState(update.newState);
      if (isOrderInState(order, [OrderState.FILLED, OrderState.CANCELLED, OrderState.FAILED])) {
        this.stopTracking(order.clientOrderId);
      }
    }
  }

  async stopTracking(clientOrderId: string): Promise<void> {
    this.orders.delete(clientOrderId);
  }

  // ...implement other OrderManager methods as needed with stubs or logic
  async cancelOrders(clientOrderIds: string[]) {
    throw new Error('Not implemented');
  }
  async cancelAllOrders(tradingPair?: string) {
    throw new Error('Not implemented');
  }
  async modifyOrder(clientOrderId: string, modification: any) {
    throw new Error('Not implemented');
  }
  async getOrder(clientOrderId: string) {
    return this.orders.get(clientOrderId) || null;
  }
  async getOrderByExchangeId(exchangeOrderId: string) {
    throw new Error('Not implemented');
  }
  async getOrders(filter?: any) {
    throw new Error('Not implemented');
  }
  async getActiveOrders() {
    return Array.from(this.orders.values()).filter(
      order =>
        !isOrderInState(order, [
          OrderState.DONE,
          OrderState.FILLED,
          OrderState.CANCELLED,
          OrderState.FAILED,
        ])
    );
  }
  async getOrdersForPair(tradingPair: string) {
    throw new Error('Not implemented');
  }
  async getOrdersForExchange(exchangeId: string) {
    throw new Error('Not implemented');
  }
  async updateOrderState(update: any) {
    throw new Error('Not implemented');
  }
  async processTradeUpdate(trade: any) {
    throw new Error('Not implemented');
  }
  async markOrderFailed(clientOrderId: string, reason: string) {
    const order = this.orders.get(clientOrderId);
    if (order) {
      order.failOrder(new WaspBotError(reason));
      this.stopTracking(clientOrderId);
    }
  }
  async startTracking(order: any) {
    throw new Error('Not implemented');
  }
  async getExecutionStats(period?: any) {
    throw new Error('Not implemented');
  }
  async getPerformanceMetrics() {
    throw new Error('Not implemented');
  }
  async getLostOrders() {
    throw new Error('Not implemented');
  }
  async reconcileOrders(exchangeId: string) {
    throw new Error('Not implemented');
  }

  /**
   * Get orders in specific state.
   */
  getOrdersByState(state: OrderState): InFlightOrder[] {
    const allOrders = Array.from(this.orders.values());
    return filterInFlightOrdersByState(allOrders, state);
  }
}
