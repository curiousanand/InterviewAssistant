import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * Audio Workflow Service
 * 
 * Why: Manages the complete audio processing pipeline from capture to transmission
 * Pattern: Workflow Pattern - orchestrates multiple audio-related operations
 * Rationale: Provides unified interface for audio capture, processing, and streaming
 */

interface AudioWorkflowConfig {
  chunkSize: number; // Audio chunk size in milliseconds
  sampleRate: number; // Audio sample rate
  channels: number; // Number of audio channels
  bitDepth: number; // Audio bit depth
  enableVAD: boolean; // Voice Activity Detection
  vadThreshold: number; // VAD sensitivity threshold
  silenceTimeout: number; // Timeout for silence detection (ms)
  maxRecordingDuration: number; // Maximum recording duration (ms)
  enableNoiseReduction: boolean; // Enable noise reduction
  enableEchoCancellation: boolean; // Enable echo cancellation
  enableAutoGainControl: boolean; // Enable automatic gain control
}

interface AudioChunk {
  id: string;
  data: Float32Array;
  timestamp: Date;
  duration: number; // Duration in milliseconds
  sampleRate: number;
  channels: number;
  sequenceNumber: number;
  isVoiceActive: boolean;
  volume: number; // RMS volume level
}

interface AudioStreamMetrics {
  totalChunks: number;
  totalBytes: number;
  averageVolume: number;
  voiceActivityPercentage: number;
  streamDuration: number;
  droppedChunks: number;
  qualityScore: number; // 0-1 quality rating
}

interface VADResult {
  isVoiceActive: boolean;
  confidence: number;
  speechProbability: number;
  noiseLevel: number;
}

interface AudioWorkflowEvents {
  onChunkProcessed: (chunk: AudioChunk) => void;
  onVoiceActivityDetected: (isActive: boolean, confidence: number) => void;
  onSilenceDetected: (duration: number) => void;
  onStreamStarted: () => void;
  onStreamStopped: (metrics: AudioStreamMetrics) => void;
  onError: (error: AudioWorkflowError) => void;
  onQualityChanged: (score: number) => void;
}

interface AudioWorkflowError {
  type: AudioErrorType;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  context?: any;
}

enum AudioErrorType {
  DEVICE_NOT_FOUND = 'device_not_found',
  PERMISSION_DENIED = 'permission_denied',
  DEVICE_BUSY = 'device_busy',
  PROCESSING_ERROR = 'processing_error',
  NETWORK_ERROR = 'network_error',
  QUALITY_TOO_LOW = 'quality_too_low',
  BUFFER_OVERFLOW = 'buffer_overflow',
  UNKNOWN = 'unknown'
}

enum WorkflowState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  STREAMING = 'streaming',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
}

export class AudioWorkflowService {
  private webSocketClient: IWebSocketClient;
  private config: AudioWorkflowConfig;
  private events: Partial<AudioWorkflowEvents>;
  
  // Audio processing components
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  
  // State management
  private state: WorkflowState = WorkflowState.IDLE;
  private isStreaming: boolean = false;
  private chunkCounter: number = 0;
  private streamStartTime: number = 0;
  
  // Audio buffers and processing
  private audioBuffer: Float32Array[] = [];
  private targetChunkSamples: number = 0;
  private vadHistory: boolean[] = [];
  private volumeHistory: number[] = [];
  private silenceStartTime: number = 0;
  
  // Metrics tracking
  private metrics: AudioStreamMetrics = this.initializeMetrics();
  
  // Voice Activity Detection
  private vadProcessor: VoiceActivityDetector;
  
  constructor(
    webSocketClient: IWebSocketClient,
    config: Partial<AudioWorkflowConfig> = {},
    events: Partial<AudioWorkflowEvents> = {}
  ) {
    this.webSocketClient = webSocketClient;
    this.config = {
      chunkSize: 100, // 100ms chunks
      sampleRate: 16000, // 16kHz
      channels: 1, // Mono
      bitDepth: 16,
      enableVAD: true,
      vadThreshold: 0.3,
      silenceTimeout: 2000, // 2 seconds
      maxRecordingDuration: 300000, // 5 minutes
      enableNoiseReduction: true,
      enableEchoCancellation: true,
      enableAutoGainControl: true,
      ...config
    };
    this.events = events;
    
    this.vadProcessor = new VoiceActivityDetector(this.config.vadThreshold);
    this.calculateTargetChunkSamples();
  }

  /**
   * Start the audio workflow
   */
  async startWorkflow(): Promise<void> {
    try {
      this.setState(WorkflowState.INITIALIZING);
      
      // Initialize audio context
      await this.initializeAudioContext();
      
      // Request microphone access
      const stream = await this.requestMicrophoneAccess();
      
      // Setup audio processing pipeline
      await this.setupAudioPipeline(stream);
      
      // Start recording and streaming
      this.setState(WorkflowState.RECORDING);
      this.startStreaming();
      
      this.streamStartTime = performance.now();
      this.events.onStreamStarted?.();
      
    } catch (error) {
      this.handleError(
        this.mapErrorType(error),
        `Failed to start audio workflow: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error
      );
    }
  }

  /**
   * Stop the audio workflow
   */
  async stopWorkflow(): Promise<AudioStreamMetrics> {
    try {
      this.setState(WorkflowState.STOPPED);
      this.isStreaming = false;
      
      // Stop audio processing
      if (this.processorNode) {
        this.processorNode.disconnect();
        this.processorNode = null;
      }
      
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      // Calculate final metrics
      this.finalizeMetrics();
      
      // Cleanup audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      this.events.onStreamStopped?.(this.metrics);
      return this.metrics;
      
    } catch (error) {
      this.handleError(
        AudioErrorType.PROCESSING_ERROR,
        `Error stopping workflow: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error
      );
      
      return this.metrics;
    }
  }

  /**
   * Pause the audio workflow
   */
  pauseWorkflow(): void {
    if (this.state === WorkflowState.RECORDING) {
      this.setState(WorkflowState.PAUSED);
      this.isStreaming = false;
    }
  }

  /**
   * Resume the audio workflow
   */
  resumeWorkflow(): void {
    if (this.state === WorkflowState.PAUSED) {
      this.setState(WorkflowState.RECORDING);
      this.isStreaming = true;
    }
  }

  /**
   * Get current state
   */
  getState(): WorkflowState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): AudioStreamMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<AudioWorkflowConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.calculateTargetChunkSamples();
    
    if (this.vadProcessor) {
      this.vadProcessor.updateThreshold(this.config.vadThreshold);
    }
  }

  // Private implementation methods

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
    } catch (error) {
      throw new Error(`Failed to initialize audio context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: this.config.enableEchoCancellation,
          noiseSuppression: this.config.enableNoiseReduction,
          autoGainControl: this.config.enableAutoGainControl
        }
      };
      
      return await navigator.mediaDevices.getUserMedia(constraints);
      
    } catch (error) {
      const errorType = error instanceof Error && error.name === 'NotAllowedError' 
        ? AudioErrorType.PERMISSION_DENIED 
        : AudioErrorType.DEVICE_NOT_FOUND;
        
      throw new Error(`Microphone access failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setupAudioPipeline(stream: MediaStream): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      
      // Create analyser for monitoring
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      
      // Create processor node for audio processing
      this.processorNode = this.audioContext.createScriptProcessor(2048, this.config.channels, this.config.channels);
      this.processorNode.onaudioprocess = this.handleAudioProcess.bind(this);
      
      // Connect the pipeline
      this.sourceNode
        .connect(this.gainNode)
        .connect(this.analyserNode)
        .connect(this.processorNode)
        .connect(this.audioContext.destination);
        
    } catch (error) {
      throw new Error(`Failed to setup audio pipeline: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.isStreaming || this.state !== WorkflowState.RECORDING) {
      return;
    }

    try {
      const inputData = event.inputBuffer.getChannelData(0);
      const audioData = new Float32Array(inputData);
      
      // Add to buffer
      this.audioBuffer.push(audioData);
      
      // Calculate volume
      const volume = this.calculateRMSVolume(audioData);
      this.volumeHistory.push(volume);
      
      // Keep volume history manageable
      if (this.volumeHistory.length > 100) {
        this.volumeHistory.shift();
      }
      
      // Process accumulated chunks
      this.processAccumulatedChunks();
      
    } catch (error) {
      this.handleError(
        AudioErrorType.PROCESSING_ERROR,
        `Audio processing error: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error
      );
    }
  }

  private processAccumulatedChunks(): void {
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    
    if (totalSamples >= this.targetChunkSamples) {
      // Combine buffer chunks
      const combinedChunk = new Float32Array(this.targetChunkSamples);
      let offset = 0;
      
      for (const chunk of this.audioBuffer) {
        const samplesNeeded = this.targetChunkSamples - offset;
        const samplesToCopy = Math.min(chunk.length, samplesNeeded);
        
        combinedChunk.set(chunk.subarray(0, samplesToCopy), offset);
        offset += samplesToCopy;
        
        if (offset >= this.targetChunkSamples) {
          break;
        }
      }
      
      // Remove processed samples from buffer
      const totalProcessed = this.targetChunkSamples;
      let remaining = totalProcessed;
      
      while (remaining > 0 && this.audioBuffer.length > 0) {
        const firstChunk = this.audioBuffer[0];
        
        if (firstChunk.length <= remaining) {
          this.audioBuffer.shift();
          remaining -= firstChunk.length;
        } else {
          this.audioBuffer[0] = firstChunk.subarray(remaining);
          remaining = 0;
        }
      }
      
      // Process the chunk
      this.processAudioChunk(combinedChunk);
    }
  }

  private processAudioChunk(audioData: Float32Array): void {
    try {
      // Calculate volume
      const volume = this.calculateRMSVolume(audioData);
      
      // Voice Activity Detection
      const vadResult = this.vadProcessor.process(audioData, this.config.sampleRate);
      
      // Track VAD history
      this.vadHistory.push(vadResult.isVoiceActive);
      if (this.vadHistory.length > 50) {
        this.vadHistory.shift();
      }
      
      // Handle silence detection
      this.handleSilenceDetection(vadResult.isVoiceActive);
      
      // Create audio chunk
      const chunk: AudioChunk = {
        id: this.generateChunkId(),
        data: audioData,
        timestamp: new Date(),
        duration: this.config.chunkSize,
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        sequenceNumber: this.chunkCounter++,
        isVoiceActive: vadResult.isVoiceActive,
        volume: volume
      };
      
      // Update metrics
      this.updateChunkMetrics(chunk, vadResult);
      
      // Emit events
      this.events.onChunkProcessed?.(chunk);
      this.events.onVoiceActivityDetected?.(vadResult.isVoiceActive, vadResult.confidence);
      
      // Send chunk over WebSocket if voice is active or VAD is disabled
      if (!this.config.enableVAD || vadResult.isVoiceActive) {
        this.sendAudioChunk(chunk);
      }
      
    } catch (error) {
      this.handleError(
        AudioErrorType.PROCESSING_ERROR,
        `Chunk processing error: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error
      );
    }
  }

  private async sendAudioChunk(chunk: AudioChunk): Promise<void> {
    try {
      if (!this.webSocketClient.isConnected()) {
        this.metrics.droppedChunks++;
        return;
      }

      // Convert Float32Array to PCM16
      const pcmData = this.convertToPCM16(chunk.data);
      
      // Send as binary WebSocket message
      await this.webSocketClient.sendBinary(pcmData.buffer);
      
      this.metrics.totalBytes += pcmData.byteLength;
      
    } catch (error) {
      this.metrics.droppedChunks++;
      this.handleError(
        AudioErrorType.NETWORK_ERROR,
        `Failed to send audio chunk: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error
      );
    }
  }

  private convertToPCM16(audioData: Float32Array): Int16Array {
    const pcmData = new Int16Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = sample * 0x7FFF;
    }
    
    return pcmData;
  }

  private calculateRMSVolume(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private handleSilenceDetection(isVoiceActive: boolean): void {
    const now = performance.now();
    
    if (!isVoiceActive) {
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = now;
      } else {
        const silenceDuration = now - this.silenceStartTime;
        if (silenceDuration >= this.config.silenceTimeout) {
          this.events.onSilenceDetected?.(silenceDuration);
          this.silenceStartTime = 0;
        }
      }
    } else {
      this.silenceStartTime = 0;
    }
  }

  private updateChunkMetrics(chunk: AudioChunk, vadResult: VADResult): void {
    this.metrics.totalChunks++;
    
    // Update average volume
    this.metrics.averageVolume = ((this.metrics.averageVolume * (this.metrics.totalChunks - 1)) + chunk.volume) / this.metrics.totalChunks;
    
    // Update voice activity percentage
    const voiceActiveCount = this.vadHistory.filter(active => active).length;
    this.metrics.voiceActivityPercentage = this.vadHistory.length > 0 ? voiceActiveCount / this.vadHistory.length : 0;
    
    // Calculate quality score
    this.metrics.qualityScore = this.calculateQualityScore(vadResult, chunk.volume);
    this.events.onQualityChanged?.(this.metrics.qualityScore);
  }

  private calculateQualityScore(vadResult: VADResult, volume: number): number {
    // Quality based on confidence, volume, and noise level
    const volumeScore = Math.min(volume * 5, 1); // Normalize volume
    const confidenceScore = vadResult.confidence;
    const noiseScore = Math.max(0, 1 - vadResult.noiseLevel);
    
    return (volumeScore + confidenceScore + noiseScore) / 3;
  }

  private updateMetrics(): void {
    if (this.streamStartTime > 0) {
      this.metrics.streamDuration = performance.now() - this.streamStartTime;
    }
  }

  private finalizeMetrics(): void {
    this.updateMetrics();
    
    // Final calculations
    if (this.volumeHistory.length > 0) {
      this.metrics.averageVolume = this.volumeHistory.reduce((sum, vol) => sum + vol, 0) / this.volumeHistory.length;
    }
  }

  private calculateTargetChunkSamples(): void {
    this.targetChunkSamples = Math.floor((this.config.sampleRate * this.config.chunkSize) / 1000);
  }

  private setState(newState: WorkflowState): void {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  private startStreaming(): void {
    this.isStreaming = true;
  }

  private mapErrorType(error: any): AudioErrorType {
    if (error instanceof Error) {
      switch (error.name) {
        case 'NotAllowedError':
          return AudioErrorType.PERMISSION_DENIED;
        case 'NotFoundError':
          return AudioErrorType.DEVICE_NOT_FOUND;
        case 'NotReadableError':
          return AudioErrorType.DEVICE_BUSY;
        default:
          return AudioErrorType.PROCESSING_ERROR;
      }
    }
    return AudioErrorType.UNKNOWN;
  }

  private handleError(type: AudioErrorType, message: string, recoverable: boolean, originalError?: any): void {
    const error: AudioWorkflowError = {
      type,
      message,
      timestamp: new Date(),
      recoverable,
      context: originalError
    };
    
    this.setState(WorkflowState.ERROR);
    this.events.onError?.(error);
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${this.chunkCounter}`;
  }

  private initializeMetrics(): AudioStreamMetrics {
    return {
      totalChunks: 0,
      totalBytes: 0,
      averageVolume: 0,
      voiceActivityPercentage: 0,
      streamDuration: 0,
      droppedChunks: 0,
      qualityScore: 0
    };
  }
}

/**
 * Voice Activity Detection implementation
 */
class VoiceActivityDetector {
  private threshold: number;
  private energyHistory: number[] = [];
  private zeroCrossingHistory: number[] = [];
  
  constructor(threshold: number = 0.3) {
    this.threshold = threshold;
  }

  process(audioData: Float32Array, sampleRate: number): VADResult {
    // Calculate energy
    const energy = this.calculateEnergy(audioData);
    this.energyHistory.push(energy);
    
    // Calculate zero crossing rate
    const zcr = this.calculateZeroCrossingRate(audioData);
    this.zeroCrossingHistory.push(zcr);
    
    // Keep history manageable
    if (this.energyHistory.length > 20) {
      this.energyHistory.shift();
      this.zeroCrossingHistory.shift();
    }
    
    // Calculate background noise level
    const noiseLevel = this.estimateNoiseLevel();
    
    // Voice activity decision
    const energyThreshold = noiseLevel * 2;
    const isVoiceActive = energy > energyThreshold && energy > this.threshold;
    
    // Calculate confidence
    const confidence = isVoiceActive ? Math.min(energy / this.threshold, 1) : 0;
    
    return {
      isVoiceActive,
      confidence,
      speechProbability: confidence,
      noiseLevel
    };
  }

  updateThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return sum / audioData.length;
  }

  private calculateZeroCrossingRate(audioData: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioData.length;
  }

  private estimateNoiseLevel(): number {
    if (this.energyHistory.length < 5) {
      return 0.01; // Default noise level
    }
    
    // Use lowest 20% of energy values as noise estimate
    const sortedEnergy = [...this.energyHistory].sort((a, b) => a - b);
    const noiseCount = Math.max(1, Math.floor(sortedEnergy.length * 0.2));
    const noiseSum = sortedEnergy.slice(0, noiseCount).reduce((sum, val) => sum + val, 0);
    
    return noiseSum / noiseCount;
  }
}