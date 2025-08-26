/**
 * @fileoverview Core EventDispatcher class for WaspBot-TS
 * Implements subscription management, emit methods, and priority queue support
 */

import { EventEmitter } from 'events';
import { EventListener } from './listener.js';
import { BaseEvent, EventPriority } from './events.js';

// ============================================================================
// Event Filtering and Routing Types
// ============================================================================

/**
 * Event filter criteria
 */
export interface EventFilter {
  /** Filter by event types (supports wildcards) */
  types?: string[];
  /** Filter by event sources */
  sources?: string[];
  /** Filter by minimum priority */
  minPriority?: EventPriority;
  /** Filter by maximum priority */
  maxPriority?: EventPriority;
  /** Custom filter function */
  customFilter?: (event: BaseEvent) => boolean;
}

/**
 * Event routing configuration
 */
export interface EventRoute {
  /** Route identifier */
  id: string;
  /** Event filter criteria */
  filter: EventFilter;
  /** Target listeners */
  listeners: Set<EventListener>;
  /** Route priority (higher = processed first) */
  priority: number;
  /** Whether this route is active */
  active: boolean;
}

/**
 * Subscription with filtering support
 */
export interface FilteredSubscription {
  /** Subscription identifier */
  id: string;
  /** Event listener */
  listener: EventListener;
  /** Event filter criteria */
  filter: EventFilter;
  /** Whether subscription is active */
  active: boolean;
}

// ============================================================================
// Event Queue with Priority Support
// ============================================================================

/**
 * Event queue item with priority support
 */
interface QueuedEvent {
  readonly event: BaseEvent;
  readonly priority: EventPriority;
  readonly timestamp: number;
  readonly retryCount?: number;
}

/**
 * Queue overflow strategies
 */
export enum QueueOverflowStrategy {
  /** Drop incoming events when queue is full */
  DROP_INCOMING = 'DROP_INCOMING',
  /** Drop oldest events when queue is full */
  DROP_OLDEST = 'DROP_OLDEST',
  /** Drop lowest priority events when queue is full */
  DROP_LOWEST_PRIORITY = 'DROP_LOWEST_PRIORITY',
  /** Block until space is available */
  BLOCK = 'BLOCK',
  /** Reject with error */
  REJECT = 'REJECT',
}

/**
 * Queue processing state
 */
export enum QueueProcessingState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  PAUSED = 'PAUSED',
  DRAINING = 'DRAINING',
  ERROR = 'ERROR',
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  /** Current queue size */
  size: number;
  /** Maximum size reached */
  maxSize: number;
  /** Total events processed */
  totalProcessed: number;
  /** Total events dropped */
  totalDropped: number;
  /** Total events failed */
  totalFailed: number;
  /** Average processing time (ms) */
  avgProcessingTime: number;
  /** Current processing rate (events/sec) */
  processingRate: number;
  /** Queue processing state */
  state: QueueProcessingState;
  /** Backpressure active */
  backpressureActive: boolean;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum queue size */
  maxSize?: number;
  /** Overflow strategy when queue is full */
  overflowStrategy?: QueueOverflowStrategy;
  /** Enable backpressure handling */
  enableBackpressure?: boolean;
  /** Backpressure threshold (percentage of maxSize) */
  backpressureThreshold?: number;
  /** Processing batch size */
  batchSize?: number;
  /** Maximum processing time per event (ms) */
  maxProcessingTime?: number;
  /** Enable metrics collection */
  enableMetrics?: boolean;
}

/**
 * Default queue configuration
 */
const DEFAULT_QUEUE_CONFIG: Required<QueueConfig> = {
  maxSize: 1000,
  overflowStrategy: QueueOverflowStrategy.DROP_LOWEST_PRIORITY,
  enableBackpressure: true,
  backpressureThreshold: 0.8, // 80%
  batchSize: 10,
  maxProcessingTime: 5000,
  enableMetrics: true,
};

/**
 * Advanced priority-based event queue with backpressure and monitoring
 */
class EventQueue {
  private queue: QueuedEvent[] = [];
  private readonly config: Required<QueueConfig>;
  private metrics: QueueMetrics;
  private processingState: QueueProcessingState = QueueProcessingState.IDLE;
  private processingTimes: number[] = [];
  private lastMetricsUpdate: number = Date.now();

  constructor(config: QueueConfig = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.metrics = {
      size: 0,
      maxSize: 0,
      totalProcessed: 0,
      totalDropped: 0,
      totalFailed: 0,
      avgProcessingTime: 0,
      processingRate: 0,
      state: QueueProcessingState.IDLE,
      backpressureActive: false,
    };
  }

  /**
   * Add event to queue with overflow handling
   */
  public enqueue(event: BaseEvent): boolean {
    const queuedEvent: QueuedEvent = {
      event,
      priority: event.priority,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Check if queue is at capacity
    if (this.queue.length >= this.config.maxSize) {
      return this.handleOverflow(queuedEvent);
    }

    // Insert in priority order (highest priority first)
    this.insertByPriority(queuedEvent);
    this.updateMetrics();
    return true;
  }

  /**
   * Insert event by priority order (highest priority first)
   */
  private insertByPriority(queuedEvent: QueuedEvent): void {
    let insertIndex = 0;
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item && item.priority < queuedEvent.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.queue.splice(insertIndex, 0, queuedEvent);
  }

  /**
   * Handle queue overflow based on strategy
   */
  private handleOverflow(newEvent: QueuedEvent): boolean {
    switch (this.config.overflowStrategy) {
      case QueueOverflowStrategy.DROP_INCOMING: {
        this.metrics.totalDropped++;
        this.updateMetrics();
        return false;
      }

      case QueueOverflowStrategy.DROP_OLDEST: {
        this.queue.shift(); // Remove oldest
        this.insertByPriority(newEvent);
        this.metrics.totalDropped++;
        this.updateMetrics();
        return true;
      }

      case QueueOverflowStrategy.DROP_LOWEST_PRIORITY: {
        const lowest = this.peekLowest();
        if (lowest && lowest.priority <= newEvent.priority) {
          this.popLowest();
          // Insert directly to avoid re-entering overflow handling
          this.insertByPriority(newEvent);
          this.metrics.totalDropped++;
          this.updateMetrics();
          return true;
        }
        this.metrics.totalDropped++;
        this.updateMetrics();
        return false;
      }

      case QueueOverflowStrategy.REJECT: {
        throw new Error(`Queue overflow: maximum size ${this.config.maxSize} exceeded`);
      }

      case QueueOverflowStrategy.BLOCK: {
        // In a real implementation, this would block until space is available
        // For now, we'll just drop the event
        this.metrics.totalDropped++;
        this.updateMetrics();
        return false;
      }

      default: {
        this.metrics.totalDropped++;
        this.updateMetrics();
        return false;
      }
    }
  }

  /**
   * Remove and return the highest priority event
   */
  public dequeue(): QueuedEvent | undefined {
    const event = this.queue.shift();
    if (event) {
      this.updateMetrics();
    }
    return event;
  }

  /**
   * Dequeue multiple events for batch processing
   */
  public dequeueBatch(maxSize: number = this.config.batchSize): QueuedEvent[] {
    const batch: QueuedEvent[] = [];
    const actualSize = Math.min(maxSize, this.queue.length);

    for (let i = 0; i < actualSize; i++) {
      const event = this.queue.shift();
      if (event) {
        batch.push(event);
      }
    }

    if (batch.length > 0) {
      this.updateMetrics();
    }

    return batch;
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get current queue size
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Clear all events from queue
   */
  public clear(): void {
    this.queue = [];
    this.updateMetrics();
  }

  /**
   * Peek lowest-priority (FIFO within same priority)
   */
  public peekLowest(): QueuedEvent | undefined {
    return this.queue[this.queue.length - 1];
  }

  /**
   * Remove and return the lowest-priority item
   */
  public popLowest(): QueuedEvent | undefined {
    const event = this.queue.pop();
    if (event) {
      this.updateMetrics();
    }
    return event;
  }

  /**
   * Check if backpressure should be applied
   */
  public isBackpressureActive(): boolean {
    if (!this.config.enableBackpressure) {
      return false;
    }
    const threshold = this.config.maxSize * this.config.backpressureThreshold;
    return this.queue.length >= threshold;
  }

  /**
   * Get queue metrics
   */
  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Update processing state
   */
  public setProcessingState(state: QueueProcessingState): void {
    this.processingState = state;
    this.metrics.state = state;
  }

  /**
   * Record successful event processing
   */
  public recordProcessingSuccess(processingTime: number): void {
    this.metrics.totalProcessed++;
    this.recordProcessingTime(processingTime);
  }

  /**
   * Record failed event processing
   */
  public recordProcessingFailure(): void {
    this.metrics.totalFailed++;
  }

  /**
   * Record processing time for metrics
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);

    // Keep only recent processing times (last 100)
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }

    // Update average processing time
    this.metrics.avgProcessingTime =
      this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
  }

  /**
   * Update queue metrics
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) {
      return;
    }

    this.metrics.size = this.queue.length;
    this.metrics.maxSize = Math.max(this.metrics.maxSize, this.queue.length);
    this.metrics.backpressureActive = this.isBackpressureActive();

    // Calculate processing rate (events per second)
    const now = Date.now();
    const timeDiff = (now - this.lastMetricsUpdate) / 1000;
    if (timeDiff >= 1.0) {
      const eventsProcessed = this.metrics.totalProcessed;
      this.metrics.processingRate = eventsProcessed / timeDiff;
      this.lastMetricsUpdate = now;
    }
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      size: this.queue.length,
      maxSize: 0,
      totalProcessed: 0,
      totalDropped: 0,
      totalFailed: 0,
      avgProcessingTime: 0,
      processingRate: 0,
      state: this.processingState,
      backpressureActive: this.isBackpressureActive(),
    };
    this.processingTimes = [];
    this.lastMetricsUpdate = Date.now();
  }
}

// ============================================================================
// EventDispatcher Configuration
// ============================================================================

/**
 * Configuration options for EventDispatcher
 */
export interface EventDispatcherConfig {
  /** Maximum number of events in queue */
  maxQueueSize?: number;
  /** Enable async event processing */
  enableAsync?: boolean;
  /** Maximum processing time per event (ms) */
  maxProcessingTime?: number;
  /** Queue configuration */
  queueConfig?: QueueConfig;
  /** Enable batch processing */
  enableBatchProcessing?: boolean;
  /** Batch processing size */
  batchSize?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<EventDispatcherConfig> = {
  maxQueueSize: 1000,
  enableAsync: true,
  maxProcessingTime: 5000,
  queueConfig: DEFAULT_QUEUE_CONFIG,
  enableBatchProcessing: false,
  batchSize: 10,
};

// ============================================================================
// Core EventDispatcher Class
// ============================================================================

/**
 * Central event dispatcher with subscription management and priority queuing
 */
export class EventDispatcher extends EventEmitter {
  private readonly listenerRegistry = new Map<string, Set<EventListener>>();
  private readonly eventQueue: EventQueue;
  private readonly config: Required<EventDispatcherConfig>;
  private processing = false;

  // Event filtering and routing
  private readonly filteredSubscriptions = new Map<string, FilteredSubscription>();
  private readonly eventRoutes = new Map<string, EventRoute>();
  private subscriptionCounter = 0;
  private routeCounter = 0;

  constructor(
    public readonly name: string = 'EventDispatcher',
    config: EventDispatcherConfig = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create enhanced event queue with configuration
    const queueConfig: QueueConfig = {
      ...this.config.queueConfig,
      maxSize: this.config.maxQueueSize,
      batchSize: this.config.batchSize,
      maxProcessingTime: this.config.maxProcessingTime,
    };
    this.eventQueue = new EventQueue(queueConfig);
  }

  // ============================================================================
  // Subscription Management (with weak references)
  // ============================================================================

  /**
   * Subscribe a listener to specific event types
   */
  public subscribe(eventType: string, listener: EventListener): void {
    if (!this.listenerRegistry.has(eventType)) {
      this.listenerRegistry.set(eventType, new Set());
    }

    this.listenerRegistry.get(eventType)!.add(listener);
    super.emit('listenerAdded', eventType, listener);
  }

  /**
   * Subscribe a listener with event filtering
   */
  public subscribeWithFilter(filter: EventFilter, listener: EventListener): string {
    const subscriptionId = `filtered_${++this.subscriptionCounter}`;

    const subscription: FilteredSubscription = {
      id: subscriptionId,
      listener,
      filter,
      active: true,
    };

    this.filteredSubscriptions.set(subscriptionId, subscription);
    super.emit('filteredListenerAdded', subscriptionId, listener, filter);

    return subscriptionId;
  }

  /**
   * Subscribe to multiple event types with wildcard support
   */
  public subscribeToPattern(pattern: string, listener: EventListener): string {
    const filter: EventFilter = {
      types: [pattern],
    };

    return this.subscribeWithFilter(filter, listener);
  }

  /**
   * Subscribe to multiple event types at once
   */
  public subscribeToMultiple(eventTypes: string[], listener: EventListener): void {
    for (const eventType of eventTypes) {
      this.subscribe(eventType, listener);
    }
  }

  /**
   * Unsubscribe a listener from specific event types
   */
  public unsubscribe(eventType: string, listener: EventListener): void {
    const listeners = this.listenerRegistry.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listenerRegistry.delete(eventType);
      }
      super.emit('listenerRemoved', eventType, listener);
    }
  }

  /**
   * Unsubscribe from a filtered subscription
   */
  public unsubscribeFiltered(subscriptionId: string): boolean {
    const subscription = this.filteredSubscriptions.get(subscriptionId);
    if (subscription) {
      this.filteredSubscriptions.delete(subscriptionId);
      super.emit('filteredListenerRemoved', subscriptionId, subscription.listener);
      return true;
    }
    return false;
  }

  /**
   * Unsubscribe from multiple event types at once
   */
  public unsubscribeFromMultiple(eventTypes: string[], listener: EventListener): void {
    for (const eventType of eventTypes) {
      this.unsubscribe(eventType, listener);
    }
  }

  /**
   * Unsubscribe a listener from all event types
   */
  public unsubscribeFromAll(listener: EventListener): void {
    for (const [eventType, listeners] of this.listenerRegistry) {
      if (listeners.has(listener)) {
        this.unsubscribe(eventType, listener);
      }
    }
  }

  /**
   * Get all listeners for an event type
   */
  public getListeners(eventType: string): EventListener[] {
    const listeners = this.listenerRegistry.get(eventType);
    return listeners ? Array.from(listeners) : [];
  }

  /**
   * Get all listeners for an event (including filtered subscriptions)
   */
  public getAllListenersForEvent(event: BaseEvent): EventListener[] {
    const directListeners = this.getListeners(event.type);

    // Collect route listeners ordered by route priority (desc)
    const routeListenersPrioritized: EventListener[] = Array.from(this.eventRoutes.values())
      .filter(route => route.active && this.matchesFilter(event, route.filter))
      .sort((a, b) => b.priority - a.priority)
      .flatMap(route => Array.from(route.listeners));

    // Collect filtered subscription listeners
    const filteredListeners: EventListener[] = [];
    for (const subscription of this.filteredSubscriptions.values()) {
      if (subscription.active && this.matchesFilter(event, subscription.filter)) {
        filteredListeners.push(subscription.listener);
      }
    }

    // Combine in order and dedupe preserving first occurrence
    const combined = [...directListeners, ...routeListenersPrioritized, ...filteredListeners];
    const seen = new Set<EventListener>();
    const deduped: EventListener[] = [];
    for (const l of combined) {
      if (!seen.has(l)) {
        seen.add(l);
        deduped.push(l);
      }
    }
    return deduped;
  }

  /**
   * Check if there are any listeners for an event type
   */
  public hasListeners(eventType: string): boolean {
    const listeners = this.listenerRegistry.get(eventType);
    return listeners ? listeners.size > 0 : false;
  }

  /**
   * Get total number of registered listeners
   */
  public getListenerCount(): number {
    let count = 0;
    for (const listeners of this.listenerRegistry.values()) {
      count += listeners.size;
    }
    return count;
  }

  // ============================================================================
  // Event Emission and Processing
  // ============================================================================

  /**
   * Emit an event to all subscribers
   */
  public async emitEvent(event: BaseEvent): Promise<boolean> {
    // Check for backpressure and handle accordingly
    if (this.eventQueue.isBackpressureActive()) {
      super.emit('backpressure', {
        queueSize: this.eventQueue.size(),
        eventType: event.type,
        priority: event.priority,
      });
    }

    // Try to enqueue the event (handles overflow automatically)
    const enqueued = this.eventQueue.enqueue(event);

    if (!enqueued) {
      // Event was dropped due to overflow
      super.emit('eventDropped', {
        eventType: event.type,
        priority: event.priority,
        queueSize: this.eventQueue.size(),
      });
    }

    // Start processing if not already processing
    if (!this.processing) {
      await this.processQueue();
    }

    // Reflect all dispatched listeners, including filtered and routed
    return this.getAllListenersForEvent(event).length > 0;
  }

  /**
   * Emit an event synchronously (immediate processing)
   */
  public emitSync(event: BaseEvent): boolean {
    const listeners = this.getAllListenersForEvent(event);

    if (listeners.length === 0) {
      return false;
    }

    for (const listener of listeners) {
      try {
        // Call the listener's handleEvent method
        const result = listener.handleEvent(event);

        // Handle async results
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Async error in listener for ${event.type}:`, error);
          });
        }
      } catch (error) {
        console.error(`Error in listener for ${event.type}:`, error);
      }
    }

    return listeners.length > 0;
  }

  /**
   * Emit multiple events in batch
   */
  public async emitBatch(events: BaseEvent[]): Promise<void> {
    let enqueuedCount = 0;
    let droppedCount = 0;

    for (const event of events) {
      const enqueued = this.eventQueue.enqueue(event);
      if (enqueued) {
        enqueuedCount++;
      } else {
        droppedCount++;
      }
    }

    if (droppedCount > 0) {
      super.emit('batchDropped', {
        totalEvents: events.length,
        enqueuedCount,
        droppedCount,
        queueSize: this.eventQueue.size(),
      });
    }

    if (!this.processing && enqueuedCount > 0) {
      await this.processQueue();
    }
  }

  // ============================================================================
  // Queue Processing
  // ============================================================================

  /**
   * Process events from the priority queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.eventQueue.setProcessingState(QueueProcessingState.PROCESSING);

    try {
      if (this.config.enableBatchProcessing) {
        await this.processBatchQueue();
      } else {
        await this.processSequentialQueue();
      }
    } catch (error) {
      this.eventQueue.setProcessingState(QueueProcessingState.ERROR);
      console.error('Error in queue processing:', error);
    } finally {
      this.processing = false;
      this.eventQueue.setProcessingState(QueueProcessingState.IDLE);
    }
  }

  /**
   * Process queue sequentially (one event at a time)
   */
  private async processSequentialQueue(): Promise<void> {
    while (!this.eventQueue.isEmpty()) {
      const queuedEvent = this.eventQueue.dequeue();
      if (queuedEvent) {
        await this.processEvent(queuedEvent.event);
      }
    }
  }

  /**
   * Process queue in batches for better performance
   */
  private async processBatchQueue(): Promise<void> {
    while (!this.eventQueue.isEmpty()) {
      const batch = this.eventQueue.dequeueBatch(this.config.batchSize);
      if (batch.length > 0) {
        await this.processBatch(batch);
      }
    }
  }

  /**
   * Process a batch of events
   */
  private async processBatch(batch: QueuedEvent[]): Promise<void> {
    const batchStartTime = Date.now();

    if (this.config.enableAsync) {
      // Process all events in the batch in parallel
      const promises = batch.map(queuedEvent => this.processEvent(queuedEvent.event));
      await Promise.allSettled(promises);
    } else {
      // Process events sequentially
      for (const queuedEvent of batch) {
        await this.processEvent(queuedEvent.event);
      }
    }

    const batchProcessingTime = Date.now() - batchStartTime;
    super.emit('batchProcessed', {
      batchSize: batch.length,
      processingTime: batchProcessingTime,
      queueSize: this.eventQueue.size(),
    });
  }

  /**
   * Process a single event
   */
  private async processEvent(event: BaseEvent): Promise<void> {
    const listeners = this.getAllListenersForEvent(event);

    if (listeners.length === 0) {
      return;
    }

    const startTime = Date.now();
    let processingSuccessful = true;

    try {
      // Process listeners in parallel if async is enabled
      if (this.config.enableAsync) {
        const promises = listeners.map(listener => this.callListener(listener, event));
        const results = await Promise.allSettled(promises);

        // Check if any listener failed
        processingSuccessful = results.every(result => result.status === 'fulfilled');
      } else {
        // Process listeners sequentially
        for (const listener of listeners) {
          try {
            await this.callListener(listener, event);
          } catch (error) {
            processingSuccessful = false;
            console.error(
              `Error processing event ${event.type} with listener ${listener.getName()}:`,
              error
            );
          }
        }
      }

      const processingTime = Date.now() - startTime;

      // Record metrics
      if (processingSuccessful) {
        this.eventQueue.recordProcessingSuccess(processingTime);
      } else {
        this.eventQueue.recordProcessingFailure();
      }

      // Check for slow processing
      if (processingTime > this.config.maxProcessingTime) {
        console.warn(`Slow event processing: ${event.type} took ${processingTime}ms`);
        super.emit('slowProcessing', {
          eventType: event.type,
          processingTime,
          threshold: this.config.maxProcessingTime,
        });
      }
    } catch (error) {
      processingSuccessful = false;
      this.eventQueue.recordProcessingFailure();
      console.error(`Critical error processing event ${event.type}:`, error);
      super.emit('processingError', {
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============================================================================
  // Event Filtering and Routing
  // ============================================================================

  /**
   * Check if an event matches a filter
   */
  private matchesFilter(event: BaseEvent, filter: EventFilter): boolean {
    // Check event types with wildcard support
    if (filter.types && filter.types.length > 0) {
      const matchesType = filter.types.some(pattern => this.matchesPattern(event.type, pattern));
      if (!matchesType) {
        return false;
      }
    }

    // Check event sources
    if (filter.sources && filter.sources.length > 0) {
      if (!event.source || !filter.sources.includes(event.source)) {
        return false;
      }
    }

    // Check priority range
    if (filter.minPriority !== undefined && event.priority < filter.minPriority) {
      return false;
    }

    if (filter.maxPriority !== undefined && event.priority > filter.maxPriority) {
      return false;
    }

    // Check custom filter
    if (filter.customFilter && !filter.customFilter(event)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a string matches a pattern (supports wildcards)
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // Case-insensitive wildcard match without RegExp to avoid ReDoS.
    const s = text.toLowerCase();
    const p = pattern.toLowerCase();
    let i = 0,
      j = 0,
      star = -1,
      match = 0;
    while (i < s.length) {
      if (j < p.length && (p[j] === '?' || p[j] === s[i])) {
        i++;
        j++;
      } else if (j < p.length && p[j] === '*') {
        star = j++;
        match = i;
      } else if (star !== -1) {
        j = star + 1;
        i = ++match;
      } else {
        return false;
      }
    }
    while (j < p.length && p[j] === '*') j++;
    return j === p.length;
  }

  /**
   * Create an event route for targeted delivery
   */
  public createRoute(filter: EventFilter, priority: number = 0): string {
    const routeId = `route_${++this.routeCounter}`;

    const route: EventRoute = {
      id: routeId,
      filter,
      listeners: new Set(),
      priority,
      active: true,
    };

    this.eventRoutes.set(routeId, route);
    super.emit('routeCreated', routeId, filter);

    return routeId;
  }

  /**
   * Add listener to a route
   */
  public addListenerToRoute(routeId: string, listener: EventListener): boolean {
    const route = this.eventRoutes.get(routeId);
    if (route) {
      route.listeners.add(listener);
      super.emit('listenerAddedToRoute', routeId, listener);
      return true;
    }
    return false;
  }

  /**
   * Remove listener from a route
   */
  public removeListenerFromRoute(routeId: string, listener: EventListener): boolean {
    const route = this.eventRoutes.get(routeId);
    if (route) {
      const removed = route.listeners.delete(listener);
      if (removed) {
        super.emit('listenerRemovedFromRoute', routeId, listener);
      }
      return removed;
    }
    return false;
  }

  /**
   * Activate or deactivate a route
   */
  public setRouteActive(routeId: string, active: boolean): boolean {
    const route = this.eventRoutes.get(routeId);
    if (route) {
      route.active = active;
      super.emit('routeActiveChanged', routeId, active);
      return true;
    }
    return false;
  }

  /**
   * Remove a route
   */
  public removeRoute(routeId: string): boolean {
    const removed = this.eventRoutes.delete(routeId);
    if (removed) {
      super.emit('routeRemoved', routeId);
    }
    return removed;
  }

  /**
   * Filter events by criteria
   */
  public filterEvents(events: BaseEvent[], filter: EventFilter): BaseEvent[] {
    return events.filter(event => this.matchesFilter(event, filter));
  }

  /**
   * Call a listener with error handling
   */
  private async callListener(listener: EventListener, event: BaseEvent): Promise<void> {
    try {
      if (!listener.isListenerActive()) {
        return; // Skip inactive listeners
      }

      const result = listener.handleEvent(event);

      // Handle async results
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error(`Error in listener ${listener.getName()} for event ${event.type}:`, error);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.size();
  }

  /**
   * Check if dispatcher is currently processing events
   */
  public isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Check if backpressure is active
   */
  public isBackpressureActive(): boolean {
    return this.eventQueue.isBackpressureActive();
  }

  /**
   * Get queue metrics
   */
  public getQueueMetrics(): QueueMetrics {
    return this.eventQueue.getMetrics();
  }

  /**
   * Reset queue metrics
   */
  public resetQueueMetrics(): void {
    this.eventQueue.resetMetrics();
  }

  /**
   * Pause queue processing
   */
  public pauseProcessing(): void {
    this.eventQueue.setProcessingState(QueueProcessingState.PAUSED);
  }

  /**
   * Resume queue processing
   */
  public async resumeProcessing(): Promise<void> {
    this.eventQueue.setProcessingState(QueueProcessingState.IDLE);
    if (!this.processing && !this.eventQueue.isEmpty()) {
      await this.processQueue();
    }
  }

  /**
   * Drain the queue (process all pending events)
   */
  public async drainQueue(): Promise<void> {
    this.eventQueue.setProcessingState(QueueProcessingState.DRAINING);
    await this.processQueue();
  }

  /**
   * Clear all pending events from queue
   */
  public clearQueue(): void {
    this.eventQueue.clear();
  }

  /**
   * Clear all listeners
   */
  public clearAllListeners(): void {
    this.listenerRegistry.clear();
  }

  /**
   * Get dispatcher status
   */
  public getStatus(): {
    name: string;
    listenerCount: number;
    queueSize: number;
    isProcessing: boolean;
    filteredSubscriptionCount: number;
    routeCount: number;
    queueMetrics: QueueMetrics;
    backpressureActive: boolean;
  } {
    return {
      name: this.name,
      listenerCount: this.getListenerCount(),
      queueSize: this.getQueueSize(),
      isProcessing: this.isProcessing(),
      filteredSubscriptionCount: this.filteredSubscriptions.size,
      routeCount: this.eventRoutes.size,
      queueMetrics: this.getQueueMetrics(),
      backpressureActive: this.isBackpressureActive(),
    };
  }

  /**
   * Dispose of the dispatcher and clean up resources
   */
  public dispose(): void {
    this.clearQueue();
    this.clearAllListeners();
    this.filteredSubscriptions.clear();
    this.eventRoutes.clear();
    this.removeAllListeners(); // Clear EventEmitter listeners
  }
}
