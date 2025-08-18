import { EventEmitter } from 'events';

/**
 * WebSocket Orchestrator for real-time conversation backend communication
 * 
 * Handles:
 * - Connection management with automatic reconnection
 * - Audio streaming to backend
 * - Real-time transcript and AI response events
 * - Session management
 */
export class WebSocketOrchestrator extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey: string;
  private sessionId: string = '';
  
  // Connection management
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Message queue for offline messages
  private messageQueue: any[] = [];

  constructor(config: { url: string; apiKey: string }) {
    super();
    this.url = config.url;
    this.apiKey = config.apiKey;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    try {
      console.log('🔌 Connecting to WebSocket:', this.url);
      
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      // Setup event handlers
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Generate new session ID
        this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Send session start message
        this.sendMessage({
          type: 'SESSION_START',
          sessionId: this.sessionId,
          payload: {
            apiKey: this.apiKey,
            timestamp: new Date().toISOString()
          }
        });
        
        // Process any queued messages
        this.processMessageQueue();
        
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt reconnection if not a normal close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', 'WebSocket connection error');
      };

    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      throw error;
    }
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.isConnected) {
      console.log('🔌 Disconnecting WebSocket...');
      
      // Send session end message
      this.sendMessage({
        type: 'SESSION_END',
        sessionId: this.sessionId,
        payload: null
      });
      
      this.ws.close(1000, 'Normal closure');
    }
    
    this.isConnected = false;
    this.ws = null;
  }

  /**
   * Send audio chunk to backend
   */
  async sendAudioChunk(audioData: Float32Array): Promise<void> {
    if (!this.isConnected || !this.ws) {
      console.warn('Cannot send audio: WebSocket not connected');
      return;
    }

    try {
      // Convert Float32Array to 16-bit PCM
      const pcmBuffer = new ArrayBuffer(audioData.length * 2);
      const pcmView = new Int16Array(pcmBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        // Convert from [-1, 1] to 16-bit PCM
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        pcmView[i] = sample * 0x7FFF;
      }
      
      this.ws.send(pcmBuffer);
    } catch (error) {
      console.error('❌ Failed to send audio chunk:', error);
      this.emit('error', 'Failed to send audio data');
    }
  }

  /**
   * Send JSON message to backend
   */
  private sendMessage(message: any): void {
    if (!this.isConnected || !this.ws) {
      // Queue message for later
      this.messageQueue.push(message);
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      this.ws.send(messageString);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Handle binary messages (audio responses in future)
      if (event.data instanceof ArrayBuffer) {
        console.log('📥 Received binary data:', event.data.byteLength, 'bytes');
        this.emit('audioResponse', event.data);
        return;
      }

      // Handle text messages (JSON)
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        this.processIncomingMessage(message);
      }
    } catch (error) {
      console.error('❌ Failed to handle message:', error);
    }
  }

  /**
   * Process parsed incoming message
   */
  private processIncomingMessage(message: any): void {
    const { type, payload, sessionId } = message;
    
    // Update session ID if provided
    if (sessionId && sessionId !== this.sessionId) {
      this.sessionId = sessionId;
    }

    switch (type) {
      case 'SESSION_READY':
        console.log('🎯 Session ready:', sessionId);
        this.emit('sessionReady', sessionId);
        break;

      case 'transcript.partial':
        this.emit('transcript', {
          text: payload?.text || '',
          isFinal: false,
          confidence: payload?.confidence || 0.0,
          timestamp: payload?.timestamp || new Date().toISOString()
        });
        break;

      case 'transcript.final':
        this.emit('transcript', {
          text: payload?.text || '',
          isFinal: true,
          confidence: payload?.confidence || 1.0,
          timestamp: payload?.timestamp || new Date().toISOString()
        });
        break;

      case 'assistant.thinking':
        console.log('🤔 AI is thinking...');
        this.emit('aiThinking');
        break;

      case 'assistant.delta':
        this.emit('aiResponse', {
          content: payload?.text || '',
          isComplete: false,
          metadata: payload?.metadata
        });
        break;

      case 'assistant.done':
        console.log('✅ AI response complete');
        this.emit('aiResponse', {
          content: payload?.text || '',
          isComplete: true,
          metadata: payload?.metadata
        });
        break;

      case 'assistant.interrupted':
        console.log('⚡ AI response interrupted');
        this.emit('aiInterrupted');
        break;

      case 'error':
        console.error('❌ Server error:', payload?.message);
        this.emit('error', payload?.message || 'Unknown server error');
        break;

      case 'session.ended':
        console.log('🔚 Session ended');
        this.emit('sessionEnded');
        break;

      default:
        console.log('📥 Unknown message type:', type, payload);
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected) {
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}`);
        this.connect().catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isWSConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Interrupt current AI response
   */
  interruptAI(): void {
    this.sendMessage({
      type: 'INTERRUPT_AI',
      sessionId: this.sessionId,
      payload: null
    });
  }

  /**
   * Clear conversation
   */
  clearConversation(): void {
    this.sendMessage({
      type: 'CLEAR_CONVERSATION',
      sessionId: this.sessionId,
      payload: null
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up WebSocket orchestrator...');
    
    await this.disconnect();
    this.removeAllListeners();
    this.messageQueue = [];
    
    console.log('✅ WebSocket orchestrator cleaned up');
  }
}