/**
 * WebSocket client interface for real-time communication
 * 
 * Why: Abstracts WebSocket implementation for testing and flexibility
 * Pattern: Interface Segregation - defines minimal WebSocket contract
 * Rationale: Enables polymorphic WebSocket handling with different strategies
 */
export interface IWebSocketClient {
  /**
   * Connect to WebSocket server
   * @param url WebSocket server URL
   * @param protocols Optional sub-protocols
   * @returns Promise that resolves when connected
   */
  connect(url: string, protocols?: string | string[]): Promise<void>;

  /**
   * Disconnect from WebSocket server
   * @param code Optional close code
   * @param reason Optional close reason
   * @returns Promise that resolves when disconnected
   */
  disconnect(code?: number, reason?: string): Promise<void>;

  /**
   * Send text message
   * @param message Text message to send
   * @returns Promise that resolves when message is sent
   */
  sendText(message: string): Promise<void>;

  /**
   * Send binary message
   * @param data Binary data to send
   * @returns Promise that resolves when message is sent
   */
  sendBinary(data: ArrayBuffer | Uint8Array): Promise<void>;

  /**
   * Send JSON message
   * @param data Object to serialize and send
   * @returns Promise that resolves when message is sent
   */
  sendJSON(data: any): Promise<void>;

  /**
   * Get current connection state
   * @returns Current WebSocket state
   */
  getState(): WebSocketState;

  /**
   * Check if connected
   * @returns True if connected
   */
  isConnected(): boolean;

  /**
   * Check if connecting
   * @returns True if connecting
   */
  isConnecting(): boolean;

  /**
   * Get connection URL
   * @returns Current connection URL or null
   */
  getUrl(): string | null;

  /**
   * Get connection statistics
   * @returns Connection statistics
   */
  getStatistics(): WebSocketStatistics;

  /**
   * Register event listener
   * @param event Event type to listen for
   * @param listener Event handler function
   */
  addEventListener(event: WebSocketEventType, listener: WebSocketEventListener): void;

  /**
   * Remove event listener
   * @param event Event type to remove
   * @param listener Event handler function to remove
   */
  removeEventListener(event: WebSocketEventType, listener: WebSocketEventListener): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;

  /**
   * Enable/disable auto-reconnection
   * @param enabled Whether to enable auto-reconnection
   */
  setAutoReconnect(enabled: boolean): void;

  /**
   * Check if auto-reconnection is enabled
   * @returns True if auto-reconnection is enabled
   */
  isAutoReconnectEnabled(): boolean;

  /**
   * Update connection configuration
   * @param config New configuration options
   */
  updateConfiguration(config: Partial<WebSocketConfiguration>): void;

  /**
   * Get current configuration
   * @returns Current configuration
   */
  getConfiguration(): WebSocketConfiguration;

  /**
   * Get connection capabilities
   * @returns Capabilities information
   */
  getCapabilities(): WebSocketCapabilities;

  /**
   * Force reconnection attempt
   * @returns Promise that resolves when reconnection completes
   */
  forceReconnect(): Promise<void>;

  /**
   * Get last error
   * @returns Last connection error or null
   */
  getLastError(): WebSocketError | null;

  /**
   * Clear error state
   */
  clearError(): void;
}

/**
 * WebSocket state enumeration
 */
export enum WebSocketState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * WebSocket event types
 */
export enum WebSocketEventType {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  RECONNECTED = 'reconnected',
  ERROR = 'error',
  MESSAGE = 'message',
  TEXT_MESSAGE = 'text_message',
  BINARY_MESSAGE = 'binary_message',
  JSON_MESSAGE = 'json_message',
  PING = 'ping',
  PONG = 'pong',
  STATE_CHANGE = 'state_change'
}

/**
 * WebSocket event data
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: Date;
  data?: any;
  error?: WebSocketError;
  state?: WebSocketState;
  url?: string;
}

/**
 * WebSocket event listener type
 */
export type WebSocketEventListener = (event: WebSocketEvent) => void;

/**
 * WebSocket error information
 */
export interface WebSocketError {
  type: WebSocketErrorType;
  message: string;
  code?: number;
  reason?: string;
  originalError?: Error | Event;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  url?: string;
}

/**
 * WebSocket error types
 */
export enum WebSocketErrorType {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_TIMEOUT = 'connection_timeout',
  CONNECTION_REFUSED = 'connection_refused',
  AUTHENTICATION_FAILED = 'authentication_failed',
  PROTOCOL_ERROR = 'protocol_error',
  MESSAGE_SEND_FAILED = 'message_send_failed',
  MESSAGE_PARSE_FAILED = 'message_parse_failed',
  UNEXPECTED_CLOSE = 'unexpected_close',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'text' | 'binary' | 'json';
  data: string | ArrayBuffer | any;
  timestamp: Date;
  size: number;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfiguration {
  // Connection settings
  protocols: string[];
  timeout: number; // Connection timeout in milliseconds
  pingInterval: number; // Ping interval in milliseconds
  pongTimeout: number; // Pong response timeout in milliseconds
  
  // Reconnection settings
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectInterval: number; // Initial reconnect interval in milliseconds
  maxReconnectInterval: number; // Maximum reconnect interval in milliseconds
  reconnectBackoffFactor: number; // Exponential backoff multiplier
  
  // Message handling
  messageQueueSize: number; // Maximum queued messages
  binaryType: 'blob' | 'arraybuffer';
  enableCompression: boolean;
  
  // Authentication
  authToken?: string;
  authHeader?: string;
  customHeaders?: Record<string, string>;
  
  // Performance
  enablePerformanceMonitoring: boolean;
  maxMessageSize: number; // Maximum message size in bytes
  enableHeartbeat: boolean;
  
  // Debug settings
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * WebSocket statistics
 */
export interface WebSocketStatistics {
  // Connection stats
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  reconnectionAttempts: number;
  totalUptime: number; // Total connected time in milliseconds
  currentSessionUptime: number; // Current session uptime in milliseconds
  
  // Message stats
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  messagesQueued: number;
  messagesDropped: number;
  
  // Error stats
  totalErrors: number;
  connectionErrors: number;
  messageErrors: number;
  lastErrorTime?: Date;
  
  // Performance stats
  averageLatency: number; // Average round-trip time in milliseconds
  messageRate: number; // Messages per second
  throughput: number; // Bytes per second
  
  // State tracking
  stateChanges: number;
  lastConnectedTime?: Date;
  lastDisconnectedTime?: Date;
}

/**
 * WebSocket capabilities
 */
export interface WebSocketCapabilities {
  implementation: string;
  supportsReconnection: boolean;
  supportsMessageQueuing: boolean;
  supportsCompression: boolean;
  supportsBinaryMessages: boolean;
  supportsSubProtocols: boolean;
  supportsCustomHeaders: boolean;
  supportsHeartbeat: boolean;
  supportsPerformanceMonitoring: boolean;
  maxMessageSize: number;
  supportedBinaryTypes: ('blob' | 'arraybuffer')[];
}

/**
 * WebSocket close codes (standard and custom)
 */
export enum WebSocketCloseCode {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  NO_STATUS_RECEIVED = 1005,
  ABNORMAL_CLOSURE = 1006,
  INVALID_FRAME_PAYLOAD_DATA = 1007,
  POLICY_VIOLATION = 1008,
  MESSAGE_TOO_BIG = 1009,
  MANDATORY_EXTENSION = 1010,
  INTERNAL_SERVER_ERROR = 1011,
  SERVICE_RESTART = 1012,
  TRY_AGAIN_LATER = 1013,
  BAD_GATEWAY = 1014,
  TLS_HANDSHAKE = 1015,
  
  // Custom codes (3000-4999 range)
  AUTHENTICATION_FAILED = 4001,
  RATE_LIMITED = 4002,
  QUOTA_EXCEEDED = 4003,
  INVALID_SESSION = 4004,
  MAINTENANCE_MODE = 4005
}

/**
 * Default WebSocket configuration
 */
export const DEFAULT_WEBSOCKET_CONFIG: WebSocketConfiguration = {
  // Connection settings
  protocols: [],
  timeout: 10000, // 10 seconds
  pingInterval: 30000, // 30 seconds
  pongTimeout: 5000, // 5 seconds
  
  // Reconnection settings
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectInterval: 1000, // 1 second
  maxReconnectInterval: 30000, // 30 seconds
  reconnectBackoffFactor: 1.5,
  
  // Message handling
  messageQueueSize: 100,
  binaryType: 'arraybuffer',
  enableCompression: true,
  
  // Performance
  enablePerformanceMonitoring: true,
  maxMessageSize: 10 * 1024 * 1024, // 10MB
  enableHeartbeat: true,
  
  // Debug settings
  enableLogging: false,
  logLevel: 'info'
};

/**
 * WebSocket client factory interface
 */
export interface IWebSocketClientFactory {
  /**
   * Create WebSocket client instance
   * @param config Optional configuration override
   * @returns WebSocket client instance
   */
  createClient(config?: Partial<WebSocketConfiguration>): IWebSocketClient;

  /**
   * Check WebSocket support
   * @returns True if WebSocket is supported
   */
  isWebSocketSupported(): boolean;

  /**
   * Get recommended configuration for current environment
   * @returns Recommended configuration
   */
  getRecommendedConfiguration(): WebSocketConfiguration;

  /**
   * Test WebSocket connection
   * @param url WebSocket server URL
   * @param timeout Test timeout in milliseconds
   * @returns Promise that resolves with test result
   */
  testConnection(url: string, timeout?: number): Promise<WebSocketTestResult>;
}

/**
 * WebSocket connection test result
 */
export interface WebSocketTestResult {
  success: boolean;
  url: string;
  duration: number; // Connection time in milliseconds
  error?: WebSocketError;
  supportedProtocols: string[];
  serverInfo?: any;
}

/**
 * WebSocket message queue interface
 */
export interface IWebSocketMessageQueue {
  /**
   * Add message to queue
   * @param message Message to queue
   */
  enqueue(message: WebSocketQueuedMessage): void;

  /**
   * Remove and return next message from queue
   * @returns Next message or null if queue is empty
   */
  dequeue(): WebSocketQueuedMessage | null;

  /**
   * Peek at next message without removing it
   * @returns Next message or null if queue is empty
   */
  peek(): WebSocketQueuedMessage | null;

  /**
   * Get queue size
   * @returns Number of messages in queue
   */
  size(): number;

  /**
   * Check if queue is empty
   * @returns True if queue is empty
   */
  isEmpty(): boolean;

  /**
   * Clear all messages from queue
   */
  clear(): void;

  /**
   * Get queue statistics
   * @returns Queue statistics
   */
  getStatistics(): MessageQueueStatistics;
}

/**
 * Queued WebSocket message
 */
export interface WebSocketQueuedMessage {
  id: string;
  type: 'text' | 'binary' | 'json';
  data: string | ArrayBuffer | any;
  timestamp: Date;
  retryCount: number;
  priority: number;
  expiry?: Date;
}

/**
 * Message queue statistics
 */
export interface MessageQueueStatistics {
  totalEnqueued: number;
  totalDequeued: number;
  totalDropped: number;
  currentSize: number;
  maxSize: number;
  averageWaitTime: number; // Average time in queue in milliseconds
  peakSize: number;
}

/**
 * WebSocket reconnection strategy interface
 */
export interface IReconnectionStrategy {
  /**
   * Calculate next reconnection delay
   * @param attempt Current attempt number (0-based)
   * @param lastError Last connection error
   * @returns Delay in milliseconds, or null to stop reconnecting
   */
  getNextDelay(attempt: number, lastError?: WebSocketError): number | null;

  /**
   * Reset strategy state
   */
  reset(): void;

  /**
   * Get strategy name
   * @returns Strategy name
   */
  getStrategyName(): string;

  /**
   * Check if should attempt reconnection
   * @param error Connection error
   * @param attempt Current attempt number
   * @returns True if should attempt reconnection
   */
  shouldReconnect(error: WebSocketError, attempt: number): boolean;
}

/**
 * WebSocket event emitter interface
 */
export interface IWebSocketEventEmitter {
  /**
   * Emit event to all listeners
   * @param event Event to emit
   */
  emit(event: WebSocketEvent): void;

  /**
   * Add event listener
   * @param type Event type to listen for
   * @param listener Event handler function
   */
  on(type: WebSocketEventType, listener: WebSocketEventListener): void;

  /**
   * Add one-time event listener
   * @param type Event type to listen for
   * @param listener Event handler function
   */
  once(type: WebSocketEventType, listener: WebSocketEventListener): void;

  /**
   * Remove event listener
   * @param type Event type to remove
   * @param listener Event handler function to remove
   */
  off(type: WebSocketEventType, listener: WebSocketEventListener): void;

  /**
   * Remove all listeners for event type
   * @param type Event type to clear (optional, clears all if not specified)
   */
  removeAllListeners(type?: WebSocketEventType): void;

  /**
   * Get listener count for event type
   * @param type Event type to count
   * @returns Number of listeners
   */
  listenerCount(type: WebSocketEventType): number;
}