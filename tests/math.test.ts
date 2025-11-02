import { clamp, safeDivide, roundTo } from '../src/utils/math';

describe('clamp', () => {
  it('should clamp a value within the min and max range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should clamp a value below the minimum to the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should clamp a value above the maximum to the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('should handle negative min and max values', () => {
    expect(clamp(-15, -10, -5)).toBe(-10);
    expect(clamp(-2, -10, -5)).toBe(-5);
  });

  it('should handle zero for min, max, and value', () => {
    expect(clamp(0, -5, 5)).toBe(0);
    expect(clamp(5, 0, 0)).toBe(0);
    expect(clamp(-5, 0, 0)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(clamp(1e10, 0, 1e9)).toBe(1e9);
    expect(clamp(1e-10, 1e-9, 1e-8)).toBe(1e-9);
  });
});

describe('safeDivide', () => {
  it('should divide two numbers correctly', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('should return 0 when the denominator is 0', () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(safeDivide(-10, 2)).toBe(-5);
    expect(safeDivide(10, -2)).toBe(-5);
    expect(safeDivide(-10, -2)).toBe(5);
  });

  it('should handle zero numerator', () => {
    expect(safeDivide(0, 5)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(safeDivide(1e10, 2)).toBe(5e9);
    expect(safeDivide(1e10, 1e-5)).toBe(1e15);
  });
});

describe('roundTo', () => {
  it('should round a number to the specified decimal places', () => {
    expect(roundTo(10.12345, 2)).toBe(10.12);
    expect(roundTo(10.98765, 3)).toBe(10.988);
  });

  it('should handle rounding up correctly', () => {
    expect(roundTo(10.125, 2)).toBe(10.13);
    expect(roundTo(10.999, 2)).toBe(11.00);
  });

  it('should handle rounding down correctly', () => {
    expect(roundTo(10.124, 2)).toBe(10.12);
  });

  it('should handle zero decimal places', () => {
    expect(roundTo(10.5, 0)).toBe(11);
    expect(roundTo(10.4, 0)).toBe(10);
  });

  it('should handle negative numbers', () => {
    expect(roundTo(-10.12345, 2)).toBe(-10.12);
    expect(roundTo(-10.125, 2)).toBe(-10.12);
  });

  it('should handle zero value', () => {
    expect(roundTo(0, 5)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(roundTo(123456789.12345, 5)).toBe(123456789.12345);
  });

  it('should handle small numbers', () => {
    expect(roundTo(0.000000123, 8)).toBe(0.00000012);
    expect(roundTo(0.000000125, 8)).toBe(0.00000013);
  });

  it('should handle cases where decimals is greater than actual decimal places', () => {
    expect(roundTo(10.1, 5)).toBe(10.1);
  });
});
