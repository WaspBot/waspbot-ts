
import { EventDispatcher } from '../src/core/dispatcher';
import { BaseEvent, EventPriority, EventStatus } from '../src/core/events';

describe('EventDispatcher Wildcard Subscriptions', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher('TestDispatcher');
    dispatcher.markAsReady();
  });

  afterEach(() => {
    dispatcher.dispose();
  });

  it('should dispatch events to exact match subscribers', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('test.event', handler);

    const event: BaseEvent = { id: '1', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should dispatch events to wildcard subscribers (single segment)', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('trade.*', handler);

    const tradeUpdateEvent: BaseEvent = { id: '2', type: 'trade.update', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(tradeUpdateEvent);

    const tradeExecuteEvent: BaseEvent = { id: '3', type: 'trade.execute', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(tradeExecuteEvent);

    const orderUpdateEvent: BaseEvent = { id: '4', type: 'order.update', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(orderUpdateEvent); // Should not be called

    expect(handler).toHaveBeenCalledWith(tradeUpdateEvent);
    expect(handler).toHaveBeenCalledWith(tradeExecuteEvent);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should dispatch events to general wildcard subscribers (*)', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('*', handler);

    const event1: BaseEvent = { id: '5', type: 'any.event.type', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(event1);

    const event2: BaseEvent = { id: '6', type: 'another.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(event2);

    expect(handler).toHaveBeenCalledWith(event1);
    expect(handler).toHaveBeenCalledWith(event2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should dispatch events to mixed exact and wildcard subscribers', async () => {
    const exactHandler = jest.fn();
    const wildcardHandler = jest.fn();

    dispatcher.subscribe('market.price', exactHandler);
    dispatcher.subscribe('market.*', wildcardHandler);

    const priceEvent: BaseEvent = { id: '7', type: 'market.price', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(priceEvent);

    const volumeEvent: BaseEvent = { id: '8', type: 'market.volume', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(volumeEvent);

    expect(exactHandler).toHaveBeenCalledWith(priceEvent);
    expect(exactHandler).toHaveBeenCalledTimes(1);

    expect(wildcardHandler).toHaveBeenCalledWith(priceEvent);
    expect(wildcardHandler).toHaveBeenCalledWith(volumeEvent);
    expect(wildcardHandler).toHaveBeenCalledTimes(2); // Called for both price and volume
  });

  it('should not dispatch events to non-matching wildcard subscribers', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('trade.*', handler);

    const nonMatchingEvent: BaseEvent = { id: '9', type: 'order.created', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(nonMatchingEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe exact match subscribers', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('test.event', handler);
    dispatcher.unsubscribe('test.event', handler);

    const event: BaseEvent = { id: '10', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe wildcard subscribers', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('trade.*', handler);
    dispatcher.unsubscribe('trade.*', handler);

    const tradeUpdateEvent: BaseEvent = { id: '11', type: 'trade.update', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(tradeUpdateEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers to the same pattern', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    dispatcher.subscribe('data.*', handler1);
    dispatcher.subscribe('data.*', handler2);

    const dataEvent: BaseEvent = { id: '12', type: 'data.new', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    await dispatcher.emitEvent(dataEvent);

    expect(handler1).toHaveBeenCalledWith(dataEvent);
    expect(handler2).toHaveBeenCalledWith(dataEvent);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should correctly report listener count', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    const handler3 = jest.fn();

    dispatcher.subscribe('event.one', handler1);
    dispatcher.subscribe('event.*', handler2);
    dispatcher.subscribe('another.event', handler3);

    expect(dispatcher.getListenerCount()).toBe(3);

    dispatcher.unsubscribe('event.one', handler1);
    expect(dispatcher.getListenerCount()).toBe(2);

    dispatcher.unsubscribe('event.*', handler2);
    expect(dispatcher.getListenerCount()).toBe(1);

    dispatcher.unsubscribe('another.event', handler3);
    expect(dispatcher.getListenerCount()).toBe(0);
  });

  it('should handle unsubscribeFromMultiple correctly', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    const handler3 = jest.fn();

    dispatcher.subscribe('event.one', handler1);
    dispatcher.subscribe('event.two', handler2);
    dispatcher.subscribe('event.three', handler3);

    dispatcher.unsubscribeFromMultiple(['event.one', 'event.three'], handler1); // This will only unsubscribe handler1 from event.one

    const event1: BaseEvent = { id: '13', type: 'event.one', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event2: BaseEvent = { id: '14', type: 'event.two', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event3: BaseEvent = { id: '15', type: 'event.three', priority: EventPriority.NORMAL, status: EventStatus.PENDING };

    await dispatcher.emitEvent(event1);
    await dispatcher.emitEvent(event2);
    await dispatcher.emitEvent(event3);

    expect(handler1).not.toHaveBeenCalledWith(event1); // Should not be called for event.one
    expect(handler1).not.toHaveBeenCalledWith(event3); // Should not be called for event.three
    expect(handler2).toHaveBeenCalledWith(event2);
    expect(handler3).toHaveBeenCalledWith(event3);
  });

  it('should handle unsubscribeFromAll correctly', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('event.one', handler);
    dispatcher.subscribe('event.*', handler);
    dispatcher.subscribe('another.event', handler);

    dispatcher.unsubscribeFromAll(handler);

    const event1: BaseEvent = { id: '16', type: 'event.one', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event2: BaseEvent = { id: '17', type: 'event.two', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event3: BaseEvent = { id: '18', type: 'another.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };

    await dispatcher.emitEvent(event1);
    await dispatcher.emitEvent(event2);
    await dispatcher.emitEvent(event3);

    expect(handler).not.toHaveBeenCalled();
  });
});
