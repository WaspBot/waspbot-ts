/**
 * @fileoverview Event Listener Infrastructure for WaspBot-TS
 * Implements EventListener abstract base class and callback type definitions
 */

import { BaseEvent } from './events.js';

// ============================================================================
// Event Callback Type Definitions
// ============================================================================

/**
 * Standard event callback function signature
 */
export type EventCallback<T extends BaseEvent = BaseEvent> = (event: T) => void;

/**
 * Async event callback function signature for long-running operations
 */
export type AsyncEventCallback<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void>;

/**
 * Error callback for handling event processing errors
 */
export type ErrorCallback = (error: Error, event?: BaseEvent) => void;

/**
 * Union type for all event callback functions
 */
export type AnyEventCallback<T extends BaseEvent = BaseEvent> =
  | EventCallback<T>
  | AsyncEventCallback<T>;

// ============================================================================
// EventListener Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all event listeners in the system.
 * Provides foundation for event handling with memory management and validation.
 */
export abstract class EventListener {
  protected readonly id: string;
  protected readonly name: string;
  protected isActive: boolean = false;
  protected errorHandler: ErrorCallback | undefined;

  // Weak reference support for memory management
  private static readonly listenerRegistry = new WeakSet<EventListener>();

  constructor(name: string, errorHandler?: ErrorCallback) {
    this.id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.errorHandler = errorHandler;

    // Register in weak set for memory management
    EventListener.listenerRegistry.add(this);

    this.validateListener();
  }

  /**
   * Abstract method that must be implemented by concrete listeners
   */
  public abstract handleEvent(event: BaseEvent): void | Promise<void>;

  /**
   * Get listener unique identifier
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get listener name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Check if listener is currently active
   */
  public isListenerActive(): boolean {
    return this.isActive;
  }

  /**
   * Activate the listener
   */
  public activate(): void {
    this.isActive = true;
  }

  /**
   * Deactivate the listener
   */
  public deactivate(): void {
    this.isActive = false;
  }

  /**
   * Set error handler for this listener
   */
  public setErrorHandler(errorHandler: ErrorCallback): void {
    this.errorHandler = errorHandler;
  }

  /**
   * Handle errors that occur during event processing
   */
  protected handleError(error: Error, event?: BaseEvent): void {
    if (this.errorHandler) {
      try {
        this.errorHandler(error, event);
      } catch (handlerError) {
        console.error(`Error in error handler for listener ${this.name}:`, handlerError);
      }
    } else {
      console.error(`Unhandled error in listener ${this.name}:`, error);
    }
  }

  /**
   * Validate listener configuration and state
   */
  protected validateListener(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('EventListener name cannot be empty');
    }

    if (typeof this.handleEvent !== 'function') {
      throw new Error('EventListener must implement handleEvent method');
    }
  }

  /**
   * Clean up resources when listener is no longer needed
   */
  public dispose(): void {
    this.deactivate();
    this.errorHandler = undefined;
  }

  /**
   * Check if listener registry contains this listener (weak reference check)
   */
  public static hasListener(listener: EventListener): boolean {
    return EventListener.listenerRegistry.has(listener);
  }
}

// ============================================================================
// Concrete EventListener Implementations
// ============================================================================

/**
 * Function-based event listener for simple callback handling
 */
export class FunctionEventListener extends EventListener {
  private readonly callback: AnyEventCallback;

  constructor(name: string, callback: AnyEventCallback, errorHandler?: ErrorCallback) {
    super(name, errorHandler);
    this.callback = callback;
    this.validateCallback();
  }

  public async handleEvent(event: BaseEvent): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      const result = this.callback(event);

      // Handle async callbacks
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      this.handleError(error as Error, event);
    }
  }

  private validateCallback(): void {
    if (typeof this.callback !== 'function') {
      throw new Error('EventCallback must be a function');
    }
  }
}

/**
 * Event listener that provides additional source information
 */
export class SourceInfoEventListener extends EventListener {
  private readonly callback: (event: BaseEvent, source: string) => void | Promise<void>;

  constructor(
    name: string,
    callback: (event: BaseEvent, source: string) => void | Promise<void>,
    errorHandler?: ErrorCallback
  ) {
    super(name, errorHandler);
    this.callback = callback;
    this.validateCallback();
  }

  public async handleEvent(event: BaseEvent): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      const source = event.source || 'unknown';
      const result = this.callback(event, source);

      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      this.handleError(error as Error, event);
    }
  }

  private validateCallback(): void {
    if (typeof this.callback !== 'function') {
      throw new Error('SourceInfoEventCallback must be a function');
    }
  }
}

// ============================================================================
// Event Listener Validation and Error Handling
// ============================================================================

/**
 * Validates event listener configuration
 */
export function validateEventListener(listener: EventListener): boolean {
  try {
    if (!listener) {
      return false;
    }

    if (!EventListener.hasListener(listener)) {
      return false;
    }

    if (typeof listener.handleEvent !== 'function') {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating event listener:', error);
    return false;
  }
}

/**
 * Creates a safe wrapper around event callbacks to handle errors
 */
export function createSafeEventCallback<T extends BaseEvent>(
  callback: AnyEventCallback<T>,
  errorHandler?: ErrorCallback
): EventCallback<T> {
  return (event: T) => {
    try {
      const result = callback(event);

      // Handle async callbacks with error catching
      if (result instanceof Promise) {
        result.catch(error => {
          if (errorHandler) {
            errorHandler(error, event);
          } else {
            console.error('Unhandled async error in event callback:', error);
          }
        });
      }
    } catch (error) {
      if (errorHandler) {
        errorHandler(error as Error, event);
      } else {
        console.error('Unhandled error in event callback:', error);
      }
    }
  };
}

/**
 * Factory function to create function-based event listeners
 */
export function createEventListener(
  name: string,
  callback: AnyEventCallback,
  errorHandler?: ErrorCallback
): FunctionEventListener {
  return new FunctionEventListener(name, callback, errorHandler);
}

/**
 * Factory function to create source-info event listeners
 */
export function createSourceInfoEventListener(
  name: string,
  callback: (event: BaseEvent, source: string) => void | Promise<void>,
  errorHandler?: ErrorCallback
): SourceInfoEventListener {
  return new SourceInfoEventListener(name, callback, errorHandler);
}
