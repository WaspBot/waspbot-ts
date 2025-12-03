import { Logger } from '../core/logger';
import {
  CreateOrderRequest,
  OrderState,
  InFlightOrder,
} from './order';
import { validateCreateOrderRequest } from './orderUtils';
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

export function createInFlightOrder(req: CreateOrderRequest): InFlightOrder {
  return new InFlightOrderImpl(req);
}

import { Logger } from '../core/logger'; // Assuming a Logger is available

export class SimpleOrderManager implements OrderManager {
  private readonly cancelReplaceRateLimitMs: number;
  private readonly lastCancelReplaceTimestamp: Map<TradingPair, number> = new Map();
  private readonly logger: Logger;

  constructor(cancelReplaceRateLimitMs: number = 1000) {
    this.cancelReplaceRateLimitMs = cancelReplaceRateLimitMs;
    this.logger = new Logger(SimpleOrderManager.name);
  }
  /**
   * Stores all in-flight orders by their clientOrderId.
   * An in-flight order is one that has been submitted to an exchange but not yet in a terminal state (filled, cancelled, failed).
   */
  private orders: Map<string, InFlightOrder> = new Map();

  /**
   * Tracks clientOrderIds for orders that are currently being submitted or are in the process of being placed.
   * This helps prevent duplicate order submissions.
   */
  private inFlightOrderIds: Set<string> = new Set();

  /**
   * Tracks clientOrderIds for orders that are currently in the process of being cancelled.
   * This helps prevent repeated cancellation attempts for the same order.
   */
  private pendingCancelOrderIds: Set<string> = new Set();

  /**
   * Places a new order. Guards against duplicate submissions by checking if an order with the same clientOrderId is already in-flight.
   * @param request The CreateOrderRequest containing order details.
   * @returns A Promise that resolves to an OrderPlacementResult.
   */
  async placeOrder(request: CreateOrderRequest): Promise<OrderPlacementResult> {
    if (this.orders.has(request.clientOrderId) || this.inFlightOrderIds.has(request.clientOrderId)) {
      return {
        success: false,
        clientOrderId: request.clientOrderId,
        error: `Order with clientOrderId ${request.clientOrderId} is already in-flight or exists.`,
        timestamp: Date.now(),
      };
    }

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
    this.inFlightOrderIds.add(request.clientOrderId);

    // Simulate an immediate state update to OPEN or PENDING_CREATE
    // In a real scenario, this would come from a connector
    inFlightOrder.updateState(OrderState.OPEN);

    return {
      success: true,
      clientOrderId: request.clientOrderId,
      timestamp: Date.now(),
    };
  }

  /**
   * Cancels an existing order. Guards against repeated cancellation attempts.
   * @param clientOrderId The clientOrderId of the order to cancel.
   * @returns A Promise that resolves to an OrderCancellationResult.
   */
  async cancelOrder(clientOrderId: string): Promise<OrderCancellationResult> {
    if (this.pendingCancelOrderIds.has(clientOrderId)) {
      return {
        success: false,
        clientOrderId,
        error: `Order ${clientOrderId} is already pending cancellation.`,
        currentState: OrderState.PENDING_CANCEL,
        timestamp: Date.now(),
      };
    }

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

    // --- Rate Limiting Logic ---
    const now = Date.now();
    const tradingPair = order.tradingPair;
    const lastCancelTime = this.lastCancelReplaceTimestamp.get(tradingPair) || 0;

    if (now - lastCancelTime < this.cancelReplaceRateLimitMs) {
      this.logger.warn(`Cancel/Replace rate limit exceeded for ${tradingPair}. Last operation was ${now - lastCancelTime}ms ago.`);
      return {
        success: false,
        clientOrderId,
        error: `Rate limit exceeded for ${tradingPair}. Please wait before cancelling/replacing orders for this pair.`,
        currentState: order.state,
        timestamp: now,
      };
    }
    // Update the timestamp for this trading pair
    this.lastCancelReplaceTimestamp.set(tradingPair, now);
    // --- End Rate Limiting Logic ---


    if (isOrderInState(order, [OrderState.PENDING_CANCEL])) {
      return {
        success: false,
        clientOrderId,
        error: `Order ${clientOrderId} is already in a pending cancellation state.`,
        currentState: order.state,
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

    // Mark order as pending cancellation
    order.updateState(OrderState.PENDING_CANCEL);
    this.pendingCancelOrderIds.add(clientOrderId);
    // In a real scenario, a connector would confirm cancellation and call processOrderUpdate
    order.updateState(OrderState.CANCELLED);

    return {
      success: true,
      clientOrderId,
      currentState: order.state,
      timestamp: Date.now(),
    };
  }

  /**
   * Processes an order update, updating the order's state and stopping tracking if the order reaches a terminal state.
   * @param update The order update object, expected to contain clientOrderId and newState.
   */
  async processOrderUpdate(update: any): Promise<void> {
    const order = this.orders.get(update.clientOrderId);
    if (order) {
      order.updateState(update.newState);
      if (isOrderInState(order, [OrderState.FILLED, OrderState.CANCELLED, OrderState.FAILED])) {
        this.stopTracking(order.clientOrderId);
      }
    }
  }

  /**
   * Stops tracking an order, removing it from all internal tracking maps and sets.
   * This should be called when an order reaches a final, terminal state (filled, cancelled, failed).
   * @param clientOrderId The clientOrderId of the order to stop tracking.
   */
  async stopTracking(clientOrderId: string): Promise<void> {
    this.orders.delete(clientOrderId);
    this.inFlightOrderIds.delete(clientOrderId);
    this.pendingCancelOrderIds.delete(clientOrderId);
  }

  // ...implement other OrderManager methods as needed with stubs or logic
  async cancelOrders(clientOrderIds: string[]) {
    throw new Error('Not implemented');
  }
  async cancelAllOrders(tradingPair?: string) {
    throw new Error('Not implemented');
  }
  async modifyOrder(clientOrderId: string, modification: any) {
    // TODO: When implementing modifyOrder, ensure it also respects the cancel/replace rate limit
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
