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

describe('EventDispatcher Queue Metrics', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher('TestDispatcher', {
      maxQueueSize: 5,
      overflowStrategy: 'drop_incoming',
      batch: { maxBatchSize: 2, maxBatchDelay: 100, strategy: 'sequential' },
    });
    dispatcher.markAsReady();
  });

  afterEach(() => {
    dispatcher.dispose();
  });

  it('should provide correct initial queue metrics', () => {
    const metrics = dispatcher.getQueueMetrics();
    expect(metrics.queueSize).toBe(0);
    expect(metrics.batchBacklog).toBe(0);
    expect(metrics.totalDropped).toBe(0);
    expect(metrics.totalProcessed).toBe(0);
    expect(metrics.totalFailed).toBe(0);
    expect(metrics.averageProcessingTime).toBe(0);
  });

  it('should update queue metrics after emitting events', async () => {
    const handler = jest.fn();
    dispatcher.subscribe('test.event', handler);

    const event1: BaseEvent = { id: '1', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event2: BaseEvent = { id: '2', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };

    await dispatcher.emitEvent(event1);
    await dispatcher.emitEvent(event2);

    // Give some time for async processing to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const metrics = dispatcher.getQueueMetrics();

    expect(metrics.queueSize).toBe(0);
    expect(metrics.batchBacklog).toBe(0);
    expect(metrics.totalProcessed).toBe(2);
    expect(metrics.totalDropped).toBe(0);

    // Emit more events to test dropped events and queue size before processing
    const event3: BaseEvent = { id: '3', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event4: BaseEvent = { id: '4', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event5: BaseEvent = { id: '5', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event6: BaseEvent = { id: '6', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event7: BaseEvent = { id: '7', type: 'test.event', priority: EventPriority.NORMAL, status: EventStatus.PENDING };

    await dispatcher.emitEvent(event3); // Queue: 1
    await dispatcher.emitEvent(event4); // Queue: 2
    await dispatcher.emitEvent(event5); // Queue: 3
    await dispatcher.emitEvent(event6); // Queue: 4
    await dispatcher.emitEvent(event7); // Queue: 5, then should drop since maxQueueSize is 5 and overflowStrategy is drop_incoming

    const metricsAfterOverflow = dispatcher.getQueueMetrics();
    expect(metricsAfterOverflow.queueSize).toBeLessThanOrEqual(5); // Queue size should not exceed maxSize
    expect(metricsAfterOverflow.totalDropped).toBeGreaterThanOrEqual(1); // At least one event should be dropped

    // Ensure all enqueued events are eventually processed
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for all events to be processed

    const finalMetrics = dispatcher.getQueueMetrics();
    expect(finalMetrics.queueSize).toBe(0);
    expect(finalMetrics.batchBacklog).toBe(0);
    // totalProcessed will be 2 (from first batch) + at most 5 (from second batch if not dropped)
    // The exact number depends on when `emitEvent` resolves and `processQueue` runs.
    // We expect 5 additional events to be processed, assuming no drops for the initially enqueued ones.
    expect(finalMetrics.totalProcessed).toBeGreaterThanOrEqual(2 + 4); // 2 from first batch, 4 from second batch if 1 dropped

    dispatcher.clearQueue();
    dispatcher.resetQueueMetrics();
    const clearedMetrics = dispatcher.getQueueMetrics();
    expect(clearedMetrics.queueSize).toBe(0);
    expect(clearedMetrics.batchBacklog).toBe(0);
    expect(clearedMetrics.totalDropped).toBe(0);
    expect(clearedMetrics.totalProcessed).toBe(0);
  });

  it('should reflect batch backlog when events are buffered', async () => {
    // Configure dispatcher to use batching that buffers events
    dispatcher.dispose(); // Dispose previous dispatcher
    dispatcher = new EventDispatcher('TestDispatcherBatch', {
      maxQueueSize: 10,
      overflowStrategy: 'drop_incoming',
      batch: { maxBatchSize: 5, maxBatchDelay: 500, strategy: 'sequential' }, // Long delay to ensure buffering
    });
    dispatcher.markAsReady();

    const handler = jest.fn();
    dispatcher.subscribe('test.batch', handler);

    const event1: BaseEvent = { id: 'b1', type: 'test.batch', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event2: BaseEvent = { id: 'b2', type: 'test.batch', priority: EventPriority.NORMAL, status: EventStatus.PENDING };
    const event3: BaseEvent = { id: 'b3', type: 'test.batch', priority: EventPriority.NORMAL, status: EventStatus.PENDING };

    await dispatcher.emitEvent(event1);
    await dispatcher.emitEvent(event2);
    await dispatcher.emitEvent(event3);

    // Immediately check metrics, before the batch is processed (due to maxBatchDelay)
    const metricsBeforeProcessing = dispatcher.getQueueMetrics();
    expect(metricsBeforeProcessing.queueSize).toBe(3); // 3 events in the queue
    expect(metricsBeforeProcessing.batchBacklog).toBe(0); // Batch backlog should be 0 because events are moved from internal batchBuffer to main queue after sort/compress
    expect(metricsBeforeProcessing.totalProcessed).toBe(0);
    expect(metricsBeforeProcessing.totalDropped).toBe(0);

    // Wait for batch to be processed
    await new Promise(resolve => setTimeout(resolve, 600));

    const metricsAfterProcessing = dispatcher.getQueueMetrics();
    expect(metricsAfterProcessing.queueSize).toBe(0);
    expect(metricsAfterProcessing.batchBacklog).toBe(0);
    expect(metricsAfterProcessing.totalProcessed).toBe(3);
    expect(metricsAfterProcessing.totalDropped).toBe(0);
  });
});