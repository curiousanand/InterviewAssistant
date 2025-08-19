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
  
  // Audio chunk counter for logging
  private audioChunkCount = 0;
  
  // Audio batching (deprecated - will be removed when audio source provides 5-second chunks)
  private audioBatchBuffer: Float32Array[] = [];
  private batchStartTime = 0;
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DURATION_MS = 5000; // 5 seconds

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
        
        // Send session start message (must match backend enum)
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

    // Clear batch timer (deprecated - will be removed)
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
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
   * Send 2-second audio chunk to backend in WAV format
   * Audio chunks are now pre-processed to 2-second segments by RealTimeAudioCapture
   */
  async sendAudioChunk(audioData: Float32Array): Promise<void> {
    if (!this.isConnected || !this.ws) {
      console.warn('Cannot send audio: WebSocket not connected');
      return;
    }

    if (!this.sessionId) {
      console.warn('Cannot send audio: Session not initialized');
      return;
    }

    try {
      this.audioChunkCount++;
      
      // Calculate audio duration for logging
      const audioLengthSeconds = (audioData.length / 16000).toFixed(2); // At 16kHz sample rate
      
      console.log(`📤 Sending 2-second audio chunk #${this.audioChunkCount}: ${audioData.length} samples (${audioLengthSeconds}s audio)`);

      // Convert to WAV and send directly (no batching needed)
      const wavBuffer = this.createWAVBuffer(audioData);
      
      console.log(`📤 Converted to WAV: ${wavBuffer.byteLength} bytes`);
      
      if (this.ws && this.isConnected) {
        this.ws.send(wavBuffer);
        console.log(`✅ Audio chunk #${this.audioChunkCount} sent successfully`);
      }
      
    } catch (error) {
      console.error('❌ Failed to send audio chunk:', error);
      this.emit('error', 'Failed to send audio data');
    }
  }


  /**
   * Create WAV format buffer from Float32Array
   * WAV format is more compatible with Azure Speech Service streaming
   */
  private createWAVBuffer(audioData: Float32Array): ArrayBuffer {
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioData.length * bytesPerSample;
    const fileSize = 44 + dataSize; // WAV header is 44 bytes

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const samples = new Int16Array(buffer, 44, audioData.length);

    // WAV header
    // RIFF chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, fileSize - 8, true); // File size minus RIFF header
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, channels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, byteRate, true); // Byte rate
    view.setUint16(32, blockAlign, true); // Block align
    view.setUint16(34, bitsPerSample, true); // Bits per sample

    // data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true); // Data size

    // Convert Float32Array to Int16Array (PCM data)
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      samples[i] = sample * 0x7FFF;
    }

    return buffer;
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
    
    // Clear batch timer (deprecated - will be removed)
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.audioBatchBuffer = [];
    
    await this.disconnect();
    this.removeAllListeners();
    this.messageQueue = [];
    
    console.log('✅ WebSocket orchestrator cleaned up');
  }
}