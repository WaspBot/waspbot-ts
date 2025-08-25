/**
 * @fileoverview Core EventDispatcher class for WaspBot-TS
 * Implements subscription management, emit methods, and priority queue support
 */

import { EventEmitter } from 'events';
import { EventListener } from './listener.js';
import { BaseEvent, EventPriority } from './events.js';

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
}

/**
 * Priority-based event queue
 */
class EventQueue {
  private queue: QueuedEvent[] = [];

  /**
   * Add event to queue with automatic priority sorting
   */
  public enqueue(event: BaseEvent): void {
    const queuedEvent: QueuedEvent = {
      event,
      priority: event.priority,
      timestamp: Date.now(),
    };

    // Insert in priority order (highest priority first)
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
   * Remove and return the highest priority event
   */
  public dequeue(): QueuedEvent | undefined {
    return this.queue.shift();
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
    return this.queue.pop();
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
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<EventDispatcherConfig> = {
  maxQueueSize: 1000,
  enableAsync: true,
  maxProcessingTime: 5000,
};

// ============================================================================
// Core EventDispatcher Class
// ============================================================================

/**
 * Central event dispatcher with subscription management and priority queuing
 */
export class EventDispatcher extends EventEmitter {
  private readonly listenerRegistry = new Map<string, Set<EventListener>>();
  private readonly eventQueue = new EventQueue();
  private readonly config: Required<EventDispatcherConfig>;
  private processing = false;

  constructor(
    public readonly name: string = 'EventDispatcher',
    config: EventDispatcherConfig = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
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
    // Enforce max queue size with priority-aware drop policy
    if (this.eventQueue.size() >= this.config.maxQueueSize) {
      const lowest = this.eventQueue.peekLowest();
      if (!lowest || lowest.priority > event.priority) {
        // Drop incoming low-priority event
        return this.hasListeners(event.type);
      }
      // Drop current lowest-priority queued event to make room
      this.eventQueue.popLowest();
    }
    this.eventQueue.enqueue(event);

    if (!this.processing) {
      await this.processQueue();
    }
    return this.hasListeners(event.type);
  }

  /**
   * Emit an event synchronously (immediate processing)
   */
  public emitSync(event: BaseEvent): boolean {
    const listeners = this.getListeners(event.type);

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

    return true;
  }

  /**
   * Emit multiple events in batch
   */
  public async emitBatch(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      if (this.eventQueue.size() >= this.config.maxQueueSize) {
        const lowest = this.eventQueue.peekLowest();
        if (lowest && lowest.priority <= event.priority) {
          this.eventQueue.popLowest();
          this.eventQueue.enqueue(event);
        } else {
          // drop incoming if it's not higher priority
          continue;
        }
      } else {
        this.eventQueue.enqueue(event);
      }
    }
    if (!this.processing) {
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

    try {
      while (!this.eventQueue.isEmpty()) {
        const queuedEvent = this.eventQueue.dequeue();
        if (queuedEvent) {
          await this.processEvent(queuedEvent.event);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: BaseEvent): Promise<void> {
    const listeners = this.getListeners(event.type);

    if (listeners.length === 0) {
      return;
    }

    const startTime = Date.now();

    // Process listeners in parallel if async is enabled
    if (this.config.enableAsync) {
      const promises = listeners.map(listener => this.callListener(listener, event));
      await Promise.allSettled(promises);
    } else {
      // Process listeners sequentially
      for (const listener of listeners) {
        await this.callListener(listener, event);
      }
    }

    // Check for slow processing
    const processingTime = Date.now() - startTime;
    if (processingTime > this.config.maxProcessingTime) {
      console.warn(`Slow event processing: ${event.type} took ${processingTime}ms`);
    }
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
  } {
    return {
      name: this.name,
      listenerCount: this.getListenerCount(),
      queueSize: this.getQueueSize(),
      isProcessing: this.isProcessing(),
    };
  }

  /**
   * Dispose of the dispatcher and clean up resources
   */
  public dispose(): void {
    this.clearQueue();
    this.clearAllListeners();
    this.removeAllListeners(); // Clear EventEmitter listeners
  }
}
