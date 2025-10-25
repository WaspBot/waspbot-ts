import { InFlightOrder, OrderState } from '../types/orders-basic';

/**
 * Checks if a given in-flight order matches the specified state.
 * @param order The in-flight order to check.
 * @param state The order state to match against.
 * @returns True if the order's state matches the specified state, false otherwise.
 */
export function isOrderInState(order: InFlightOrder, state: OrderState): boolean {
  return order.state === state;
}

/**
 * Filters a list of in-flight orders, returning only those that match the specified state.
 * @param orders An array of in-flight orders to filter.
 * @param state The order state to filter by.
 * @returns A new array containing only the orders that are in the specified state.
 */
export function filterInFlightOrdersByState(
  orders: InFlightOrder[],
  state: OrderState
): InFlightOrder[] {
  return orders.filter(order => isOrderInState(order, state));
}
