import { EventEmitter } from 'events';
import { EventListener, AnyEventCallback, createEventListener } from './listener.js';
import { BaseEvent, EventPriority } from './events.js';
import { clamp } from '../utils/math.js';
import { QueueMetrics, QueueProcessingState } from '../types';

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
// Event Batching Support
// ============================================================================

/**
 * Batch processing strategies
 */
export enum BatchProcessingStrategy {
  /** Process all events in batch sequentially */
  SEQUENTIAL = 'sequential',
  /** Process events in batch in parallel */
  PARALLEL = 'parallel',
  /** Process events in smaller sub-batches */
  CHUNKED = 'chunked',
  /** Process events by priority groups */
  PRIORITY_GROUPED = 'priority-grouped',
}

/**
 * Batch configuration
 */
export interface BatchConfig {
  /** Maximum number of events per batch */
  maxBatchSize: number;
  /** Maximum time to wait before processing batch (ms) */
  maxBatchDelay: number;
  /** Batch processing strategy */
  strategy: BatchProcessingStrategy;
  /** Chunk size for chunked strategy */
  chunkSize?: number;
  /** Enable batch compression for similar events */
  enableCompression?: boolean;
}

/**
 * Event batch container
 */
export interface EventBatch {
  /** Unique batch identifier */
  id: string;
  /** Events in this batch */
  events: BaseEvent[];
  /** Batch creation timestamp */
  createdAt: number;
  /** Batch processing strategy */
  strategy: BatchProcessingStrategy;
  /** Batch metadata */
  metadata: {
    totalEvents: number;
    priorityDistribution: Map<EventPriority, number>;
    sourceDistribution: Map<string, number>;
  };
}

// ============================================================================
// Event Queue with Priority Support
// ============================================================================

/**
 * Strategy for handling queue overflow
 */
export enum QueueOverflowStrategy {
  DROP_INCOMING = 'drop_incoming',
  DROP_OLDEST = 'drop_oldest',
  DROP_LOWEST_PRIORITY = 'drop_lowest_priority',
  REJECT = 'reject',
  BLOCK = 'block',
}

/**
 * Configuration for the EventQueue
 */
export interface EventQueueConfig {
  maxSize: number;
  overflowStrategy: QueueOverflowStrategy;
  batchConfig: BatchConfig;
}

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
 * Enhanced priority-based event queue with batching support
 */
class EventQueue {
  private queue: QueuedEvent[] = [];
  private batchBuffer: QueuedEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchCounter = 0;
  private config: EventQueueConfig;
  private metrics: QueueMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    totalDropped: 0,
  };

  private updateMetrics(): void { /* no-op */ }

  constructor(config: EventQueueConfig) {
    this.config = config;
  }

  /**
   * Add event to queue with automatic priority sorting
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
        // this.updateMetrics(); // updateMetrics is called at the end of enqueue
        return false;
      }

      case QueueOverflowStrategy.DROP_OLDEST: {
        this.queue.shift(); // Remove oldest
        this.insertByPriority(newEvent);
        this.metrics.totalDropped++;
        // this.updateMetrics();
        return true;
      }

      case QueueOverflowStrategy.DROP_LOWEST_PRIORITY: {
        const lowest = this.peekLowest();
        if (lowest && lowest.priority <= newEvent.priority) {
          this.popLowest();
          // Insert directly to avoid re-entering overflow handling
          this.insertByPriority(newEvent);
          this.metrics.totalDropped++;
          // this.updateMetrics();
          return true;
        }
        this.metrics.totalDropped++;
        // this.updateMetrics();
        return false;
      }

      case QueueOverflowStrategy.REJECT: {
        throw new Error(`Queue overflow: maximum size ${this.config.maxSize} exceeded`);
      }

      case QueueOverflowStrategy.BLOCK: {
        // In a real implementation, this would block until space is available
        // For now, we'll just drop the event
        this.metrics.totalDropped++;
        // this.updateMetrics();
        return false;
      }

      default: {
        this.metrics.totalDropped++;
        // this.updateMetrics();
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
   * Dequeue multiple raw queued events for batch processing
   * Note: Prefer using dequeueBatch() which returns an EventBatch.
   */
  public dequeueQueuedEvents(maxSize: number = this.config.batchConfig.maxBatchSize): QueuedEvent[] {
    const batch: QueuedEvent[] = [];
    const actualSize = clamp(maxSize, 0, this.queue.length);

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
    return this.queue.length === 0 && this.batchBuffer.length === 0;
  }

  /**
   * Get current queue size
   */
  public size(): number {
    return this.queue.length + this.batchBuffer.length;
  }

  /**
   * Clear all events from queue
   */
  public clear(): void {
    this.queue = [];
    this.batchBuffer = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Peek lowest-priority (FIFO within same priority)
   */
  public peekLowest(): QueuedEvent | undefined {
    // Check both queue and buffer for lowest priority
    const queueLowest = this.queue[this.queue.length - 1];
    const bufferLowest =
      this.batchBuffer.length > 0
        ? this.batchBuffer.reduce((lowest, current) =>
            current.priority < lowest.priority ? current : lowest
          )
        : undefined;

    if (!queueLowest && !bufferLowest) return undefined;
    if (!queueLowest) return bufferLowest;
    if (!bufferLowest) return queueLowest;

    return queueLowest.priority <= bufferLowest.priority ? queueLowest : bufferLowest;
  }

  /**
   * Remove and return the lowest-priority item
   */
  public popLowest(): QueuedEvent | undefined {
    const queueLowest = this.queue[this.queue.length - 1];
    const bufferLowestIndex =
      this.batchBuffer.length > 0
        ? this.batchBuffer.reduce((lowestIdx, current, idx) => {
            const lowestItem = this.batchBuffer[lowestIdx];
            return lowestItem && current.priority < lowestItem.priority ? idx : lowestIdx;
          }, 0)
        : -1;
    const bufferLowest = bufferLowestIndex >= 0 ? this.batchBuffer[bufferLowestIndex] : undefined;

    if (!queueLowest && !bufferLowest) return undefined;

    if (!queueLowest || (bufferLowest && bufferLowest.priority < queueLowest.priority)) {
      // Remove from buffer
      return this.batchBuffer.splice(bufferLowestIndex, 1)[0];
    } else {
      // Remove from queue
      return this.queue.pop();
    }
  }

  /**
   * Get the next batch of events ready for processing
   */
  public dequeueBatch(): EventBatch | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    const batchSize = clamp(this.config.batchConfig.maxBatchSize, 0, this.queue.length);
    const events = this.queue.splice(0, batchSize).map(qe => qe.event);

    return this.createEventBatch(events);
  }

  /**
   * Force process current batch buffer
   */
  public flushBatchBuffer(): void {
    if (this.batchBuffer.length > 0) {
      this.processBatchBuffer();
    }
  }

  /**
   * Check if batch should be processed
   */
  private shouldProcessBatch(): boolean {
    return this.batchBuffer.length >= this.config.batchConfig.maxBatchSize;
  }

  /**
   * Start batch timer for delayed processing
   */
  private startBatchTimer(): void {
    this.batchTimer = setTimeout(() => {
      this.processBatchBuffer();
      this.batchTimer = null;
    }, this.config.batchConfig.maxBatchDelay);
  }

  /**
   * Process events from batch buffer into main queue
   */
  private processBatchBuffer(): void {
    if (this.batchBuffer.length === 0) return;

    // Sort batch buffer by priority
    this.batchBuffer.sort((a, b) => b.priority - a.priority);

    // Compress similar events if enabled
    const eventsToProcess = this.config.batchConfig.enableCompression
      ? this.compressEvents(this.batchBuffer)
      : this.batchBuffer;

    // Add to main queue maintaining priority order
    for (const queuedEvent of eventsToProcess) {
      this.insertIntoMainQueue(queuedEvent);
    }

    // Clear batch buffer
    this.batchBuffer = [];

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Insert event into main queue maintaining priority order
   */
  private insertIntoMainQueue(queuedEvent: QueuedEvent): void {
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
   * Compress similar events in batch (basic deduplication)
   */
  private compressEvents(queuedEvents: QueuedEvent[]): QueuedEvent[] {
    const eventMap = new Map<string, QueuedEvent>();

    for (const queuedEvent of queuedEvents) {
      const key = `${queuedEvent.event.type}_${queuedEvent.event.source || 'unknown'}`;
      const existing = eventMap.get(key);

      if (!existing || queuedEvent.priority > existing.priority) {
        eventMap.set(key, queuedEvent);
      }
    }

    return Array.from(eventMap.values());
  }

  /**
   * Create event batch with metadata
   */
  private createEventBatch(events: BaseEvent[]): EventBatch {
    const priorityDistribution = new Map<EventPriority, number>();
    const sourceDistribution = new Map<string, number>();

    for (const event of events) {
      // Count priorities
      const currentPriorityCount = priorityDistribution.get(event.priority) || 0;
      priorityDistribution.set(event.priority, currentPriorityCount + 1);

      // Count sources
      const source = event.source || 'unknown';
      const currentSourceCount = sourceDistribution.get(source) || 0;
      sourceDistribution.set(source, currentSourceCount + 1);
    }

    return {
      id: `batch_${++this.batchCounter}`,
      events,
      createdAt: Date.now(),
      strategy: this.config.batchConfig.strategy,
      metadata: {
        totalEvents: events.length,
        priorityDistribution,
        sourceDistribution,
      },
    };
  }

  public recordProcessingSuccess(processingTime: number): void {
    this.metrics.totalProcessed++;
    this.metrics.averageProcessingTime = (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + processingTime) / this.metrics.totalProcessed;
  }

  public recordProcessingFailure(): void {
    this.metrics.totalFailed++;
  }

  public isBackpressureActive(): boolean {
    return this.queue.length > this.config.batchConfig.maxBatchSize;
  }

  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      totalDropped: 0,
    };
  }

  public setProcessingState(state: QueueProcessingState): void {
    // Placeholder implementation for setting processing state
    console.log(`Processing state set to ${state}`);
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
  /** Batch processing configuration */
  batch?: BatchConfig;
  /** Queue overflow strategy */
  overflowStrategy?: QueueOverflowStrategy;
}

/**
 * Default batch configuration
 */
const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 50,
  maxBatchDelay: 100,
  strategy: BatchProcessingStrategy.PARALLEL,
  chunkSize: 10,
  enableCompression: true,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<EventDispatcherConfig> = {
  maxQueueSize: 1000,
  enableAsync: true,
  maxProcessingTime: 5000,
  batch: DEFAULT_BATCH_CONFIG,
  overflowStrategy: QueueOverflowStrategy.DROP_INCOMING,
};

// ============================================================================
// Event Persistence Interfaces & Utilities
// ============================================================================

/**
 * Interface for event storage backends (in-memory, file, DB, etc.)
 */
export interface EventStorage {
  /** Persist a single event */
  saveEvent(event: BaseEvent): Promise<void>;
  /** Persist a batch of events */
  saveEvents(events: BaseEvent[]): Promise<void>;
  /** Retrieve all events (optionally filtered) */
  getEvents(filter?: Partial<BaseEvent>): Promise<BaseEvent[]>;
  /** Clear all stored events */
  clear(): Promise<void>;
}

/**
 * In-memory event storage (default)
 */
export class InMemoryEventStorage implements EventStorage {
  private history: BaseEvent[] = [];

  async saveEvent(event: BaseEvent): Promise<void> {
    this.history.push(event);
  }
  async saveEvents(events: BaseEvent[]): Promise<void> {
    this.history.push(...events);
  }
  async getEvents(filter?: Partial<BaseEvent>): Promise<BaseEvent[]> {
    if (!filter) return [...this.history];
    return this.history.filter(e => {
      for (const key in filter) {
        if ((e as any)[key] !== (filter as any)[key]) return false;
      }
      return true;
    });
  }
  async clear(): Promise<void> {
    this.history = [];
  }
}

/**
 * Event serialization utility
 */
export function serializeEvent(event: BaseEvent): string {
  return JSON.stringify(event);
}

/**
 * Event deserialization utility
 */
export function deserializeEvent(json: string): BaseEvent {
  return JSON.parse(json);
}

// ============================================================================
// Core EventDispatcher Class
// ============================================================================

/**
 * Central event dispatcher with subscription management and priority queuing
 */
export class EventDispatcher extends EventEmitter {
  private readonly listenerRegistry = new Map<string, Set<EventListener>>();
  private readonly handlerToListenerMap = new Map<string, Map<AnyEventCallback, EventListener>>();
  private readonly config: Required<EventDispatcherConfig>;
  private readonly eventQueue: EventQueue;
  private processing = false;
  private processingLock: Promise<void> | null = null;
  private _isReady = false;

  // Event filtering and routing
  private readonly filteredSubscriptions = new Map<string, FilteredSubscription>();
  private readonly eventRoutes = new Map<string, EventRoute>();
  private subscriptionCounter = 0;
  private routeCounter = 0;

  // Event persistence
  private readonly eventStorage: EventStorage;
  private readonly enablePersistence: boolean;

  constructor(
    public readonly name: string = 'EventDispatcher',
    config: EventDispatcherConfig = {},
    eventStorage?: EventStorage,
    enablePersistence: boolean = true
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    const eventQueueConfig: EventQueueConfig = {
      maxSize: this.config.maxQueueSize,
      overflowStrategy: this.config.overflowStrategy,
      batchConfig: this.config.batch,
    };
    this.eventQueue = new EventQueue(eventQueueConfig);
    this.eventStorage = eventStorage || new InMemoryEventStorage();
    this.enablePersistence = enablePersistence;
  }

  /**
   * Mark the dispatcher as ready to process events.
   */
  public markAsReady(): void {
    this._isReady = true;
    super.emit('dispatcherReady', this.name);
  }

  /**
   * Check if the dispatcher is ready to process events.
   */
  public isReady(): boolean {
    return this._isReady;
  }

  // ============================================================================
  // Subscription Management (with weak references)
  // ============================================================================

  /**
   * Subscribe a listener to specific event types
   */
  public subscribe(eventType: string, handler: AnyEventCallback): void {
    if (!this.listenerRegistry.has(eventType)) {
      this.listenerRegistry.set(eventType, new Set());
      this.handlerToListenerMap.set(eventType, new Map());
    }

    // Short-circuit if the handler is already registered for this eventType
    if (this.handlerToListenerMap.get(eventType)!.has(handler)) {
      return;
    }

    const listener = createEventListener(`event-${eventType}-handler`, handler);
    this.listenerRegistry.get(eventType)!.add(listener);
    this.handlerToListenerMap.get(eventType)!.set(handler, listener);
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
  public once(eventType: string, handler: AnyEventCallback): void {
    const onceHandler: AnyEventCallback = async (event) => {
      await handler(event);
      this.unsubscribe(eventType, onceHandler);
    };
    this.subscribe(eventType, onceHandler);
  }
    for (const eventType of eventTypes) {
      this.subscribe(eventType, listener);
    }
  }

  /**
   * Unsubscribe a listener from specific event types
   */
  public unsubscribe(eventType: string, handler: AnyEventCallback): void {
    const listeners = this.listenerRegistry.get(eventType);
    const handlerMap = this.handlerToListenerMap.get(eventType);

    if (listeners && handlerMap) {
      const listenerToRemove = handlerMap.get(handler);
      if (listenerToRemove) {
        listeners.delete(listenerToRemove);
        handlerMap.delete(handler);
        if (listeners.size === 0) {
          this.listenerRegistry.delete(eventType);
          this.handlerToListenerMap.delete(eventType);
        }
        super.emit('listenerRemoved', eventType, listenerToRemove);
      }
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
   * Emit an event to all subscribers (with persistence)
   */
  public async emitEvent(event: BaseEvent): Promise<boolean> {
    if (!this._isReady) {
      throw new Error(
        `EventDispatcher '${this.name}' is not ready to emit events. Call markAsReady() first.`
      );
    }

    // Persist event if enabled
    if (this.enablePersistence) {
      await this.eventStorage.saveEvent(event);
    }

    // Enforce max queue size with priority-aware drop policy
    if (this.eventQueue.size() >= this.config.maxQueueSize) {
      const lowest = this.eventQueue.peekLowest();
      if (!lowest || lowest.priority > event.priority) {
        return this.getAllListenersForEvent(event).length > 0;
      }
      this.eventQueue.popLowest();
    }

    // Start processing if not already processing
    if (!this.processingLock) {
      this.processingLock = this.processQueue().finally(() => {
        this.processingLock = null;
      });
    }

    await this.processingLock;

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
   * Emit multiple events in batch (with persistence)
   */
  public async emitBatch(events: BaseEvent[]): Promise<void> {
    let enqueuedCount = 0,
      droppedCount = 0;

    if (this.enablePersistence) {
      await this.eventStorage.saveEvents(events);
    }
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

  /**
   * Get all persisted events (optionally filtered)
   */
  public async getEventHistory(filter?: Partial<BaseEvent>): Promise<BaseEvent[]> {
    return this.eventStorage.getEvents(filter);
  }

  /**
   * Replay persisted events to listeners (for debugging or recovery)
   */
  public async replayEvents(filter?: Partial<BaseEvent>): Promise<void> {
    const events = await this.getEventHistory(filter);
    for (const event of events) {
      this.emitSync(event);
    }
  }

  /**
   * Clear persisted event history
   */
  public async clearEventHistory(): Promise<void> {
    await this.eventStorage.clear();
  }

  /**
   * Process events using batch delivery
   */
  public async processBatch(batch: EventBatch): Promise<void> {
    const { events, strategy } = batch;

    switch (strategy) {
      case BatchProcessingStrategy.SEQUENTIAL:
        await this.processBatchSequentially(events);
        break;
      case BatchProcessingStrategy.PARALLEL:
        await this.processBatchInParallel(events);
        break;
      case BatchProcessingStrategy.CHUNKED:
        await this.processBatchInChunks(events, this.config.batch.chunkSize || 10);
        break;
      case BatchProcessingStrategy.PRIORITY_GROUPED:
        await this.processBatchByPriorityGroups(events);
        break;
      default:
        await this.processBatchInParallel(events);
    }
  }

  /**
   * Process batch events sequentially
   */
  private async processBatchSequentially(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  /**
   * Process batch events in parallel
   */
  private async processBatchInParallel(events: BaseEvent[]): Promise<void> {
    const promises = events.map(event => this.processEvent(event));
    await Promise.allSettled(promises);
  }

  /**
   * Process batch events in chunks
   */
  private async processBatchInChunks(events: BaseEvent[], chunkSize: number): Promise<void> {
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      const promises = chunk.map(event => this.processEvent(event));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Process batch events grouped by priority
   */
  private async processBatchByPriorityGroups(events: BaseEvent[]): Promise<void> {
    // Group events by priority
    const priorityGroups = new Map<EventPriority, BaseEvent[]>();

    for (const event of events) {
      if (!priorityGroups.has(event.priority)) {
        priorityGroups.set(event.priority, []);
      }
      priorityGroups.get(event.priority)!.push(event);
    }

    // Process groups in priority order (highest first)
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => b - a);

    for (const priority of sortedPriorities) {
      const groupEvents = priorityGroups.get(priority)!;
      await this.processBatchInParallel(groupEvents);
    }
  }

  /**
   * Force flush current batch buffer
   */
  public flushBatch(): void {
    this.eventQueue.flushBatchBuffer();
  }

  /**
   * Get current batch configuration
   */
  public getBatchConfig(): BatchConfig {
    return this.config.batch;
  }

  /**
   * Update batch configuration
   */
  public updateBatchConfig(newConfig: Partial<BatchConfig>): void {
    Object.assign(this.config.batch, newConfig);
  }

  // ============================================================================
  // Queue Processing
  // ============================================================================

  /**
   * Process events from the priority queue with batch support
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      // Check if we should process in batches
      if (this.config.batch.maxBatchSize > 1 && this.eventQueue.size() > 1) {
        await this.processInBatches();
      } else {
        // Process individual events
        while (!this.eventQueue.isEmpty()) {
          const queuedEvent = this.eventQueue.dequeue();
          if (queuedEvent) {
            await this.processEvent(queuedEvent.event);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process events in batches
   */
  private async processInBatches(): Promise<void> {
    while (!this.eventQueue.isEmpty()) {
      const batch = this.eventQueue.dequeueBatch();
      if (batch) {
        await this.processBatch(batch);
      }
    }
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

  public pauseProcessing(): void {
    this.eventQueue.setProcessingState(QueueProcessingState.PAUSED);
  }

  public async resumeProcessing(): Promise<void> {
    this.eventQueue.setProcessingState(QueueProcessingState.IDLE);
    if (!this.processing && !this.eventQueue.isEmpty()) {
      await this.processQueue();
    }
  }

  public async drainQueue(): Promise<void> {
    this.eventQueue.setProcessingState(QueueProcessingState.DRAINING);
    await this.processQueue();
  }

  public clearQueue(): void {
    this.eventQueue.clear();
  }

  public clearAllListeners(): void {
    this.listenerRegistry.clear();
  }

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

/**
 * Metrics for the event queue
 */
export interface QueueMetrics {
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
}

/**
 * States for queue processing
 */
export enum QueueProcessingState {
  PAUSED = 'paused',
  IDLE = 'idle',
  DRAINING = 'draining',
}
