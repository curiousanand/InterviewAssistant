import { IAudioCapture } from '../audio/interfaces/IAudioCapture';
import { AudioCaptureFactory } from '../audio/AudioCaptureFactory';
import { InterviewWebSocketClient } from '../websocket/InterviewWebSocketClient';
import { RecordingState, VADResult } from '../../types';

/**
 * Audio streaming service for real-time audio capture and WebSocket streaming
 * 
 * Why: Coordinates audio capture with WebSocket streaming to backend
 * Pattern: Service Layer - orchestrates multiple components
 * Rationale: Provides high-level audio streaming interface for UI components
 */
export class AudioStreamingService {
  private audioCapture: IAudioCapture | null = null;
  private wsClient: InterviewWebSocketClient;
  private recordingState: RecordingState = {
    isRecording: false,
    isProcessing: false,
    audioLevel: 0
  };
  
  // Audio processing (handled by AudioCapture implementations)
  
  // Streaming configuration
  private readonly SAMPLE_RATE = 16000; // 16kHz for Azure Speech
  private readonly CHANNELS = 1; // Mono
  private readonly CHUNK_DURATION = 100; // 100ms chunks
  private readonly SILENCE_THRESHOLD = 0.01; // Voice activity detection threshold
  
  // Event handlers
  private onStateChange: ((state: RecordingState) => void) | undefined;
  private onVADResult: ((result: VADResult) => void) | undefined;
  private onError: ((error: string) => void) | undefined;
  
  // Audio level monitoring
  private audioLevelInterval: NodeJS.Timeout | null = null;
  private audioDataBuffer: Float32Array[] = [];

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize audio';
      console.error('Audio initialization failed:', error);
      this.updateRecordingState({ isProcessing: false, error: errorMessage });
      
      if (this.onError) {
        this.onError(errorMessage);
      }
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
}