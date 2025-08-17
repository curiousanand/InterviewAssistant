import {
  IWebSocketEventEmitter,
  WebSocketEvent,
  WebSocketEventType,
  WebSocketEventListener
} from '../interfaces/IWebSocketClient';

/**
 * Type-safe WebSocket event system
 * 
 * Why: Provides strongly typed event handling for WebSocket communication
 * Pattern: Observer Pattern - enables reactive UI updates and loose coupling
 * Rationale: Centralizes event management with type safety and subscription control
 */

/**
 * Typed event map for WebSocket events
 */
export interface WebSocketEventMap {
  [WebSocketEventType.CONNECTING]: WebSocketConnectingEvent;
  [WebSocketEventType.CONNECTED]: WebSocketConnectedEvent;
  [WebSocketEventType.DISCONNECTED]: WebSocketDisconnectedEvent;
  [WebSocketEventType.RECONNECTING]: WebSocketReconnectingEvent;
  [WebSocketEventType.RECONNECTED]: WebSocketReconnectedEvent;
  [WebSocketEventType.ERROR]: WebSocketErrorEvent;
  [WebSocketEventType.MESSAGE]: WebSocketMessageEvent;
  [WebSocketEventType.TEXT_MESSAGE]: WebSocketTextMessageEvent;
  [WebSocketEventType.BINARY_MESSAGE]: WebSocketBinaryMessageEvent;
  [WebSocketEventType.JSON_MESSAGE]: WebSocketJSONMessageEvent;
  [WebSocketEventType.PING]: WebSocketPingEvent;
  [WebSocketEventType.PONG]: WebSocketPongEvent;
  [WebSocketEventType.STATE_CHANGE]: WebSocketStateChangeEvent;
}

/**
 * Specific event types with their data structures
 */
export interface WebSocketConnectingEvent extends WebSocketEvent {
  type: WebSocketEventType.CONNECTING;
  data?: {
    url: string;
    attempt?: number;
  };
}

export interface WebSocketConnectedEvent extends WebSocketEvent {
  type: WebSocketEventType.CONNECTED;
  data?: {
    url: string;
    protocols?: string[];
    extensions?: string[];
  };
}

export interface WebSocketDisconnectedEvent extends WebSocketEvent {
  type: WebSocketEventType.DISCONNECTED;
  data?: {
    code: number;
    reason: string;
    wasClean: boolean;
    duration?: number; // Connection duration in ms
  };
}

export interface WebSocketReconnectingEvent extends WebSocketEvent {
  type: WebSocketEventType.RECONNECTING;
  data: {
    attempt: number;
    delay: number;
    maxAttempts: number;
    lastError?: any;
  };
}

export interface WebSocketReconnectedEvent extends WebSocketEvent {
  type: WebSocketEventType.RECONNECTED;
  data: {
    attempt: number;
    totalDowntime: number; // Downtime in ms
  };
}

export interface WebSocketErrorEvent extends WebSocketEvent {
  type: WebSocketEventType.ERROR;
  error: {
    type: string;
    message: string;
    code?: number;
    recoverable: boolean;
    retryable: boolean;
  };
}

export interface WebSocketMessageEvent extends WebSocketEvent {
  type: WebSocketEventType.MESSAGE;
  data: {
    type: 'text' | 'binary' | 'json';
    data: any;
    size: number;
  };
}

export interface WebSocketTextMessageEvent extends WebSocketEvent {
  type: WebSocketEventType.TEXT_MESSAGE;
  data: string;
}

export interface WebSocketBinaryMessageEvent extends WebSocketEvent {
  type: WebSocketEventType.BINARY_MESSAGE;
  data: ArrayBuffer;
}

export interface WebSocketJSONMessageEvent extends WebSocketEvent {
  type: WebSocketEventType.JSON_MESSAGE;
  data: any;
}

export interface WebSocketPingEvent extends WebSocketEvent {
  type: WebSocketEventType.PING;
  data?: {
    timestamp: number;
  };
}

export interface WebSocketPongEvent extends WebSocketEvent {
  type: WebSocketEventType.PONG;
  data?: {
    latency: number;
    timestamp: number;
  };
}

export interface WebSocketStateChangeEvent extends WebSocketEvent {
  type: WebSocketEventType.STATE_CHANGE;
  data: {
    oldState: string;
    newState: string;
  };
}

/**
 * Typed event listener definitions
 */
export type TypedWebSocketEventListener<T extends WebSocketEventType> = (
  event: WebSocketEventMap[T]
) => void;

/**
 * Event subscription interface
 */
export interface WebSocketEventSubscription {
  unsubscribe(): void;
  isActive(): boolean;
  getEventType(): WebSocketEventType;
  getListenerCount(): number;
}

/**
 * Event filter interface
 */
export interface WebSocketEventFilter<T extends WebSocketEventType = WebSocketEventType> {
  /**
   * Check if event should be processed
   */
  shouldProcess(event: WebSocketEventMap[T]): boolean;
  
  /**
   * Transform event data before processing
   */
  transform?(event: WebSocketEventMap[T]): WebSocketEventMap[T];
  
  /**
   * Get filter description
   */
  getDescription(): string;
}

/**
 * Event middleware interface
 */
export interface WebSocketEventMiddleware {
  /**
   * Process event before listeners
   */
  beforeEmit?(event: WebSocketEvent): WebSocketEvent | null;
  
  /**
   * Process event after listeners
   */
  afterEmit?(event: WebSocketEvent, results: any[]): void;
  
  /**
   * Handle listener errors
   */
  onError?(error: Error, event: WebSocketEvent, listener: WebSocketEventListener): void;
  
  /**
   * Get middleware name
   */
  getName(): string;
}

/**
 * Enhanced WebSocket event emitter with type safety
 */
export class TypedWebSocketEventEmitter implements IWebSocketEventEmitter {
  private listeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
  private onceListeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
  private filters: Map<WebSocketEventType, Set<WebSocketEventFilter>> = new Map();
  private middleware: WebSocketEventMiddleware[] = [];
  private statistics: EventEmitterStatistics = this.initializeStatistics();
  private isEmitting: boolean = false;
  private eventQueue: WebSocketEvent[] = [];
  private maxListeners: number = 100;
  private enableLogging: boolean = false;

  constructor(options?: EventEmitterOptions) {
    if (options) {
      this.maxListeners = options.maxListeners || this.maxListeners;
      this.enableLogging = options.enableLogging || false;
    }

    // Initialize listener maps
    Object.values(WebSocketEventType).forEach(eventType => {
      this.listeners.set(eventType, new Set());
      this.onceListeners.set(eventType, new Set());
      this.filters.set(eventType, new Set());
    });
  }

  /**
   * Emit event to all listeners with type safety
   */
  emit(event: WebSocketEvent): void {
    try {
      // Apply middleware preprocessing
      const processedEvent = this.applyBeforeMiddleware(event);
      if (!processedEvent) {
        return; // Event was filtered out by middleware
      }

      // Queue event if already emitting (prevent recursion)
      if (this.isEmitting) {
        this.eventQueue.push(processedEvent);
        return;
      }

      this.isEmitting = true;
      this.emitEvent(processedEvent);
      
      // Process queued events
      while (this.eventQueue.length > 0) {
        const queuedEvent = this.eventQueue.shift();
        if (queuedEvent) {
          this.emitEvent(queuedEvent);
        }
      }

    } finally {
      this.isEmitting = false;
    }
  }

  /**
   * Add typed event listener
   */
  on<T extends WebSocketEventType>(
    type: T,
    listener: TypedWebSocketEventListener<T>
  ): WebSocketEventSubscription {
    return this.addEventListener(type, listener as WebSocketEventListener, false);
  }

  /**
   * Add one-time typed event listener
   */
  once<T extends WebSocketEventType>(
    type: T,
    listener: TypedWebSocketEventListener<T>
  ): WebSocketEventSubscription {
    return this.addEventListener(type, listener as WebSocketEventListener, true);
  }

  /**
   * Remove typed event listener
   */
  off<T extends WebSocketEventType>(
    type: T,
    listener: TypedWebSocketEventListener<T>
  ): void {
    this.removeEventListener(type, listener as WebSocketEventListener);
  }

  /**
   * Add event listener (implements IWebSocketEventEmitter)
   */
  addEventListener(
    event: WebSocketEventType,
    listener: WebSocketEventListener
  ): void {
    this.addListener(event, listener, false);
  }

  /**
   * Remove event listener (implements IWebSocketEventEmitter)
   */
  removeEventListener(
    event: WebSocketEventType,
    listener: WebSocketEventListener
  ): void {
    const listeners = this.listeners.get(event);
    const onceListeners = this.onceListeners.get(event);
    
    if (listeners) {
      listeners.delete(listener);
    }
    
    if (onceListeners) {
      onceListeners.delete(listener);
    }
    
    this.statistics.totalListenersRemoved++;
    this.log('debug', `Removed listener for ${event}`);
  }

  /**
   * Remove all listeners for event type
   */
  removeAllListeners(type?: WebSocketEventType): void {
    if (type) {
      const listeners = this.listeners.get(type);
      const onceListeners = this.onceListeners.get(type);
      
      if (listeners) {
        this.statistics.totalListenersRemoved += listeners.size;
        listeners.clear();
      }
      
      if (onceListeners) {
        this.statistics.totalListenersRemoved += onceListeners.size;
        onceListeners.clear();
      }
      
      this.log('debug', `Removed all listeners for ${type}`);
    } else {
      // Remove all listeners for all event types
      this.listeners.forEach((listeners, eventType) => {
        this.statistics.totalListenersRemoved += listeners.size;
        listeners.clear();
      });
      
      this.onceListeners.forEach((listeners, eventType) => {
        this.statistics.totalListenersRemoved += listeners.size;
        listeners.clear();
      });
      
      this.log('debug', 'Removed all listeners for all event types');
    }
  }

  /**
   * Get listener count for event type
   */
  listenerCount(type: WebSocketEventType): number {
    const listeners = this.listeners.get(type);
    const onceListeners = this.onceListeners.get(type);
    
    return (listeners?.size || 0) + (onceListeners?.size || 0);
  }

  /**
   * Add event filter
   */
  addFilter<T extends WebSocketEventType>(
    type: T,
    filter: WebSocketEventFilter<T>
  ): void {
    const filters = this.filters.get(type);
    if (filters) {
      filters.add(filter as WebSocketEventFilter);
      this.log('debug', `Added filter for ${type}: ${filter.getDescription()}`);
    }
  }

  /**
   * Remove event filter
   */
  removeFilter<T extends WebSocketEventType>(
    type: T,
    filter: WebSocketEventFilter<T>
  ): void {
    const filters = this.filters.get(type);
    if (filters) {
      filters.delete(filter as WebSocketEventFilter);
      this.log('debug', `Removed filter for ${type}: ${filter.getDescription()}`);
    }
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: WebSocketEventMiddleware): void {
    this.middleware.push(middleware);
    this.log('debug', `Added middleware: ${middleware.getName()}`);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware: WebSocketEventMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
      this.log('debug', `Removed middleware: ${middleware.getName()}`);
    }
  }

  /**
   * Wait for specific event
   */
  waitFor<T extends WebSocketEventType>(
    type: T,
    timeout?: number,
    filter?: (event: WebSocketEventMap[T]) => boolean
  ): Promise<WebSocketEventMap[T]> {
    return new Promise((resolve, reject) => {
      let timeoutId: number | null = null;
      
      const listener = (event: WebSocketEventMap[T]) => {
        if (!filter || filter(event)) {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          resolve(event);
        }
      };
      
      // Set timeout if specified
      if (timeout && timeout > 0) {
        timeoutId = window.setTimeout(() => {
          this.off(type, listener);
          reject(new Error(`Timeout waiting for ${type} event after ${timeout}ms`));
        }, timeout);
      }
      
      this.once(type, listener);
    });
  }

  /**
   * Create event stream
   */
  createStream<T extends WebSocketEventType>(
    type: T,
    filter?: WebSocketEventFilter<T>
  ): WebSocketEventStream<T> {
    return new WebSocketEventStream(this, type, filter);
  }

  /**
   * Get event emitter statistics
   */
  getStatistics(): EventEmitterStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Enable/disable logging
   */
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  /**
   * Set maximum listeners per event type
   */
  setMaxListeners(max: number): void {
    this.maxListeners = max;
  }

  // Private implementation methods

  private addListener(
    event: WebSocketEventType,
    listener: WebSocketEventListener,
    once: boolean
  ): WebSocketEventSubscription {
    const targetMap = once ? this.onceListeners : this.listeners;
    const listeners = targetMap.get(event);
    
    if (!listeners) {
      throw new Error(`Unknown event type: ${event}`);
    }
    
    // Check max listeners limit
    if (this.listenerCount(event) >= this.maxListeners) {
      throw new Error(`Maximum listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }
    
    listeners.add(listener);
    this.statistics.totalListenersAdded++;
    
    this.log('debug', `Added ${once ? 'once' : 'persistent'} listener for ${event}`);
    
    return new WebSocketEventSubscriptionImpl(this, event, listener, once);
  }

  private emitEvent(event: WebSocketEvent): void {
    try {
      this.statistics.totalEventsEmitted++;
      this.statistics.eventCounts.set(event.type, (this.statistics.eventCounts.get(event.type) || 0) + 1);
      
      // Apply filters
      if (!this.applyFilters(event)) {
        this.statistics.totalEventsFiltered++;
        return;
      }
      
      const listeners = this.listeners.get(event.type);
      const onceListeners = this.onceListeners.get(event.type);
      const results: any[] = [];
      
      // Call persistent listeners
      if (listeners) {
        listeners.forEach(listener => {
          try {
            const result = listener(event);
            results.push(result);
          } catch (error) {
            this.handleListenerError(error as Error, event, listener);
          }
        });
      }
      
      // Call and remove one-time listeners
      if (onceListeners && onceListeners.size > 0) {
        const onceListenersCopy = Array.from(onceListeners);
        onceListeners.clear();
        
        onceListenersCopy.forEach(listener => {
          try {
            const result = listener(event);
            results.push(result);
          } catch (error) {
            this.handleListenerError(error as Error, event, listener);
          }
        });
      }
      
      // Apply after middleware
      this.applyAfterMiddleware(event, results);
      
      this.log('debug', `Emitted ${event.type} event to ${listeners?.size || 0} + ${onceListenersCopy?.length || 0} listeners`);
      
    } catch (error) {
      this.statistics.totalErrors++;
      this.log('error', `Error emitting ${event.type} event:`, error);
    }
  }

  private applyFilters(event: WebSocketEvent): boolean {
    const filters = this.filters.get(event.type);
    if (!filters || filters.size === 0) {
      return true;
    }
    
    for (const filter of filters) {
      try {
        if (!filter.shouldProcess(event as any)) {
          return false;
        }
        
        if (filter.transform) {
          const transformed = filter.transform(event as any);
          Object.assign(event, transformed);
        }
      } catch (error) {
        this.log('error', `Error in filter ${filter.getDescription()}:`, error);
      }
    }
    
    return true;
  }

  private applyBeforeMiddleware(event: WebSocketEvent): WebSocketEvent | null {
    let processedEvent = event;
    
    for (const middleware of this.middleware) {
      try {
        if (middleware.beforeEmit) {
          const result = middleware.beforeEmit(processedEvent);
          if (result === null) {
            return null; // Event was filtered out
          }
          processedEvent = result;
        }
      } catch (error) {
        this.log('error', `Error in middleware ${middleware.getName()} beforeEmit:`, error);
      }
    }
    
    return processedEvent;
  }

  private applyAfterMiddleware(event: WebSocketEvent, results: any[]): void {
    for (const middleware of this.middleware) {
      try {
        if (middleware.afterEmit) {
          middleware.afterEmit(event, results);
        }
      } catch (error) {
        this.log('error', `Error in middleware ${middleware.getName()} afterEmit:`, error);
      }
    }
  }

  private handleListenerError(error: Error, event: WebSocketEvent, listener: WebSocketEventListener): void {
    this.statistics.totalListenerErrors++;
    
    // Try middleware error handling first
    for (const middleware of this.middleware) {
      try {
        if (middleware.onError) {
          middleware.onError(error, event, listener);
          return;
        }
      } catch (middlewareError) {
        this.log('error', `Error in middleware ${middleware.getName()} onError:`, middlewareError);
      }
    }
    
    // Default error handling
    this.log('error', `Error in event listener for ${event.type}:`, error);
  }

  private updateStatistics(): void {
    let totalActiveListeners = 0;
    
    this.listeners.forEach(listeners => {
      totalActiveListeners += listeners.size;
    });
    
    this.onceListeners.forEach(listeners => {
      totalActiveListeners += listeners.size;
    });
    
    this.statistics.activeListeners = totalActiveListeners;
  }

  private initializeStatistics(): EventEmitterStatistics {
    return {
      totalEventsEmitted: 0,
      totalListenersAdded: 0,
      totalListenersRemoved: 0,
      totalErrors: 0,
      totalListenerErrors: 0,
      totalEventsFiltered: 0,
      activeListeners: 0,
      eventCounts: new Map()
    };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (this.enableLogging) {
      console[level](`[WebSocketEventEmitter] ${message}`, ...args);
    }
  }
}

/**
 * Event emitter configuration options
 */
export interface EventEmitterOptions {
  maxListeners?: number;
  enableLogging?: boolean;
}

/**
 * Event emitter statistics
 */
export interface EventEmitterStatistics {
  totalEventsEmitted: number;
  totalListenersAdded: number;
  totalListenersRemoved: number;
  totalErrors: number;
  totalListenerErrors: number;
  totalEventsFiltered: number;
  activeListeners: number;
  eventCounts: Map<WebSocketEventType, number>;
}

/**
 * Event subscription implementation
 */
class WebSocketEventSubscriptionImpl implements WebSocketEventSubscription {
  private emitter: TypedWebSocketEventEmitter;
  private eventType: WebSocketEventType;
  private listener: WebSocketEventListener;
  private once: boolean;
  private active: boolean = true;

  constructor(
    emitter: TypedWebSocketEventEmitter,
    eventType: WebSocketEventType,
    listener: WebSocketEventListener,
    once: boolean
  ) {
    this.emitter = emitter;
    this.eventType = eventType;
    this.listener = listener;
    this.once = once;
  }

  unsubscribe(): void {
    if (this.active) {
      this.emitter.removeEventListener(this.eventType, this.listener);
      this.active = false;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getEventType(): WebSocketEventType {
    return this.eventType;
  }

  getListenerCount(): number {
    return this.emitter.listenerCount(this.eventType);
  }
}

/**
 * Event stream for reactive programming
 */
export class WebSocketEventStream<T extends WebSocketEventType> {
  private emitter: TypedWebSocketEventEmitter;
  private eventType: T;
  private filter?: WebSocketEventFilter<T>;
  private subscribers: Set<(event: WebSocketEventMap[T]) => void> = new Set();
  private isActive: boolean = true;

  constructor(
    emitter: TypedWebSocketEventEmitter,
    eventType: T,
    filter?: WebSocketEventFilter<T>
  ) {
    this.emitter = emitter;
    this.eventType = eventType;
    this.filter = filter;
    
    // Start listening
    this.emitter.on(eventType, this.handleEvent.bind(this));
  }

  /**
   * Subscribe to stream events
   */
  subscribe(callback: (event: WebSocketEventMap[T]) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Map stream events
   */
  map<U>(mapper: (event: WebSocketEventMap[T]) => U): WebSocketMappedStream<U> {
    return new WebSocketMappedStream(this, mapper);
  }

  /**
   * Filter stream events
   */
  filter(predicate: (event: WebSocketEventMap[T]) => boolean): WebSocketEventStream<T> {
    const combinedFilter: WebSocketEventFilter<T> = {
      shouldProcess: (event) => {
        if (this.filter && !this.filter.shouldProcess(event)) {
          return false;
        }
        return predicate(event);
      },
      getDescription: () => 'Combined filter'
    };
    
    return new WebSocketEventStream(this.emitter, this.eventType, combinedFilter);
  }

  /**
   * Take first N events
   */
  take(count: number): WebSocketEventStream<T> {
    let taken = 0;
    
    const takeFilter: WebSocketEventFilter<T> = {
      shouldProcess: (event) => {
        if (taken >= count) {
          return false;
        }
        taken++;
        return true;
      },
      getDescription: () => `Take ${count} events`
    };
    
    return new WebSocketEventStream(this.emitter, this.eventType, takeFilter);
  }

  /**
   * Close the stream
   */
  close(): void {
    this.isActive = false;
    this.subscribers.clear();
  }

  private handleEvent(event: WebSocketEventMap[T]): void {
    if (!this.isActive) {
      return;
    }
    
    if (this.filter && !this.filter.shouldProcess(event)) {
      return;
    }
    
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in stream subscriber:', error);
      }
    });
  }
}

/**
 * Mapped event stream
 */
export class WebSocketMappedStream<T> {
  private sourceStream: WebSocketEventStream<any>;
  private mapper: (event: any) => T;
  private subscribers: Set<(value: T) => void> = new Set();

  constructor(sourceStream: WebSocketEventStream<any>, mapper: (event: any) => T) {
    this.sourceStream = sourceStream;
    this.mapper = mapper;
    
    this.sourceStream.subscribe(this.handleSourceEvent.bind(this));
  }

  subscribe(callback: (value: T) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private handleSourceEvent(event: any): void {
    try {
      const mappedValue = this.mapper(event);
      this.subscribers.forEach(callback => {
        try {
          callback(mappedValue);
        } catch (error) {
          console.error('Error in mapped stream subscriber:', error);
        }
      });
    } catch (error) {
      console.error('Error in stream mapper:', error);
    }
  }
}

/**
 * Common event filters
 */
export class WebSocketEventFilters {
  /**
   * Filter events by data property
   */
  static byDataProperty<T extends WebSocketEventType>(
    property: string,
    value: any
  ): WebSocketEventFilter<T> {
    return {
      shouldProcess: (event) => {
        return event.data && event.data[property] === value;
      },
      getDescription: () => `Filter by ${property} = ${value}`
    };
  }

  /**
   * Filter events by timestamp range
   */
  static byTimeRange<T extends WebSocketEventType>(
    startTime: Date,
    endTime: Date
  ): WebSocketEventFilter<T> {
    return {
      shouldProcess: (event) => {
        return event.timestamp >= startTime && event.timestamp <= endTime;
      },
      getDescription: () => `Filter by time range ${startTime.toISOString()} - ${endTime.toISOString()}`
    };
  }

  /**
   * Rate limiting filter
   */
  static rateLimit<T extends WebSocketEventType>(
    eventsPerSecond: number
  ): WebSocketEventFilter<T> {
    let lastEventTime = 0;
    const minInterval = 1000 / eventsPerSecond;
    
    return {
      shouldProcess: (event) => {
        const now = Date.now();
        if (now - lastEventTime >= minInterval) {
          lastEventTime = now;
          return true;
        }
        return false;
      },
      getDescription: () => `Rate limit: ${eventsPerSecond} events/second`
    };
  }
}

/**
 * Common event middleware
 */
export class WebSocketEventMiddleware {
  /**
   * Logging middleware
   */
  static createLoggingMiddleware(
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): WebSocketEventMiddleware {
    return {
      beforeEmit: (event) => {
        console[logLevel](`[WebSocket] Emitting ${event.type} event`, event);
        return event;
      },
      getName: () => 'LoggingMiddleware'
    };
  }

  /**
   * Performance monitoring middleware
   */
  static createPerformanceMiddleware(): WebSocketEventMiddleware {
    const eventTimings = new Map<string, number>();
    
    return {
      beforeEmit: (event) => {
        eventTimings.set(event.type, performance.now());
        return event;
      },
      afterEmit: (event, results) => {
        const startTime = eventTimings.get(event.type);
        if (startTime) {
          const duration = performance.now() - startTime;
          if (duration > 10) { // Log slow events (>10ms)
            console.warn(`[WebSocket] Slow event processing: ${event.type} took ${duration.toFixed(2)}ms`);
          }
          eventTimings.delete(event.type);
        }
      },
      getName: () => 'PerformanceMiddleware'
    };
  }

  /**
   * Error handling middleware
   */
  static createErrorHandlingMiddleware(
    onError?: (error: Error, event: WebSocketEvent) => void
  ): WebSocketEventMiddleware {
    return {
      onError: (error, event, listener) => {
        console.error(`[WebSocket] Listener error for ${event.type}:`, error);
        if (onError) {
          onError(error, event);
        }
      },
      getName: () => 'ErrorHandlingMiddleware'
    };
  }
}