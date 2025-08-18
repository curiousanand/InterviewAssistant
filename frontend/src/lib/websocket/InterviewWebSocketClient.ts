import { 
  WebSocketMessage, 
  WebSocketMessageType, 
  TranscriptPayload, 
  ErrorPayload,
  ConnectionState 
} from '../../types';

/**
 * Simplified WebSocket client for Interview Assistant backend
 * 
 * Why: Handles specific protocol between frontend and Spring Boot backend
 * Pattern: Event-driven communication with automatic reconnection
 * Rationale: Focused implementation for our specific use case
 */
export class InterviewWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private sessionId: string = '';
  private connectionState: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0
  };
  
  // Event handlers
  private onStateChange: ((state: ConnectionState) => void) | undefined;
  private onMessage: ((message: WebSocketMessage) => void) | undefined;
  private onError: ((error: string) => void) | undefined;
  
  // Reconnection logic
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  // Message queue for offline messages
  private messageQueue: WebSocketMessage[] = [];
  private maxQueueSize = 50;

  constructor() {
    // Auto-reconnect when online (only in browser)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.connectionState.status === 'disconnected' && this.url) {
          this.connect(this.url);
        }
      });
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    this.url = url;
    this.updateConnectionState({ status: 'connecting' });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connectionState.reconnectAttempts = 0;
          this.updateConnectionState({ 
            status: 'connected', 
            lastConnected: new Date()
          });
          
          // Process queued messages
          this.processMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.updateConnectionState({ status: 'disconnected' });
          
          // Attempt reconnection if not a normal close
          if (event.code !== 1000 && this.connectionState.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.updateConnectionState({ 
            status: 'error', 
            error: 'Connection failed' 
          });
          
          if (this.onError) {
            this.onError('WebSocket connection error');
          }
          reject(new Error('WebSocket connection failed'));
        };

        // Connection timeout
        setTimeout(() => {
          if (this.connectionState.status === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        this.updateConnectionState({ 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Normal closure');
    }
    
    this.ws = null;
    this.updateConnectionState({ status: 'disconnected' });
  }

  /**
   * Send session start message
   */
  async startSession(): Promise<void> {
    const message: WebSocketMessage = {
      type: WebSocketMessageType.SESSION_START,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    };
    
    return this.sendMessage(message);
  }

  /**
   * Send session end message
   */
  async endSession(): Promise<void> {
    const message: WebSocketMessage = {
      type: WebSocketMessageType.SESSION_END,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    };
    
    return this.sendMessage(message);
  }

  /**
   * Send audio data as binary message
   */
  async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    if (!this.isConnected()) {
      console.warn('Cannot send audio data: not connected');
      return;
    }

    try {
      this.ws!.send(audioData);
    } catch (error) {
      console.error('Failed to send audio data:', error);
      if (this.onError) {
        this.onError('Failed to send audio data');
      }
    }
  }

  /**
   * Send heartbeat/ping message
   */
  async sendHeartbeat(): Promise<void> {
    const message: WebSocketMessage = {
      type: WebSocketMessageType.HEARTBEAT,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    };
    
    return this.sendMessage(message);
  }

  /**
   * Send JSON message
   */
  private async sendMessage(message: WebSocketMessage): Promise<void> {
    if (!this.isConnected()) {
      // Queue message if not connected
      this.queueMessage(message);
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      this.ws!.send(messageString);
    } catch (error) {
      console.error('Failed to send message:', error);
      if (this.onError) {
        this.onError('Failed to send message');
      }
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Handle binary messages (audio responses in the future)
      if (event.data instanceof ArrayBuffer) {
        console.log('Received binary message:', event.data.byteLength, 'bytes');
        return;
      }

      // Handle text messages (JSON)
      if (typeof event.data === 'string') {
        const message: WebSocketMessage = JSON.parse(event.data);
        // Validate the parsed message before processing
        if (message && typeof message === 'object' && message.type) {
          this.processMessage(message);
        } else {
          console.warn('Received invalid message format:', message);
        }
      }
    } catch (error) {
      console.error('Failed to handle message:', error, 'Raw data:', event.data);
      if (this.onError) {
        this.onError(`Failed to process incoming message: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Process parsed WebSocket message
   */
  private processMessage(message: WebSocketMessage): void {
    // Update session ID if received
    if (message.sessionId && !this.sessionId) {
      this.sessionId = message.sessionId;
    }

    // Handle specific message types
    switch (message.type) {
      case WebSocketMessageType.SESSION_READY:
        console.log('Session ready:', message.sessionId);
        break;
        
      case WebSocketMessageType.TRANSCRIPT_PARTIAL:
      case WebSocketMessageType.TRANSCRIPT_FINAL:
        const transcript = message.payload as TranscriptPayload;
        console.log(`Transcript (${transcript.isFinal ? 'final' : 'partial'}):`, transcript.text);
        break;
        
      case WebSocketMessageType.ASSISTANT_DELTA:
        console.log('Assistant delta:', message.payload);
        break;
        
      case WebSocketMessageType.ASSISTANT_DONE:
        console.log('Assistant response complete:', message.payload);
        break;
        
      case WebSocketMessageType.ERROR:
        const error = message.payload as ErrorPayload;
        console.error('Server error:', error.message);
        if (this.onError) {
          this.onError(error.message);
        }
        break;
        
      case WebSocketMessageType.PONG:
        console.log('Received pong');
        break;
        
      default:
        console.log('Unknown message type:', message.type, message);
    }

    // Notify listeners
    if (this.onMessage) {
      this.onMessage(message);
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    this.messageQueue.push(message);
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message).catch(error => {
          console.error('Failed to send queued message:', error);
        });
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.connectionState.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.connectionState.reconnectAttempts} in ${delay}ms`);
    
    this.updateConnectionState({ 
      status: 'reconnecting',
      error: `Reconnecting... (attempt ${this.connectionState.reconnectAttempts})`
    });

    this.reconnectTimeoutId = setTimeout(() => {
      if (this.url) {
        this.connect(this.url).catch(error => {
          console.error('Reconnection failed:', error);
          
          if (this.connectionState.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            this.updateConnectionState({ 
              status: 'error',
              error: 'Max reconnection attempts reached' 
            });
          }
        });
      }
    }, delay);
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    
    if (this.onStateChange) {
      this.onStateChange(this.connectionState);
    }
  }

  // Public getters and setters
  isConnected(): boolean {
    const connected = this.ws?.readyState === WebSocket.OPEN;
    console.log('WebSocket state check:', {
      wsExists: !!this.ws,
      readyState: this.ws?.readyState,
      readyStateText: this.getReadyStateText(),
      connected
    });
    return connected;
  }

  private getReadyStateText(): string {
    if (!this.ws) return 'NO_WEBSOCKET';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  // Event handler setters
  onConnectionStateChange(handler: (state: ConnectionState) => void): void {
    this.onStateChange = handler;
  }

  onMessageReceived(handler: (message: WebSocketMessage) => void): void {
    this.onMessage = handler;
  }

  onErrorOccurred(handler: (error: string) => void): void {
    this.onError = handler;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.onStateChange = undefined;
    this.onMessage = undefined;
    this.onError = undefined;
    this.messageQueue = [];
  }
}