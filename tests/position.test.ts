import {
  Position,
  EntryLeg,
  PositionSide,
  calculateEntryLegUnrealizedPnl,
  addEntryLeg,
  closeEntryLeg,
  updatePositionMarkPrice,
  aggregatePositionPnl,
} from '../src/order-management/position';
import { Price, Quantity, Timestamp, DecimalAmount } from '../src/types/common';
import { PositionMode } from '../src/order-management/order';

describe('Position Management', () => {
  const mockTimestamp: Timestamp = { value: Date.now(), format: 'milliseconds' };
  const mockCurrency = 'USDT';
  const mockAsset = 'BTC';

  let initialPosition: Position;

  beforeEach(() => {
    initialPosition = {
      symbol: 'BTC/USDT',
      size: { value: 0, asset: mockAsset },
      side: PositionSide.FLAT,
      legs: [],
      markPrice: { value: 0, currency: mockCurrency },
      leverage: 1,
      positionMode: PositionMode.ONE_WAY,
      margin: { value: 0, currency: mockCurrency },
      notional: { value: 0, currency: mockCurrency },
      maintenanceMargin: { value: 0, currency: mockCurrency },
      initialMargin: { value: 0, currency: mockCurrency },
      fundingFees: { value: 0, currency: mockCurrency },
      totalFees: { value: 0, currency: mockCurrency },
      age: 0,
      lastUpdateTime: mockTimestamp,
      exchangeId: 'binance',
      metadata: {},
    };
  });

  describe('calculateEntryLegUnrealizedPnl', () => {
    it('should calculate positive unrealized PnL for a long position', () => {
      const leg: EntryLeg = {
        id: 'leg1',
        quantity: { value: 1, asset: mockAsset },
        entryPrice: { value: 100, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };
      const markPrice: Price = { value: 110, currency: mockCurrency };
      const pnl = calculateEntryLegUnrealizedPnl(leg, markPrice, PositionSide.LONG);
      expect(pnl.value).toBe(10);
      expect(pnl.currency).toBe(mockCurrency);
    });

    it('should calculate negative unrealized PnL for a long position', () => {
      const leg: EntryLeg = {
        id: 'leg1',
        quantity: { value: 1, asset: mockAsset },
        entryPrice: { value: 100, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };
      const markPrice: Price = { value: 90, currency: mockCurrency };
      const pnl = calculateEntryLegUnrealizedPnl(leg, markPrice, PositionSide.LONG);
      expect(pnl.value).toBe(-10);
    });

    it('should calculate positive unrealized PnL for a short position', () => {
      const leg: EntryLeg = {
        id: 'leg1',
        quantity: { value: 1, asset: mockAsset },
        entryPrice: { value: 100, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };
      const markPrice: Price = { value: 90, currency: mockCurrency };
      const pnl = calculateEntryLegUnrealizedPnl(leg, markPrice, PositionSide.SHORT);
      expect(pnl.value).toBe(10);
    });

    it('should calculate negative unrealized PnL for a short position', () => {
      const leg: EntryLeg = {
        id: 'leg1',
        quantity: { value: 1, asset: mockAsset },
        entryPrice: { value: 100, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };
      const markPrice: Price = { value: 110, currency: mockCurrency };
      const pnl = calculateEntryLegUnrealizedPnl(leg, markPrice, PositionSide.SHORT);
      expect(pnl.value).toBe(-10);
    });

    it('should return zero PnL if mark price equals entry price', () => {
      const leg: EntryLeg = {
        id: 'leg1',
        quantity: { value: 1, asset: mockAsset },
        entryPrice: { value: 100, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };
      const markPrice: Price = { value: 100, currency: mockCurrency };
      const pnl = calculateEntryLegUnrealizedPnl(leg, markPrice, PositionSide.LONG);
      expect(pnl.value).toBe(0);
    });
  });

  describe('addEntryLeg', () => {
    it('should add a new leg and update position size for a long position', () => {
      const newLeg: EntryLeg = {
        id: 'leg2',
        quantity: { value: 0.5, asset: mockAsset },
        entryPrice: { value: 105, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };

      const updatedPosition = addEntryLeg(initialPosition, newLeg);
      expect(updatedPosition.legs.length).toBe(1);
      expect(updatedPosition.legs[0]).toEqual(newLeg);
      expect(updatedPosition.size.value).toBe(0.5);
      expect(updatedPosition.side).toBe(PositionSide.LONG);
    });

    it('should add a new leg and update position size for an existing long position', () => {
      initialPosition.legs = [
        {
          id: 'leg1',
          quantity: { value: 1, asset: mockAsset },
          entryPrice: { value: 100, currency: mockCurrency },
          entryTime: mockTimestamp,
          realizedPnl: { value: 0, currency: mockCurrency },
          fees: { value: 0, currency: mockCurrency },
        },
      ];
      initialPosition.size = { value: 1, asset: mockAsset };
      initialPosition.side = PositionSide.LONG;

      const newLeg: EntryLeg = {
        id: 'leg2',
        quantity: { value: 0.5, asset: mockAsset },
        entryPrice: { value: 105, currency: mockCurrency },
        entryTime: mockTimestamp,
        realizedPnl: { value: 0, currency: mockCurrency },
        fees: { value: 0, currency: mockCurrency },
      };

      const updatedPosition = addEntryLeg(initialPosition, newLeg);
      expect(updatedPosition.legs.length).toBe(2);
      expect(updatedPosition.size.value).toBe(1.5);
      expect(updatedPosition.side).toBe(PositionSide.LONG);
    });

    it('should correctly handle adding a leg that changes position from flat to short', () => {
        const newLeg: EntryLeg = {
            id: 'leg1',
            quantity: { value: -0.75, asset: mockAsset },
            entryPrice: { value: 110, currency: mockCurrency },
            entryTime: mockTimestamp,
            realizedPnl: { value: 0, currency: mockCurrency },
            fees: { value: 0, currency: mockCurrency },
        };

        const updatedPosition = addEntryLeg(initialPosition, newLeg);
        expect(updatedPosition.legs.length).toBe(1);
        expect(updatedPosition.size.value).toBe(-0.75);
        expect(updatedPosition.side).toBe(PositionSide.SHORT);
    });
  });

  describe('closeEntryLeg', () => {
    beforeEach(() => {
      initialPosition.legs = [
        {
          id: 'leg1',
          quantity: { value: 1, asset: mockAsset },
          entryPrice: { value: 100, currency: mockCurrency },
          entryTime: mockTimestamp,
          realizedPnl: { value: 0, currency: mockCurrency },
          fees: { value: 0, currency: mockCurrency },
        },
        {
          id: 'leg2',
          quantity: { value: 0.5, asset: mockAsset },
          entryPrice: { value: 110, currency: mockCurrency },
          entryTime: mockTimestamp,
          realizedPnl: { value: 0, currency: mockCurrency },
          fees: { value: 0, currency: mockCurrency },
        },
      ];
      initialPosition.size = { value: 1.5, asset: mockAsset };
      initialPosition.side = PositionSide.LONG;
    });

    it('should partially close the first leg and calculate realized PnL', () => {
      const closeQuantity: Quantity = { value: 0.5, asset: mockAsset };
      const closePrice: Price = { value: 120, currency: mockCurrency };

      const { updatedPosition, realizedPnl } = closeEntryLeg(initialPosition, closeQuantity, closePrice);

      expect(updatedPosition.legs.length).toBe(2);
      expect(updatedPosition.legs[0].quantity.value).toBe(0.5);
      expect(updatedPosition.legs[0].realizedPnl.value).toBe(10);
      expect(updatedPosition.legs[1].quantity.value).toBe(0.5);
      expect(updatedPosition.size.value).toBe(1);
      expect(updatedPosition.side).toBe(PositionSide.LONG);
      expect(realizedPnl.value).toBe(10); // (120 - 100) * 0.5
    });

    it('should fully close the first leg and partially the second, calculating realized PnL', () => {
      const closeQuantity: Quantity = { value: 1.2, asset: mockAsset };
      const closePrice: Price = { value: 120, currency: mockCurrency };

      const { updatedPosition, realizedPnl } = closeEntryLeg(initialPosition, closeQuantity, closePrice);

      expect(updatedPosition.legs.length).toBe(1);
      expect(updatedPosition.legs[0].id).toBe('leg2');
      expect(updatedPosition.legs[0].quantity.value).toBe(0.3);
      expect(updatedPosition.size.value).toBe(0.3);
      expect(updatedPosition.side).toBe(PositionSide.LONG);
      // PnL from leg1: (120-100)*1 = 20
      // PnL from leg2: (120-110)*0.2 = 2
      expect(realizedPnl.value).toBe(22);
    });

    it('should fully close all legs and set position to flat', () => {
      const closeQuantity: Quantity = { value: 1.5, asset: mockAsset };
      const closePrice: Price = { value: 120, currency: mockCurrency };

      const { updatedPosition, realizedPnl } = closeEntryLeg(initialPosition, closeQuantity, closePrice);

      expect(updatedPosition.legs.length).toBe(0);
      expect(updatedPosition.size.value).toBe(0);
      expect(updatedPosition.side).toBe(PositionSide.FLAT);
      // PnL from leg1: (120-100)*1 = 20
      // PnL from leg2: (120-110)*0.5 = 5
      expect(realizedPnl.value).toBe(25);
    });

    it('should handle closing a short position correctly', () => {
        initialPosition.legs = [
            {
              id: 'legS1',
              quantity: { value: -1, asset: mockAsset },
              entryPrice: { value: 100, currency: mockCurrency },
              entryTime: mockTimestamp,
              realizedPnl: { value: 0, currency: mockCurrency },
              fees: { value: 0, currency: mockCurrency },
            },
          ];
          initialPosition.size = { value: -1, asset: mockAsset };
          initialPosition.side = PositionSide.SHORT;

          const closeQuantity: Quantity = { value: 0.5, asset: mockAsset };
          const closePrice: Price = { value: 90, currency: mockCurrency };

          const { updatedPosition, realizedPnl } = closeEntryLeg(initialPosition, closeQuantity, closePrice);
          expect(updatedPosition.size.value).toBe(-0.5);
          expect(updatedPosition.side).toBe(PositionSide.SHORT);
          // For short, PnL is (Entry - Close) * Quantity. So (100 - 90) * 0.5 = 5
          expect(realizedPnl.value).toBe(5);
    });
  });

  describe('updatePositionMarkPrice', () => {
    it('should update the mark price of the position', () => {
      const newMarkPrice: Price = { value: 150, currency: mockCurrency };
      const updatedPosition = updatePositionMarkPrice(initialPosition, newMarkPrice);
      expect(updatedPosition.markPrice.value).toBe(150);
    });
  });

  describe('aggregatePositionPnl', () => {
    beforeEach(() => {
      initialPosition.legs = [
        {
          id: 'leg1',
          quantity: { value: 1, asset: mockAsset },
          entryPrice: { value: 100, currency: mockCurrency },
          entryTime: mockTimestamp,
          realizedPnl: { value: 5, currency: mockCurrency }, // Previous realized PnL
          fees: { value: 0, currency: mockCurrency },
        },
        {
          id: 'leg2',
          quantity: { value: 0.5, asset: mockAsset },
          entryPrice: { value: 110, currency: mockCurrency },
          entryTime: mockTimestamp,
          realizedPnl: { value: 2, currency: mockCurrency }, // Previous realized PnL
          fees: { value: 0, currency: mockCurrency },
        },
      ];
      initialPosition.size = { value: 1.5, asset: mockAsset };
      initialPosition.side = PositionSide.LONG;
      initialPosition.markPrice = { value: 120, currency: mockCurrency };
    });

    it('should correctly aggregate total unrealized, realized PnL, entry price, and percentage for a long position', () => {
      const currentMarkPrice: Price = { value: 120, currency: mockCurrency };
      const { totalUnrealizedPnl, totalRealizedPnl, entryPrice, percentage } = aggregatePositionPnl(
        initialPosition,
        currentMarkPrice,
      );

      // Unrealized PnL:
      // leg1: (120 - 100) * 1 = 20
      // leg2: (120 - 110) * 0.5 = 5
      // Total Unrealized: 25
      expect(totalUnrealizedPnl.value).toBe(25);
      expect(totalRealizedPnl.value).toBe(7); // 5 + 2

      // Weighted Average Entry Price: (1*100 + 0.5*110) / 1.5 = (100 + 55) / 1.5 = 155 / 1.5 = 103.333...
      expect(entryPrice.value).toBeCloseTo(103.333);

      // Total PnL = 25 (unrealized) + 7 (realized) = 32
      // Percentage = (32 / (103.333 * 1.5)) * 100 = (32 / 155) * 100 = 20.645...
      expect(percentage.value).toBeCloseTo(20.645);
    });

    it('should correctly aggregate for a short position', () => {
        initialPosition.legs = [
            {
              id: 'legS1',
              quantity: { value: -1, asset: mockAsset },
              entryPrice: { value: 120, currency: mockCurrency },
              entryTime: mockTimestamp,
              realizedPnl: { value: 10, currency: mockCurrency },
              fees: { value: 0, currency: mockCurrency },
            },
            {
              id: 'legS2',
              quantity: { value: -0.5, asset: mockAsset },
              entryPrice: { value: 110, currency: mockCurrency },
              entryTime: mockTimestamp,
              realizedPnl: { value: 3, currency: mockCurrency },
              fees: { value: 0, currency: mockCurrency },
            },
          ];
          initialPosition.size = { value: -1.5, asset: mockAsset };
          initialPosition.side = PositionSide.SHORT;
          initialPosition.markPrice = { value: 100, currency: mockCurrency };

          const currentMarkPrice: Price = { value: 100, currency: mockCurrency };
          const { totalUnrealizedPnl, totalRealizedPnl, entryPrice, percentage } = aggregatePositionPnl(
            initialPosition,
            currentMarkPrice,
          );

          // Unrealized PnL (short): (entry - mark) * quantity
          // legS1: (120 - 100) * 1 = 20
          // legS2: (110 - 100) * 0.5 = 5
          // Total Unrealized: 25
          expect(totalUnrealizedPnl.value).toBe(25);
          expect(totalRealizedPnl.value).toBe(13); // 10 + 3

          // Weighted Average Entry Price: (-1*120 + -0.5*110) / -1.5 = (-120 - 55) / -1.5 = -175 / -1.5 = 116.666...
          expect(entryPrice.value).toBeCloseTo(116.666);

          // Total PnL = 25 (unrealized) + 13 (realized) = 38
          // Percentage = (38 / (116.666 * 1.5)) * 100 = (38 / 175) * 100 = 21.714...
          expect(percentage.value).toBeCloseTo(21.714);
    });
  });
});
