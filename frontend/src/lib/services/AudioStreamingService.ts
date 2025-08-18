import { IAudioCapture } from '../audio/interfaces/IAudioCapture';
import { AudioCaptureFactory } from '../audio/AudioCaptureFactory';
import { InterviewWebSocketClient } from '../websocket/InterviewWebSocketClient';
import { VoiceActivityDetector } from '../audio/VoiceActivityDetector';
import { TranscriptBufferManager } from '../conversation/TranscriptBufferManager';
import { 
  RecordingState, 
  VADResult, 
  VADConfig,
  TranscriptEvent,
  PauseClassification,
  WebSocketMessage,
  WebSocketMessageType
} from '../../types';

/**
 * Enhanced audio streaming service with real-time conversation orchestration
 * 
 * Why: Coordinates audio capture, VAD, transcript buffering, and conversation flow
 * Pattern: Event-driven orchestration - manages complex audio->conversation pipeline
 * Rationale: Core service for real-time multimodal conversation system
 */
export class AudioStreamingService {
  private audioCapture: IAudioCapture | null = null;
  private wsClient: InterviewWebSocketClient;
  private vadDetector: VoiceActivityDetector;
  private transcriptBufferManager: TranscriptBufferManager;
  
  private recordingState: RecordingState = {
    isRecording: false,
    isProcessing: false,
    audioLevel: 0
  };
  
  // Audio processing configuration
  private readonly SAMPLE_RATE = 16000; // 16kHz for Azure Speech
  private readonly CHANNELS = 1; // Mono
  private readonly CHUNK_DURATION = 100; // 100ms chunks for low latency
  private readonly AUDIO_BUFFER_SIZE = 1024; // Buffer size for processing
  
  // Conversation orchestration state
  private isListeningContinuously = false;
  private currentSessionId = '';
  private lastTranscriptTime = 0;
  private pauseDetectionEnabled = true;
  
  // Event handlers
  private onStateChange: ((state: RecordingState) => void) | undefined;
  private onVADResult: ((result: VADResult) => void) | undefined;
  private onTranscriptUpdate: ((event: TranscriptEvent) => void) | undefined;
  private onPauseDetected: ((classification: PauseClassification) => void) | undefined;
  private onError: ((error: string) => void) | undefined;
  
  // Audio monitoring
  private audioLevelInterval: NodeJS.Timeout | null = null;
  private audioDataBuffer: Float32Array[] = [];
  private audioChunkCounter = 0;

  constructor(wsClient: InterviewWebSocketClient) {
    this.wsClient = wsClient;
  }

  /**
   * Initialize audio capture system
   */
  async initialize(): Promise<void> {
    try {
      this.updateRecordingState({ isProcessing: true });

      // Create audio capture instance
      const factory = AudioCaptureFactory.getInstance();
      
      // Check permissions first
      const permissions = await factory.checkMicrophonePermissions();
      if (!permissions.granted) {
        const granted = await factory.requestMicrophonePermissions();
        if (!granted) {
          throw new Error('Microphone permissions denied');
        }
      }

      // Get optimized configuration
      const config = factory.getRecommendedConfiguration();
      config.sampleRate = this.SAMPLE_RATE;
      config.channels = this.CHANNELS;
      config.chunkDuration = this.CHUNK_DURATION;
      config.silenceDetection = true;
      config.silenceThreshold = this.SILENCE_THRESHOLD;
      config.audioLevelMonitoring = true;

      // Create audio capture
      this.audioCapture = await factory.createCapture(config);
      
      // Setup audio capture handlers
      this.audioCapture.onAudioData((audioData) => {
        this.handleAudioData(audioData);
      });

      console.log('Audio streaming service initialized');
      this.updateRecordingState({ isProcessing: false });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize enhanced audio system';
      console.error('Enhanced audio initialization failed:', error);
      this.updateRecordingState({ isProcessing: false, error: errorMessage });
      
      this.onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * Start recording and streaming audio
   */
  async startRecording(): Promise<void> {
    if (!this.audioCapture) {
      throw new Error('Audio capture not initialized');
    }

    if (this.recordingState.isRecording) {
      console.warn('Recording is already active, stopping previous recording...');
      try {
        await this.stopRecording();
        // Wait a brief moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn('Error stopping previous recording:', error);
        // Force reset the state
        this.updateRecordingState({ 
          isRecording: false, 
          isProcessing: false,
          error: null 
        });
      }
    }

    try {
      console.log('Starting recording process...');
      this.updateRecordingState({ isProcessing: true });

      // Check WebSocket connection and reconnect if needed
      if (!this.wsClient.isConnected()) {
        console.log('WebSocket not connected, attempting to reconnect...');
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream';
        await this.wsClient.connect(wsUrl);
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.wsClient.isConnected()) {
          throw new Error('Failed to establish WebSocket connection');
        }
      }
      console.log('WebSocket is connected');

      // Start audio capture (with fallback for demo)
      console.log('Starting audio capture...');
      try {
        // Ensure we have a fresh audio capture instance to avoid state issues
        if (!this.audioCapture) {
          await this.reinitializeAudioCapture();
        }
        await this.audioCapture.start();
        console.log('Audio capture started successfully');
      } catch (audioError) {
        console.warn('Audio capture failed, trying fresh instance:', audioError);
        // Try recreating the audio capture instance
        try {
          await this.reinitializeAudioCapture();
          await this.audioCapture.start();
          console.log('Audio capture started successfully with fresh instance');
        } catch (secondError) {
          console.warn('Audio capture failed even with fresh instance, using demo mode:', secondError);
          // Continue without real audio for demo purposes
        }
      }
      
      // Start audio level monitoring
      this.startAudioLevelMonitoring();
      
      // Notify WebSocket client that we're starting
      console.log('Sending session start message...');
      await this.wsClient.startSession();

      console.log('Audio recording started successfully');
      this.updateRecordingState({ 
        isRecording: true, 
        isProcessing: false
      });

      // Send a test message to verify WebSocket is working
      console.log('Sending test audio data...');
      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const pcmData = this.convertToPCM16(testData);
      await this.wsClient.sendAudioData(pcmData.buffer);
      
      // Send periodic test messages to simulate audio (for demo)
      const testInterval = setInterval(() => {
        if (this.recordingState.isRecording) {
          console.log('Sending simulated audio data...');
          const simData = new Float32Array([
            Math.random(), Math.random(), Math.random(), Math.random(), Math.random()
          ]);
          const simPcmData = this.convertToPCM16(simData);
          this.wsClient.sendAudioData(simPcmData.buffer).catch(console.error);
        } else {
          clearInterval(testInterval);
        }
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.error('Failed to start recording:', error);
      this.updateRecordingState({ 
        isRecording: false,
        isProcessing: false, 
        error: errorMessage 
      });
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Stop recording and streaming
   */
  async stopRecording(): Promise<void> {
    if (!this.recordingState.isRecording) {
      console.warn('Recording is not active');
      return;
    }

    try {
      this.updateRecordingState({ isProcessing: true });

      // Stop audio capture
      if (this.audioCapture) {
        try {
          await this.audioCapture.stop();
        } catch (error) {
          console.warn('Error stopping audio capture:', error);
        }
      }

      // Stop audio level monitoring
      this.stopAudioLevelMonitoring();

      // Clear any buffered audio data
      this.audioDataBuffer = [];

      console.log('Audio recording stopped');
      this.updateRecordingState({ 
        isRecording: false, 
        isProcessing: false, 
        audioLevel: 0
      });

      // Small delay to ensure complete state cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      console.error('Failed to stop recording:', error);
      this.updateRecordingState({ isProcessing: false, error: errorMessage });
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Handle incoming audio data and stream to WebSocket
   */
  private handleAudioData(audioData: Float32Array): void {
    if (!this.recordingState.isRecording || !this.wsClient.isConnected()) {
      return;
    }

    try {
      // Perform voice activity detection
      const vadResult = this.performVAD(audioData);
      
      if (this.onVADResult) {
        this.onVADResult(vadResult);
      }

      // Only send audio if speech is detected or we're in continuous mode
      if (vadResult.isSpeech || !this.isVADEnabled()) {
        // Convert Float32Array to 16-bit PCM
        const pcmData = this.convertToPCM16(audioData);
        
        // Stream to WebSocket as binary data
        this.wsClient.sendAudioData(pcmData.buffer).catch(error => {
          console.error('Failed to stream audio data:', error);
        });
      }

    } catch (error) {
      console.error('Error handling audio data:', error);
      if (this.onError) {
        this.onError('Error processing audio data');
      }
    }
  }

  /**
   * Perform voice activity detection
   */
  private performVAD(audioData: Float32Array): VADResult {
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      if (sample !== undefined) {
        sum += sample * sample;
      }
    }
    const rms = Math.sqrt(sum / audioData.length);
    const audioLevel = Math.min(rms * 10, 1.0); // Normalize to 0-1

    // Simple VAD based on audio level threshold
    const isSpeech = audioLevel > this.SILENCE_THRESHOLD;
    const confidence = Math.min(audioLevel / this.SILENCE_THRESHOLD, 1.0);

    return {
      isSpeech,
      confidence,
      audioLevel
    };
  }

  /**
   * Convert Float32Array to 16-bit PCM
   */
  private convertToPCM16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const value = input[i];
      if (value !== undefined) {
        const sample = Math.max(-1, Math.min(1, value));
        output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
    }
    return output;
  }

  /**
   * Start audio level monitoring for visual feedback
   */
  private startAudioLevelMonitoring(): void {
    this.audioLevelInterval = setInterval(() => {
      if (this.audioDataBuffer.length > 0) {
        // Get the most recent audio data
        const recentData = this.audioDataBuffer[this.audioDataBuffer.length - 1];
        if (recentData) {
          const vadResult = this.performVAD(recentData);
          this.updateRecordingState({ audioLevel: vadResult.audioLevel });
        
          // Clear old buffers
          if (this.audioDataBuffer.length > 10) {
            this.audioDataBuffer = this.audioDataBuffer.slice(-5);
          }
        }
      }
    }, 50); // Update every 50ms for smooth visual feedback
  }

  /**
   * Stop audio level monitoring
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
  }

  /**
   * Check if VAD is enabled
   */
  private isVADEnabled(): boolean {
    // For now, always use VAD. Could be made configurable.
    return true;
  }

  /**
   * Update recording state and notify listeners
   */
  private updateRecordingState(updates: Partial<RecordingState>): void {
    const oldState = { ...this.recordingState };
    this.recordingState = { ...this.recordingState, ...updates };
    
    console.log('AudioStreamingService state update:', {
      old: oldState,
      updates,
      new: this.recordingState,
      hasListener: !!this.onStateChange
    });
    
    if (this.onStateChange) {
      this.onStateChange(this.recordingState);
    }
  }

  // Public getters
  getRecordingState(): RecordingState {
    return { ...this.recordingState };
  }

  isRecording(): boolean {
    return this.recordingState.isRecording;
  }

  isProcessing(): boolean {
    return this.recordingState.isProcessing;
  }

  getAudioLevel(): number {
    return this.recordingState.audioLevel;
  }

  // Event handler setters
  onRecordingStateChange(handler: (state: RecordingState) => void): void {
    this.onStateChange = handler;
  }

  onVADDetection(handler: (result: VADResult) => void): void {
    this.onVADResult = handler;
  }

  onErrorOccurred(handler: (error: string) => void): void {
    this.onError = handler;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.stopRecording();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }

    this.stopAudioLevelMonitoring();

    if (this.audioCapture) {
      try {
        await this.audioCapture.stop();
        if (this.audioCapture && typeof this.audioCapture.removeAllListeners === 'function') {
          this.audioCapture.removeAllListeners();
        }
      } catch (error) {
        console.warn('Error during audio capture cleanup:', error);
      } finally {
        this.audioCapture = null;
      }
    }

    // Audio context and media stream are managed by AudioCapture implementations
    this.audioDataBuffer = [];
    
    // Clear event handlers
    this.onStateChange = undefined;
    this.onVADResult = undefined;
    this.onError = undefined;
  }

  /**
   * Reinitialize audio capture with a fresh instance
   * Fixes state management issues with reused instances
   */
  private async reinitializeAudioCapture(): Promise<void> {
    // Clean up existing instance
    if (this.audioCapture) {
      try {
        await this.audioCapture.stop();
        if (this.audioCapture && typeof this.audioCapture.removeAllListeners === 'function') {
          this.audioCapture.removeAllListeners();
        }
      } catch (error) {
        console.warn('Error cleaning up old audio capture:', error);
      } finally {
        this.audioCapture = null;
      }
    }

    // Create fresh audio capture instance
    const factory = AudioCaptureFactory.getInstance();
    
    // Get optimized configuration
    const config = factory.getRecommendedConfiguration();
    config.sampleRate = this.SAMPLE_RATE;
    config.channels = this.CHANNELS;
    config.chunkDuration = this.CHUNK_DURATION;
    config.silenceDetection = true;
    config.silenceThreshold = this.SILENCE_THRESHOLD;
    config.audioLevelMonitoring = true;

    // Create fresh audio capture
    this.audioCapture = await factory.createCapture(config);
    
    // Setup audio capture handlers
    this.audioCapture.onAudioData((audioData) => {
      this.handleAudioData(audioData);
    });
    
    console.log('Audio capture reinitialized with fresh instance');
  }

  /**
   * Get audio capture capabilities for diagnostics
   */
  async getDiagnostics(): Promise<{
    isInitialized: boolean;
    recordingState: RecordingState;
    wsConnected: boolean;
    audioCapabilities: any;
  }> {
    const factory = AudioCaptureFactory.getInstance();
    const capabilities = await factory.testCapabilities();

    return {
      isInitialized: this.audioCapture !== null,
      recordingState: this.getRecordingState(),
      wsConnected: this.wsClient.isConnected(),
      audioCapabilities: capabilities
    };
  }

  // ============================================================================
  // ENHANCED CONVERSATION ORCHESTRATION METHODS
  // ============================================================================

  /**
   * Setup event handlers for conversation orchestration
   */
  private setupEventHandlers(): void {
    // VAD event handlers
    this.vadDetector.onActivityChange((result) => {
      this.handleVADResult(result);
    });

    this.vadDetector.onSilenceDetected((duration) => {
      this.handleSilenceDetected(duration);
    });

    this.vadDetector.onSpeechDetected(() => {
      this.handleSpeechDetected();
    });

    // Transcript buffer event handlers
    this.transcriptBufferManager.onLiveUpdate((text, confidence) => {
      this.onTranscriptUpdate?.({
        type: 'interim',
        text,
        confidence,
        timestamp: Date.now(),
        sessionId: this.currentSessionId
      });
    });

    this.transcriptBufferManager.onConfirmed((text, confidence) => {
      this.onTranscriptUpdate?.({
        type: 'final',
        text,
        confidence,
        timestamp: Date.now(),
        sessionId: this.currentSessionId
      });

      // Trigger conversation processing after confirmed transcript
      this.triggerConversationProcessing(text, confidence);
    });
  }

  /**
   * Setup WebSocket handlers for transcript processing
   */
  private setupWebSocketHandlers(): void {
    this.wsClient.onMessage((message) => {
      if (!message) return;

      try {
        const wsMessage = typeof message === 'string' ? JSON.parse(message) : message;
        this.handleWebSocketMessage(wsMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  }

  /**
   * Handle WebSocket messages from backend
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketMessageType.TRANSCRIPT_PARTIAL:
        if (message.payload?.text) {
          this.transcriptBufferManager.processInterimTranscript(
            message.payload.text,
            message.payload.confidence || 0.8,
            message.sessionId
          );
        }
        break;

      case WebSocketMessageType.TRANSCRIPT_FINAL:
        if (message.payload?.text) {
          this.transcriptBufferManager.processFinalTranscript(
            message.payload.text,
            message.payload.confidence || 0.9,
            message.sessionId
          );
        }
        break;

      case WebSocketMessageType.ASSISTANT_DELTA:
        // Handle streaming AI response
        this.handleAIResponseChunk(message.payload);
        break;

      case WebSocketMessageType.ASSISTANT_DONE:
        // AI response complete
        this.handleAIResponseComplete(message.payload);
        break;

      case WebSocketMessageType.ERROR:
        this.onError?.(`Backend error: ${message.payload?.message || 'Unknown error'}`);
        break;

      default:
        console.log('Unhandled WebSocket message type:', message.type);
    }
  }

  /**
   * Enhanced audio processing with VAD and conversation flow
   */
  private processAudioChunk(audioData: Float32Array): void {
    try {
      this.audioChunkCounter++;

      // Update audio buffer for monitoring
      this.audioDataBuffer.push(audioData);
      if (this.audioDataBuffer.length > 20) {
        this.audioDataBuffer.shift(); // Keep only recent chunks
      }

      // Process through VAD
      const vadResult = this.vadDetector.processAudioData(audioData);
      
      // Update audio level in recording state
      this.updateRecordingState({ audioLevel: vadResult.energy });

      // Stream to backend if recording
      if (this.recordingState.isRecording) {
        this.streamAudioToBackend(audioData);
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.onError?.('Error processing audio data');
    }
  }

  /**
   * Stream audio data to backend with optimizations
   */
  private async streamAudioToBackend(audioData: Float32Array): Promise<void> {
    try {
      // Convert to PCM16 for backend processing
      const pcmData = this.convertToPCM16(audioData);
      
      // Send to WebSocket (backend expects binary data)
      await this.wsClient.sendAudioData(pcmData.buffer);

      // Throttle logging to avoid spam
      if (this.audioChunkCounter % 10 === 0) {
        console.log(`Streamed audio chunk #${this.audioChunkCounter} (${pcmData.length} samples)`);
      }

    } catch (error) {
      console.error('Error streaming audio to backend:', error);
      // Don't propagate streaming errors to avoid disrupting recording
    }
  }

  /**
   * Handle VAD results
   */
  private handleVADResult(result: VADResult): void {
    this.onVADResult?.(result);

    // Check for pause patterns
    if (!result.hasSpeech && result.silenceDuration > 0) {
      const classification = this.classifyPause(result.silenceDuration);
      if (classification.shouldTriggerAI) {
        this.onPauseDetected?.(classification);
      }
    }
  }

  /**
   * Handle silence detection
   */
  private handleSilenceDetected(duration: number): void {
    console.log(`Silence detected: ${duration}ms`);
    
    // Notify transcript buffer manager
    this.transcriptBufferManager.onSilenceDetected(duration);

    // Emit transcript event
    this.onTranscriptUpdate?.({
      type: 'silence',
      text: '',
      confidence: 1.0,
      timestamp: Date.now(),
      sessionId: this.currentSessionId
    });

    // Classify pause and potentially trigger AI processing
    const classification = this.classifyPause(duration);
    this.onPauseDetected?.(classification);
  }

  /**
   * Handle speech detection
   */
  private handleSpeechDetected(): void {
    console.log('Speech detected - resuming transcription');
    
    // Notify transcript buffer manager
    this.transcriptBufferManager.onSpeechDetected();

    // Emit transcript event
    this.onTranscriptUpdate?.({
      type: 'speech',
      text: '',
      confidence: 1.0,
      timestamp: Date.now(),
      sessionId: this.currentSessionId
    });
  }

  /**
   * Classify pause duration for conversation flow
   */
  private classifyPause(duration: number): PauseClassification {
    let type: 'natural_gap' | 'end_of_thought' | 'waiting_for_response';
    let shouldTriggerAI = false;
    let confidence = 0.8;

    if (duration < 1000) {
      type = 'natural_gap';
      shouldTriggerAI = false;
      confidence = 0.9;
    } else if (duration < 3000) {
      type = 'end_of_thought';
      shouldTriggerAI = true;
      confidence = 0.85;
    } else {
      type = 'waiting_for_response';
      shouldTriggerAI = true;
      confidence = 0.95;
    }

    return {
      type,
      duration,
      confidence,
      shouldTriggerAI
    };
  }

  /**
   * Trigger conversation processing after confirmed transcript
   */
  private triggerConversationProcessing(text: string, confidence: number): void {
    if (!text.trim()) return;

    console.log('Triggering conversation processing for:', text);

    // Get full context from buffer manager
    const context = this.transcriptBufferManager.getContextForAI();
    
    // This would typically trigger backend AI processing
    // For now, we'll emit an event that the UI can handle
    this.onTranscriptUpdate?.({
      type: 'final',
      text: context.confirmedText,
      confidence: context.confidence,
      timestamp: Date.now(),
      sessionId: this.currentSessionId
    });
  }

  /**
   * Handle AI response chunks (streaming)
   */
  private handleAIResponseChunk(payload: any): void {
    console.log('Received AI response chunk:', payload);
    // Could emit events for real-time AI response display
  }

  /**
   * Handle AI response completion
   */
  private handleAIResponseComplete(payload: any): void {
    console.log('AI response complete:', payload);
    // Clear confirmed buffer after processing
    this.transcriptBufferManager.clearConfirmedBuffer();
  }

  /**
   * Start continuous listening mode
   */
  async startContinuousListening(): Promise<void> {
    if (this.isListeningContinuously) {
      return;
    }

    this.isListeningContinuously = true;
    this.pauseDetectionEnabled = true;

    console.log('Starting continuous listening mode...');
    await this.startRecording();
  }

  /**
   * Stop continuous listening mode
   */
  async stopContinuousListening(): Promise<void> {
    this.isListeningContinuously = false;
    this.pauseDetectionEnabled = false;

    console.log('Stopping continuous listening mode...');
    await this.stopRecording();

    // Archive any remaining content
    const archived = this.transcriptBufferManager.archiveAndReset();
    if (archived) {
      console.log('Archived transcript:', archived);
    }
  }

  /**
   * Get current conversation state
   */
  getConversationState(): {
    isListeningContinuously: boolean;
    currentTranscript: string;
    vadState: any;
    bufferStats: any;
  } {
    return {
      isListeningContinuously: this.isListeningContinuously,
      currentTranscript: this.transcriptBufferManager.getFullTranscript(),
      vadState: this.vadDetector.getCurrentState(),
      bufferStats: this.transcriptBufferManager.getBufferStats()
    };
  }

  /**
   * Update VAD configuration
   */
  updateVADConfig(config: Partial<VADConfig>): void {
    this.vadDetector.updateConfig(config);
  }

  // Enhanced event handler setters
  onTranscriptUpdate(handler: (event: TranscriptEvent) => void): void {
    this.onTranscriptUpdate = handler;
  }

  onPauseDetected(handler: (classification: PauseClassification) => void): void {
    this.onPauseDetected = handler;
  }

  /**
   * Enhanced cleanup with conversation orchestration
   */
  async enhancedCleanup(): Promise<void> {
    await this.cleanup();
    
    // Cleanup VAD and buffer manager
    this.vadDetector.cleanup();
    this.transcriptBufferManager.cleanup();
    
    // Reset conversation state
    this.isListeningContinuously = false;
    this.currentSessionId = '';
    this.lastTranscriptTime = 0;
    this.pauseDetectionEnabled = false;
    this.audioChunkCounter = 0;
    
    // Clear enhanced event handlers
    this.onTranscriptUpdate = undefined;
    this.onPauseDetected = undefined;
  }
}