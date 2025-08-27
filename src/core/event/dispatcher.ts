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
    // Enforce max queue size with priority-aware drop policy
    if (this.eventQueue.size() >= this.config.maxQueueSize) {
      const lowest = this.eventQueue.peekLowest();
      if (!lowest || lowest.priority > event.priority) {
        // Drop incoming low-priority event
        // Reflect all dispatched listeners, including filtered and routed
        return this.getAllListenersForEvent(event).length > 0;
      }
      // Drop current lowest-priority queued event to make room
      this.eventQueue.popLowest();
    }
    this.eventQueue.enqueue(event);

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
    const listeners = this.getAllListenersForEvent(event);

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
  } {
    return {
      name: this.name,
      listenerCount: this.getListenerCount(),
      queueSize: this.getQueueSize(),
      isProcessing: this.isProcessing(),
      filteredSubscriptionCount: this.filteredSubscriptions.size,
      routeCount: this.eventRoutes.size,
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
