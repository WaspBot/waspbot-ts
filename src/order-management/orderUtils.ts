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
/**
 * Checks if a given in-flight order matches any of the specified states.
 * @param order The in-flight order to check.
 * @param states An array of order states to match against.
 * @returns True if the order's state matches any of the specified states, false otherwise.
 */
export function isOrderInAnyState(order: InFlightOrder, states: OrderState[]): boolean {
  return states.includes(order.state);
}

export function filterInFlightOrdersByState(
  orders: InFlightOrder[],
  state: OrderState
): InFlightOrder[] {
  return orders.filter(order => isOrderInState(order, state));
}

/**
 * Validates if a given quantity is within the specified minimum and maximum limits.
 * @param quantity The quantity to validate.
 * @param min The minimum allowed quantity.
 * @param max The maximum allowed quantity.
 * @returns True if the quantity is within limits, false otherwise.
 */
export function validateMinMaxQuantity(quantity: number, min: number, max: number): boolean {
  return quantity >= min && quantity <= max;
}

/**
 * Validates if the notional value (quantity * price) meets the minimum notional requirement.
 * @param quantity The quantity of the order.
 * @param price The price of the asset.
 * @param minNotional The minimum allowed notional value.
 * @returns True if the notional value meets the minimum requirement, false otherwise.
 */
export function validateNotional(quantity: number, price: number, minNotional: number): boolean {
  return (quantity * price) >= minNotional;
}

/**
 * Validates if the requested leverage is within the maximum allowed leverage.
 * @param leverage The requested leverage.
 * @param maxLeverage The maximum allowed leverage.
 * @returns True if the leverage is within limits, false otherwise.
 */
export function validateLeverage(leverage: number, maxLeverage: number): boolean {
  return leverage <= maxLeverage;
}
