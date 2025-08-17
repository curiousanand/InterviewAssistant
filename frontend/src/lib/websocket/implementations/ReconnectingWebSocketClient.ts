import {
  IWebSocketClient,
  WebSocketState,
  WebSocketEventType,
  WebSocketEvent,
  WebSocketEventListener,
  WebSocketError,
  WebSocketErrorType,
  WebSocketConfiguration,
  WebSocketStatistics,
  WebSocketCapabilities,
  WebSocketCloseCode,
  DEFAULT_WEBSOCKET_CONFIG,
  IWebSocketMessageQueue,
  IReconnectionStrategy,
  WebSocketQueuedMessage,
  MessageQueueStatistics
} from '../interfaces/IWebSocketClient';

/**
 * Reconnecting WebSocket client implementation
 * 
 * Why: Provides reliable WebSocket connection with automatic reconnection
 * Pattern: Strategy Pattern - uses pluggable reconnection strategies
 * Rationale: Ensures resilient real-time communication with exponential backoff
 */
export class ReconnectingWebSocketClient implements IWebSocketClient {
  private websocket: WebSocket | null = null;
  private state: WebSocketState = WebSocketState.IDLE;
  private configuration: WebSocketConfiguration;
  private url: string | null = null;
  private protocols: string | string[] | undefined;
  
  // Event handling
  private eventListeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
  
  // Reconnection management
  private reconnectionStrategy: ExponentialBackoffStrategy;
  private reconnectAttempt: number = 0;
  private reconnectTimeoutId: number | null = null;
  private lastError: WebSocketError | null = null;
  
  // Message queuing
  private messageQueue: SimpleMessageQueue;
  private isQueueProcessing: boolean = false;
  
  // Statistics tracking
  private statistics: WebSocketStatistics = this.initializeStatistics();
  private connectionStartTime: number = 0;
  private sessionStartTime: number = 0;
  private latencyMeasurements: number[] = [];
  
  // Heartbeat management
  private pingTimeoutId: number | null = null;
  private pongTimeoutId: number | null = null;
  private lastPingTime: number = 0;
  
  // Performance monitoring
  private performanceStartTime: number = 0;
  private messageTimestamps: number[] = [];

  constructor(config?: Partial<WebSocketConfiguration>) {
    this.configuration = { ...DEFAULT_WEBSOCKET_CONFIG, ...config };
    this.reconnectionStrategy = new ExponentialBackoffStrategy(this.configuration);
    this.messageQueue = new SimpleMessageQueue(this.configuration.messageQueueSize);
    
    // Initialize event listener maps
    Object.values(WebSocketEventType).forEach(eventType => {
      this.eventListeners.set(eventType, new Set());
    });
  }

  async connect(url: string, protocols?: string | string[]): Promise<void> {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      throw this.createError(
        WebSocketErrorType.CONNECTION_FAILED,
        'WebSocket is already connected or connecting',
        false,
        false
      );
    }

    this.url = url;
    this.protocols = protocols;
    this.clearError();
    
    return this.performConnection();
  }

  async disconnect(code?: number, reason?: string): Promise<void> {
    this.configuration.autoReconnect = false; // Disable auto-reconnect for manual disconnect
    this.clearReconnectTimeout();
    this.stopHeartbeat();
    
    if (this.websocket) {
      this.setState(WebSocketState.DISCONNECTING);
      
      try {
        this.websocket.close(code || WebSocketCloseCode.NORMAL_CLOSURE, reason);
        
        // Wait for close event or timeout
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 5000); // 5 second timeout
          
          const onClose = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          if (this.websocket) {
            this.websocket.addEventListener('close', onClose, { once: true });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
        
      } catch (error) {
        this.log('warn', 'Error during disconnect:', error);
      }
    }
    
    this.cleanup();
    this.setState(WebSocketState.DISCONNECTED);
  }

  async sendText(message: string): Promise<void> {
    return this.sendMessage('text', message);
  }

  async sendBinary(data: ArrayBuffer | Uint8Array): Promise<void> {
    const arrayBuffer = data instanceof Uint8Array ? data.buffer : data;
    return this.sendMessage('binary', arrayBuffer);
  }

  async sendJSON(data: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      return this.sendMessage('json', jsonString);
    } catch (error) {
      throw this.createError(
        WebSocketErrorType.MESSAGE_SEND_FAILED,
        `Failed to serialize JSON: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  getState(): WebSocketState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  isConnecting(): boolean {
    return this.state === WebSocketState.CONNECTING;
  }

  getUrl(): string | null {
    return this.url;
  }

  getStatistics(): WebSocketStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  addEventListener(event: WebSocketEventType, listener: WebSocketEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  removeEventListener(event: WebSocketEventType, listener: WebSocketEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  removeAllListeners(): void {
    this.eventListeners.forEach(listeners => listeners.clear());
  }

  setAutoReconnect(enabled: boolean): void {
    this.configuration.autoReconnect = enabled;
    if (!enabled) {
      this.clearReconnectTimeout();
    }
  }

  isAutoReconnectEnabled(): boolean {
    return this.configuration.autoReconnect;
  }

  updateConfiguration(config: Partial<WebSocketConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
    this.reconnectionStrategy.updateConfiguration(this.configuration);
    this.messageQueue.updateConfiguration(this.configuration.messageQueueSize);
  }

  getConfiguration(): WebSocketConfiguration {
    return { ...this.configuration };
  }

  getCapabilities(): WebSocketCapabilities {
    return {
      implementation: 'ReconnectingWebSocketClient',
      supportsReconnection: true,
      supportsMessageQueuing: true,
      supportsCompression: false, // Depends on browser support
      supportsBinaryMessages: true,
      supportsSubProtocols: true,
      supportsCustomHeaders: false, // WebSocket API limitation
      supportsHeartbeat: true,
      supportsPerformanceMonitoring: true,
      maxMessageSize: this.configuration.maxMessageSize,
      supportedBinaryTypes: ['blob', 'arraybuffer']
    };
  }

  async forceReconnect(): Promise<void> {
    this.log('info', 'Forcing reconnection...');
    
    if (this.websocket) {
      this.websocket.close(WebSocketCloseCode.GOING_AWAY, 'Force reconnect');
    }
    
    this.clearReconnectTimeout();
    this.reconnectAttempt = 0;
    this.reconnectionStrategy.reset();
    
    if (this.url) {
      return this.performConnection();
    }
  }

  getLastError(): WebSocketError | null {
    return this.lastError;
  }

  clearError(): void {
    this.lastError = null;
  }

  // Private implementation methods

  private async performConnection(): Promise<void> {
    if (!this.url) {
      throw this.createError(
        WebSocketErrorType.CONNECTION_FAILED,
        'No URL specified for connection',
        false,
        false
      );
    }

    this.setState(WebSocketState.CONNECTING);
    this.connectionStartTime = performance.now();
    this.statistics.connectionAttempts++;
    
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with timeout
        const connectionTimeout = setTimeout(() => {
          if (this.websocket) {
            this.websocket.close();
          }
          
          const error = this.createError(
            WebSocketErrorType.CONNECTION_TIMEOUT,
            `Connection timeout after ${this.configuration.timeout}ms`,
            true,
            true
          );
          
          this.handleConnectionError(error);
          reject(error);
        }, this.configuration.timeout);

        this.websocket = new WebSocket(this.url!, this.protocols);
        this.websocket.binaryType = this.configuration.binaryType;
        
        // Setup event handlers
        this.websocket.onopen = (event) => {
          clearTimeout(connectionTimeout);
          this.handleOpen(event);
          resolve();
        };
        
        this.websocket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.handleClose(event);
          
          if (this.state === WebSocketState.CONNECTING) {
            const error = this.createError(
              WebSocketErrorType.CONNECTION_FAILED,
              `Connection failed with code ${event.code}: ${event.reason}`,
              true,
              true
            );
            reject(error);
          }
        };
        
        this.websocket.onerror = (event) => {
          clearTimeout(connectionTimeout);
          const error = this.createError(
            WebSocketErrorType.CONNECTION_FAILED,
            'WebSocket connection error',
            true,
            true,
            event
          );
          
          this.handleError(error);
          
          if (this.state === WebSocketState.CONNECTING) {
            reject(error);
          }
        };
        
        this.websocket.onmessage = (event) => {
          this.handleMessage(event);
        };
        
      } catch (error) {
        const wsError = this.createError(
          WebSocketErrorType.CONNECTION_FAILED,
          `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`,
          true,
          true,
          error instanceof Error ? error : undefined
        );
        
        this.handleConnectionError(wsError);
        reject(wsError);
      }
    });
  }

  private handleOpen(event: Event): void {
    this.log('info', 'WebSocket connected successfully');
    
    this.setState(WebSocketState.CONNECTED);
    this.statistics.successfulConnections++;
    this.reconnectAttempt = 0;
    this.reconnectionStrategy.reset();
    this.sessionStartTime = performance.now();
    
    // Start heartbeat
    if (this.configuration.enableHeartbeat) {
      this.startHeartbeat();
    }
    
    // Process queued messages
    this.processMessageQueue();
    
    // Emit events
    this.emitEvent({
      type: WebSocketEventType.CONNECTED,
      timestamp: new Date(),
      url: this.url || undefined
    });
    
    if (this.reconnectAttempt > 0) {
      this.emitEvent({
        type: WebSocketEventType.RECONNECTED,
        timestamp: new Date(),
        data: { attempt: this.reconnectAttempt }
      });
    }
  }

  private handleClose(event: CloseEvent): void {
    this.log('info', `WebSocket closed with code ${event.code}: ${event.reason}`);
    
    this.stopHeartbeat();
    this.updateConnectionTime();
    
    const wasConnected = this.state === WebSocketState.CONNECTED;
    this.setState(WebSocketState.DISCONNECTED);
    
    // Emit disconnect event
    this.emitEvent({
      type: WebSocketEventType.DISCONNECTED,
      timestamp: new Date(),
      data: {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      }
    });
    
    // Handle reconnection
    if (this.configuration.autoReconnect && wasConnected && this.shouldReconnect(event)) {
      this.scheduleReconnection();
    }
  }

  private handleError(error: WebSocketError): void {
    this.log('error', 'WebSocket error:', error);
    
    this.lastError = error;
    this.statistics.totalErrors++;
    this.statistics.lastErrorTime = new Date();
    
    if (error.type === WebSocketErrorType.CONNECTION_FAILED) {
      this.statistics.connectionErrors++;
    } else {
      this.statistics.messageErrors++;
    }
    
    this.emitEvent({
      type: WebSocketEventType.ERROR,
      timestamp: new Date(),
      error
    });
  }

  private handleConnectionError(error: WebSocketError): void {
    this.statistics.failedConnections++;
    this.handleError(error);
    
    if (this.configuration.autoReconnect && this.shouldAttemptReconnection(error)) {
      this.scheduleReconnection();
    } else {
      this.setState(WebSocketState.ERROR);
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      this.statistics.messagesReceived++;
      
      if (typeof event.data === 'string') {
        this.statistics.bytesReceived += event.data.length;
        this.handleTextMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.statistics.bytesReceived += event.data.byteLength;
        this.handleBinaryMessage(event.data);
      } else if (event.data instanceof Blob) {
        this.statistics.bytesReceived += event.data.size;
        this.handleBlobMessage(event.data);
      }
      
      // Update performance metrics
      this.updateMessageMetrics();
      
    } catch (error) {
      const wsError = this.createError(
        WebSocketErrorType.MESSAGE_PARSE_FAILED,
        `Failed to process incoming message: ${error instanceof Error ? error.message : String(error)}`,
        true,
        false,
        error instanceof Error ? error : undefined
      );
      
      this.handleError(wsError);
    }
  }

  private handleTextMessage(data: string): void {
    // Check if it's a JSON message
    let parsedData: any = data;
    let messageType = 'text';
    
    try {
      parsedData = JSON.parse(data);
      messageType = 'json';
    } catch {
      // Not JSON, treat as plain text
    }
    
    // Handle pong response
    if (data === 'pong' || (parsedData && parsedData.type === 'pong')) {
      this.handlePong();
      return;
    }
    
    // Emit appropriate event
    this.emitEvent({
      type: messageType === 'json' ? WebSocketEventType.JSON_MESSAGE : WebSocketEventType.TEXT_MESSAGE,
      timestamp: new Date(),
      data: parsedData
    });
    
    // Also emit generic message event
    this.emitEvent({
      type: WebSocketEventType.MESSAGE,
      timestamp: new Date(),
      data: {
        type: messageType,
        data: parsedData,
        size: data.length
      }
    });
  }

  private handleBinaryMessage(data: ArrayBuffer): void {
    this.emitEvent({
      type: WebSocketEventType.BINARY_MESSAGE,
      timestamp: new Date(),
      data
    });
    
    this.emitEvent({
      type: WebSocketEventType.MESSAGE,
      timestamp: new Date(),
      data: {
        type: 'binary',
        data,
        size: data.byteLength
      }
    });
  }

  private async handleBlobMessage(blob: Blob): Promise<void> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      this.handleBinaryMessage(arrayBuffer);
    } catch (error) {
      const wsError = this.createError(
        WebSocketErrorType.MESSAGE_PARSE_FAILED,
        `Failed to convert blob to array buffer: ${error instanceof Error ? error.message : String(error)}`,
        true,
        false,
        error instanceof Error ? error : undefined
      );
      
      this.handleError(wsError);
    }
  }

  private async sendMessage(type: 'text' | 'binary' | 'json', data: string | ArrayBuffer): Promise<void> {
    if (!this.isConnected() || !this.websocket) {
      // Queue message if not connected
      if (this.configuration.autoReconnect) {
        this.queueMessage(type, data);
        return;
      } else {
        throw this.createError(
          WebSocketErrorType.MESSAGE_SEND_FAILED,
          'WebSocket is not connected',
          true,
          true
        );
      }
    }

    try {
      // Check message size
      const messageSize = typeof data === 'string' ? data.length : data.byteLength;
      if (messageSize > this.configuration.maxMessageSize) {
        throw this.createError(
          WebSocketErrorType.MESSAGE_SEND_FAILED,
          `Message size ${messageSize} exceeds maximum ${this.configuration.maxMessageSize}`,
          false,
          false
        );
      }

      this.websocket.send(data);
      
      // Update statistics
      this.statistics.messagesSent++;
      this.statistics.bytesSent += messageSize;
      
      this.log('debug', `Sent ${type} message (${messageSize} bytes)`);
      
    } catch (error) {
      throw this.createError(
        WebSocketErrorType.MESSAGE_SEND_FAILED,
        `Failed to send ${type} message: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private queueMessage(type: 'text' | 'binary' | 'json', data: string | ArrayBuffer): void {
    const queuedMessage: WebSocketQueuedMessage = {
      id: this.generateMessageId(),
      type,
      data,
      timestamp: new Date(),
      retryCount: 0,
      priority: 1
    };
    
    try {
      this.messageQueue.enqueue(queuedMessage);
      this.statistics.messagesQueued++;
      this.log('debug', `Queued ${type} message`);
    } catch (error) {
      this.statistics.messagesDropped++;
      this.log('warn', `Failed to queue ${type} message:`, error);
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isQueueProcessing || !this.isConnected()) {
      return;
    }

    this.isQueueProcessing = true;
    
    try {
      while (!this.messageQueue.isEmpty() && this.isConnected()) {
        const queuedMessage = this.messageQueue.dequeue();
        if (!queuedMessage) {
          break;
        }
        
        try {
          await this.sendMessage(queuedMessage.type, queuedMessage.data);
          this.log('debug', `Sent queued ${queuedMessage.type} message`);
        } catch (error) {
          this.log('warn', `Failed to send queued message:`, error);
          
          // Re-queue if retryable and under retry limit
          if (queuedMessage.retryCount < 3) {
            queuedMessage.retryCount++;
            this.messageQueue.enqueue(queuedMessage);
          } else {
            this.statistics.messagesDropped++;
          }
        }
      }
    } finally {
      this.isQueueProcessing = false;
    }
  }

  private shouldReconnect(closeEvent: CloseEvent): boolean {
    // Don't reconnect for normal closures or authentication failures
    if (closeEvent.code === WebSocketCloseCode.NORMAL_CLOSURE ||
        closeEvent.code === WebSocketCloseCode.AUTHENTICATION_FAILED) {
      return false;
    }
    
    // Check with reconnection strategy
    const error = this.createError(
      WebSocketErrorType.UNEXPECTED_CLOSE,
      `Connection closed unexpectedly: ${closeEvent.reason}`,
      true,
      true
    );
    
    return this.reconnectionStrategy.shouldReconnect(error, this.reconnectAttempt);
  }

  private shouldAttemptReconnection(error: WebSocketError): boolean {
    return this.reconnectionStrategy.shouldReconnect(error, this.reconnectAttempt);
  }

  private scheduleReconnection(): void {
    if (this.reconnectAttempt >= this.configuration.maxReconnectAttempts) {
      this.log('warn', 'Maximum reconnection attempts reached');
      this.setState(WebSocketState.ERROR);
      return;
    }

    const delay = this.reconnectionStrategy.getNextDelay(this.reconnectAttempt, this.lastError || undefined);
    if (delay === null) {
      this.log('warn', 'Reconnection strategy determined not to reconnect');
      this.setState(WebSocketState.ERROR);
      return;
    }

    this.log('info', `Scheduling reconnection attempt ${this.reconnectAttempt + 1} in ${delay}ms`);
    
    this.setState(WebSocketState.RECONNECTING);
    this.statistics.reconnectionAttempts++;
    
    this.emitEvent({
      type: WebSocketEventType.RECONNECTING,
      timestamp: new Date(),
      data: {
        attempt: this.reconnectAttempt + 1,
        delay,
        maxAttempts: this.configuration.maxReconnectAttempts
      }
    });

    this.reconnectTimeoutId = window.setTimeout(async () => {
      this.reconnectAttempt++;
      
      try {
        if (this.url) {
          await this.performConnection();
        }
      } catch (error) {
        this.log('warn', `Reconnection attempt ${this.reconnectAttempt} failed:`, error);
        
        if (this.configuration.autoReconnect) {
          this.scheduleReconnection();
        }
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.pingTimeoutId = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, this.configuration.pingInterval);
  }

  private stopHeartbeat(): void {
    if (this.pingTimeoutId !== null) {
      clearInterval(this.pingTimeoutId);
      this.pingTimeoutId = null;
    }
    
    if (this.pongTimeoutId !== null) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }

  private sendPing(): void {
    try {
      this.lastPingTime = performance.now();
      this.sendText('ping');
      
      // Set pong timeout
      this.pongTimeoutId = window.setTimeout(() => {
        this.log('warn', 'Pong timeout - connection may be dead');
        if (this.websocket) {
          this.websocket.close(WebSocketCloseCode.ABNORMAL_CLOSURE, 'Pong timeout');
        }
      }, this.configuration.pongTimeout);
      
      this.emitEvent({
        type: WebSocketEventType.PING,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.log('warn', 'Failed to send ping:', error);
    }
  }

  private handlePong(): void {
    if (this.pongTimeoutId !== null) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
    
    // Calculate latency
    if (this.lastPingTime > 0) {
      const latency = performance.now() - this.lastPingTime;
      this.latencyMeasurements.push(latency);
      
      // Keep only recent measurements
      if (this.latencyMeasurements.length > 10) {
        this.latencyMeasurements.shift();
      }
    }
    
    this.emitEvent({
      type: WebSocketEventType.PONG,
      timestamp: new Date(),
      data: { latency: this.lastPingTime > 0 ? performance.now() - this.lastPingTime : undefined }
    });
  }

  private updateMessageMetrics(): void {
    const now = performance.now();
    this.messageTimestamps.push(now);
    
    // Keep only recent timestamps (last 10 seconds)
    const cutoff = now - 10000;
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > cutoff);
  }

  private updateStatistics(): void {
    // Update current session uptime
    if (this.sessionStartTime > 0 && this.isConnected()) {
      this.statistics.currentSessionUptime = performance.now() - this.sessionStartTime;
    }
    
    // Update average latency
    if (this.latencyMeasurements.length > 0) {
      this.statistics.averageLatency = this.latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / this.latencyMeasurements.length;
    }
    
    // Update message rate
    if (this.messageTimestamps.length > 1) {
      const timeSpan = (this.messageTimestamps[this.messageTimestamps.length - 1] - this.messageTimestamps[0]) / 1000;
      this.statistics.messageRate = timeSpan > 0 ? this.messageTimestamps.length / timeSpan : 0;
    }
    
    // Update throughput
    const totalBytes = this.statistics.bytesSent + this.statistics.bytesReceived;
    const totalTime = this.statistics.totalUptime / 1000;
    this.statistics.throughput = totalTime > 0 ? totalBytes / totalTime : 0;
  }

  private updateConnectionTime(): void {
    if (this.sessionStartTime > 0) {
      const sessionDuration = performance.now() - this.sessionStartTime;
      this.statistics.totalUptime += sessionDuration;
      this.statistics.lastDisconnectedTime = new Date();
    }
  }

  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.statistics.stateChanges++;
      
      this.emitEvent({
        type: WebSocketEventType.STATE_CHANGE,
        timestamp: new Date(),
        state: newState,
        data: { oldState, newState }
      });
      
      this.log('debug', `State changed: ${oldState} -> ${newState}`);
    }
  }

  private emitEvent(event: WebSocketEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          this.log('error', 'Error in event listener:', error);
        }
      });
    }
  }

  private cleanup(): void {
    this.clearReconnectTimeout();
    this.stopHeartbeat();
    
    if (this.websocket) {
      // Remove event listeners to prevent memory leaks
      this.websocket.onopen = null;
      this.websocket.onclose = null;
      this.websocket.onerror = null;
      this.websocket.onmessage = null;
      this.websocket = null;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeStatistics(): WebSocketStatistics {
    return {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnectionAttempts: 0,
      totalUptime: 0,
      currentSessionUptime: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      messagesQueued: 0,
      messagesDropped: 0,
      totalErrors: 0,
      connectionErrors: 0,
      messageErrors: 0,
      averageLatency: 0,
      messageRate: 0,
      throughput: 0,
      stateChanges: 0
    };
  }

  private createError(
    type: WebSocketErrorType,
    message: string,
    recoverable: boolean,
    retryable: boolean,
    originalError?: Error | Event
  ): WebSocketError {
    return {
      type,
      message,
      originalError,
      timestamp: new Date(),
      recoverable,
      retryable,
      url: this.url || undefined
    };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.configuration.enableLogging) {
      return;
    }
    
    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.configuration.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);
    
    if (messageLevelIndex >= currentLevelIndex) {
      console[level](`[WebSocket] ${message}`, ...args);
    }
  }
}

/**
 * Exponential backoff reconnection strategy
 */
class ExponentialBackoffStrategy implements IReconnectionStrategy {
  private configuration: WebSocketConfiguration;

  constructor(config: WebSocketConfiguration) {
    this.configuration = config;
  }

  getNextDelay(attempt: number, lastError?: WebSocketError): number | null {
    if (attempt >= this.configuration.maxReconnectAttempts) {
      return null;
    }

    const baseDelay = this.configuration.reconnectInterval;
    const maxDelay = this.configuration.maxReconnectInterval;
    const backoffFactor = this.configuration.reconnectBackoffFactor;
    
    const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    
    return Math.floor(delay + jitter);
  }

  reset(): void {
    // No state to reset for exponential backoff
  }

  getStrategyName(): string {
    return 'ExponentialBackoff';
  }

  shouldReconnect(error: WebSocketError, attempt: number): boolean {
    // Don't reconnect for authentication errors
    if (error.type === WebSocketErrorType.AUTHENTICATION_FAILED) {
      return false;
    }
    
    // Don't reconnect if max attempts reached
    if (attempt >= this.configuration.maxReconnectAttempts) {
      return false;
    }
    
    // Only reconnect for retryable errors
    return error.retryable;
  }

  updateConfiguration(config: WebSocketConfiguration): void {
    this.configuration = config;
  }
}

/**
 * Simple message queue implementation
 */
class SimpleMessageQueue implements IWebSocketMessageQueue {
  private queue: WebSocketQueuedMessage[] = [];
  private maxSize: number;
  private statistics: MessageQueueStatistics = this.initializeStatistics();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(message: WebSocketQueuedMessage): void {
    if (this.queue.length >= this.maxSize) {
      // Drop oldest message
      const dropped = this.queue.shift();
      if (dropped) {
        this.statistics.totalDropped++;
      }
    }
    
    this.queue.push(message);
    this.statistics.totalEnqueued++;
    this.statistics.peakSize = Math.max(this.statistics.peakSize, this.queue.length);
  }

  dequeue(): WebSocketQueuedMessage | null {
    const message = this.queue.shift() || null;
    if (message) {
      this.statistics.totalDequeued++;
      
      // Calculate wait time
      const waitTime = Date.now() - message.timestamp.getTime();
      this.updateAverageWaitTime(waitTime);
    }
    
    return message;
  }

  peek(): WebSocketQueuedMessage | null {
    return this.queue[0] || null;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    const droppedCount = this.queue.length;
    this.queue = [];
    this.statistics.totalDropped += droppedCount;
  }

  getStatistics(): MessageQueueStatistics {
    this.statistics.currentSize = this.queue.length;
    this.statistics.maxSize = this.maxSize;
    return { ...this.statistics };
  }

  updateConfiguration(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    // Trim queue if necessary
    while (this.queue.length > this.maxSize) {
      const dropped = this.queue.shift();
      if (dropped) {
        this.statistics.totalDropped++;
      }
    }
  }

  private initializeStatistics(): MessageQueueStatistics {
    return {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0,
      currentSize: 0,
      maxSize: this.maxSize,
      averageWaitTime: 0,
      peakSize: 0
    };
  }

  private updateAverageWaitTime(waitTime: number): void {
    const count = this.statistics.totalDequeued;
    if (count === 1) {
      this.statistics.averageWaitTime = waitTime;
    } else {
      this.statistics.averageWaitTime = ((this.statistics.averageWaitTime * (count - 1)) + waitTime) / count;
    }
  }
}