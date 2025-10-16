/**
 * Clamps a number between a minimum and maximum value.
 * @param value The number to clamp.
 * @param min The minimum allowed value.
 * @param max The maximum allowed value.
 * @returns The clamped number.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Divides two numbers safely, returning 0 if the divisor is 0 to prevent division by zero errors.
 * @param numerator The dividend.
 * @param denominator The divisor.
 * @returns The result of the division, or 0 if the denominator is 0.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Rounds a number to a specified number of decimal places.
 * @param value The number to round.
 * @param decimals The number of decimal places to round to.
 * @returns The rounded number.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}