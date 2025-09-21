import { InFlightOrder, OrderState } from '../types/orders-basic';

/**
 * Filter orders by a specific state.
 */
export function filterOrdersByState(
  orders: InFlightOrder[],
  state: OrderState
): InFlightOrder[] {
  return orders.filter(order => order.state === state);
}
