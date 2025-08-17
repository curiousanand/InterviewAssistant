import {
  IRecordingStrategy,
  RecordingState,
  RecordingEvent,
  RecordingEventType,
  RecordingStrategyError,
  RecordingStrategyErrorType,
  RecordingStrategyConfiguration,
  RecordingStrategyCapabilities,
  RecordingStatistics,
  IVoiceActivityDetector,
  VoiceActivityConfig,
  VoiceActivityResult,
  DEFAULT_RECORDING_STRATEGY_CONFIG
} from '../interfaces/IRecordingStrategy';
import { IAudioCapture, AudioCaptureState } from '../interfaces/IAudioCapture';

/**
 * Voice-activated recording strategy implementation
 * 
 * Why: Automatically starts/stops recording based on voice activity detection
 * Pattern: Strategy Pattern - implements voice-activated recording behavior
 * Rationale: Optimizes bandwidth and storage by recording only when voice is detected
 */
export class VoiceActivatedRecordingStrategy implements IRecordingStrategy {
  private audioCapture: IAudioCapture | null = null;
  private voiceActivityDetector: SimpleVoiceActivityDetector;
  private state: RecordingState = RecordingState.IDLE;
  private configuration: RecordingStrategyConfiguration;
  
  // Event handlers
  private eventCallback: ((event: RecordingEvent) => void) | null = null;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private errorCallback: ((error: RecordingStrategyError) => void) | null = null;

  // Recording state tracking
  private recordingStartTime: number = 0;
  private lastVoiceTime: number = 0;
  private totalRecordingTime: number = 0;
  private activeRecordingTime: number = 0;
  private silenceTime: number = 0;
  
  // Voice activity state
  private isVoiceActive: boolean = false;
  private isRecordingActive: boolean = false;
  private voiceActivationStartTime: number = 0;
  private silenceStartTime: number = 0;
  private voiceDetectionCount: number = 0;
  private silenceDetectionCount: number = 0;
  private triggerActivationCount: number = 0;
  
  // Audio processing
  private audioLevelSum: number = 0;
  private audioLevelCount: number = 0;
  private peakAudioLevel: number = 0;
  private currentAudioLevel: number = 0;
  
  // Timing management
  private voiceDetectionDelayTimeoutId: number | null = null;
  private silenceDetectionDelayTimeoutId: number | null = null;
  private maxDurationTimeoutId: number | null = null;
  
  // Quality monitoring
  private qualityMonitoringIntervalId: number | null = null;
  private qualityScores: number[] = [];
  private bufferOverflowCount: number = 0;
  private errorCount: number = 0;
  
  // Audio buffer for delayed start
  private audioBuffer: Float32Array[] = [];
  private maxBufferDuration: number = 1000; // 1 second buffer
  
  constructor(config?: Partial<RecordingStrategyConfiguration>) {
    this.configuration = { ...DEFAULT_RECORDING_STRATEGY_CONFIG, ...config };
    this.voiceActivityDetector = new SimpleVoiceActivityDetector();
  }

  async initialize(audioCapture: IAudioCapture, config?: Partial<RecordingStrategyConfiguration>): Promise<void> {
    if (this.state !== RecordingState.IDLE) {
      throw this.createError(
        RecordingStrategyErrorType.INITIALIZATION_FAILED,
        'Strategy is already initialized',
        false
      );
    }

    this.setState(RecordingState.INITIALIZING);

    try {
      this.audioCapture = audioCapture;
      
      if (config) {
        this.configuration = { ...this.configuration, ...config };
      }
      
      // Validate configuration
      this.validateConfiguration();
      
      // Initialize voice activity detector
      await this.initializeVoiceActivityDetector();
      
      // Setup audio capture event handlers
      this.setupAudioCaptureHandlers();
      
      // Reset statistics
      this.resetStatistics();
      
      this.setState(RecordingState.READY);
      
      this.emitEvent(RecordingEventType.RECORDING_STARTED, {
        strategyName: this.getStrategyName(),
        configuration: this.configuration
      });

    } catch (error) {
      this.setState(RecordingState.ERROR);
      throw this.createError(
        RecordingStrategyErrorType.INITIALIZATION_FAILED,
        `Failed to initialize voice-activated recording strategy: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  async startRecording(): Promise<void> {
    if (this.state !== RecordingState.READY) {
      throw this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        'Strategy is not ready for recording',
        true
      );
    }

    if (!this.audioCapture) {
      throw this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        'Audio capture not initialized',
        false
      );
    }

    try {
      this.setState(RecordingState.RECORDING);
      
      // Start audio capture for voice detection (but not necessarily recording)
      await this.audioCapture.start();
      
      this.recordingStartTime = performance.now();
      this.lastVoiceTime = this.recordingStartTime;
      
      // Setup maximum duration timer
      this.setupMaxDurationTimer();
      
      // Start quality monitoring
      if (this.configuration.enableRecordingQuality) {
        this.startQualityMonitoring();
      }
      
      this.emitEvent(RecordingEventType.RECORDING_STARTED, {
        timestamp: new Date(),
        configuration: this.configuration
      });

    } catch (error) {
      this.setState(RecordingState.ERROR);
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to start voice-activated recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  async stopRecording(): Promise<void> {
    if (this.state !== RecordingState.RECORDING && this.state !== RecordingState.PAUSED) {
      return;
    }

    try {
      this.setState(RecordingState.STOPPING);
      
      // Clear all timers
      this.clearAllTimers();
      
      // Stop quality monitoring
      this.stopQualityMonitoring();
      
      // Stop audio capture
      if (this.audioCapture) {
        await this.audioCapture.stop();
      }
      
      // Update recording time
      this.updateRecordingTime();
      
      // Reset voice activity state
      this.isVoiceActive = false;
      this.isRecordingActive = false;
      
      this.setState(RecordingState.READY);
      
      this.emitEvent(RecordingEventType.RECORDING_STOPPED, {
        timestamp: new Date(),
        duration: this.totalRecordingTime,
        statistics: this.getStatistics()
      });

    } catch (error) {
      this.setState(RecordingState.ERROR);
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to stop voice-activated recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  async pauseRecording(): Promise<void> {
    if (this.state !== RecordingState.RECORDING) {
      throw this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        'Cannot pause - not currently recording',
        true
      );
    }

    try {
      // Pause underlying audio capture
      if (this.audioCapture && this.isRecordingActive) {
        await this.audioCapture.pause();
      }
      
      this.updateRecordingTime();
      this.setState(RecordingState.PAUSED);
      
      this.emitEvent(RecordingEventType.RECORDING_PAUSED, {
        timestamp: new Date()
      });

    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to pause voice-activated recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.state !== RecordingState.PAUSED) {
      throw this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        'Cannot resume - not currently paused',
        true
      );
    }

    try {
      // Resume underlying audio capture if voice was active
      if (this.audioCapture && this.isVoiceActive) {
        await this.audioCapture.resume();
      }
      
      this.recordingStartTime = performance.now();
      this.setState(RecordingState.RECORDING);
      
      this.emitEvent(RecordingEventType.RECORDING_RESUMED, {
        timestamp: new Date()
      });

    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to resume voice-activated recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  isRecording(): boolean {
    return this.state === RecordingState.RECORDING && this.isRecordingActive;
  }

  isPaused(): boolean {
    return this.state === RecordingState.PAUSED;
  }

  getState(): RecordingState {
    return this.state;
  }

  getStrategyName(): string {
    return 'VoiceActivated';
  }

  getCapabilities(): RecordingStrategyCapabilities {
    return {
      strategyName: this.getStrategyName(),
      supportsVoiceActivation: true,
      supportsPushToTalk: false,
      supportsContinuousRecording: false,
      supportsPauseResume: true,
      supportsManualTrigger: false,
      supportsAutoStop: true,
      supportsQualityMonitoring: true,
      supportsNoiseGate: true,
      supportsCompression: true,
      minimumSilenceTimeout: 100, // 100ms
      maximumRecordingDuration: 3600000, // 1 hour
      supportedKeys: []
    };
  }

  async updateConfiguration(config: Partial<RecordingStrategyConfiguration>): Promise<void> {
    const newConfig = { ...this.configuration, ...config };
    this.validateConfiguration(newConfig);
    this.configuration = newConfig;
    
    // Update voice activity detector configuration
    if (config.voiceThreshold !== undefined || config.voiceDetectionDelay !== undefined) {
      this.voiceActivityDetector.updateConfiguration({
        threshold: this.configuration.voiceThreshold,
        frameDuration: 20, // 20ms frames
        voiceFrameCountThreshold: Math.ceil(this.configuration.voiceDetectionDelay / 20),
        silenceFrameCountThreshold: Math.ceil(this.configuration.silenceDetectionDelay / 20)
      });
    }
  }

  getConfiguration(): RecordingStrategyConfiguration {
    return { ...this.configuration };
  }

  onRecordingEvent(callback: (event: RecordingEvent) => void): void {
    this.eventCallback = callback;
  }

  onAudioData(callback: (data: Float32Array) => void): void {
    this.audioDataCallback = callback;
  }

  onError(callback: (error: RecordingStrategyError) => void): void {
    this.errorCallback = callback;
  }

  removeAllListeners(): void {
    this.eventCallback = null;
    this.audioDataCallback = null;
    this.errorCallback = null;
  }

  async cleanup(): Promise<void> {
    try {
      // Stop recording if active
      if (this.isRecording() || this.isPaused()) {
        await this.stopRecording();
      }
      
      // Clear all timers
      this.clearAllTimers();
      
      // Stop quality monitoring
      this.stopQualityMonitoring();
      
      // Cleanup voice activity detector
      this.voiceActivityDetector.cleanup();
      
      // Remove audio capture handlers
      if (this.audioCapture) {
        this.audioCapture.removeAllListeners();
      }
      
      // Reset state
      this.state = RecordingState.IDLE;
      this.audioCapture = null;
      
      // Clear callbacks
      this.removeAllListeners();
      
      // Clear buffers
      this.audioBuffer = [];

    } catch (error) {
      console.warn('Error during voice-activated recording strategy cleanup:', error);
    }
  }

  getStatistics(): RecordingStatistics {
    return {
      strategyName: this.getStrategyName(),
      totalRecordingTime: this.totalRecordingTime,
      activeRecordingTime: this.activeRecordingTime,
      silenceTime: this.silenceTime,
      voiceDetectionCount: this.voiceDetectionCount,
      silenceDetectionCount: this.silenceDetectionCount,
      triggerActivationCount: this.triggerActivationCount,
      averageAudioLevel: this.audioLevelCount > 0 ? this.audioLevelSum / this.audioLevelCount : 0,
      peakAudioLevel: this.peakAudioLevel,
      bufferOverflowCount: this.bufferOverflowCount,
      errorCount: this.errorCount,
      qualityScore: this.calculateQualityScore()
    };
  }

  // Voice activity detection specific methods

  /**
   * Check if voice is currently detected
   */
  isVoiceDetected(): boolean {
    return this.isVoiceActive;
  }

  /**
   * Get current voice activity confidence
   */
  getVoiceConfidence(): number {
    return this.voiceActivityDetector.getLastConfidence();
  }

  // Private helper methods

  private async initializeVoiceActivityDetector(): Promise<void> {
    try {
      const vadConfig: VoiceActivityConfig = {
        threshold: this.configuration.voiceThreshold,
        frameDuration: 20, // 20ms frames for responsive detection
        voiceFrameCountThreshold: Math.ceil(this.configuration.voiceDetectionDelay / 20),
        silenceFrameCountThreshold: Math.ceil(this.configuration.silenceDetectionDelay / 20),
        enableSpectralAnalysis: true,
        enableZeroCrossingRate: true,
        enableEnergyAnalysis: true,
        adaptiveThreshold: true
      };
      
      await this.voiceActivityDetector.initialize(vadConfig);
      
    } catch (error) {
      throw this.createError(
        RecordingStrategyErrorType.VOICE_DETECTION_FAILED,
        `Failed to initialize voice activity detector: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  private setupAudioCaptureHandlers(): void {
    if (!this.audioCapture) {
      return;
    }

    // Handle audio data
    this.audioCapture.onAudioData((data: Float32Array) => {
      this.handleAudioData(data);
    });

    // Handle audio capture errors
    this.audioCapture.onError((error) => {
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Audio capture error: ${error.message}`,
        error.recoverable,
        error.originalError
      ));
    });

    // Handle state changes
    this.audioCapture.onStateChange((state) => {
      if (state === AudioCaptureState.ERROR) {
        this.setState(RecordingState.ERROR);
      }
    });
  }

  private handleAudioData(data: Float32Array): void {
    try {
      const now = performance.now();
      
      // Calculate audio level
      const audioLevel = this.calculateAudioLevel(data);
      this.currentAudioLevel = audioLevel;
      this.audioLevelSum += audioLevel;
      this.audioLevelCount++;
      this.peakAudioLevel = Math.max(this.peakAudioLevel, audioLevel);
      
      // Process voice activity detection
      const vadResult = this.voiceActivityDetector.processAudio(data);
      this.processVoiceActivityResult(vadResult, now);
      
      // Buffer audio data for potential delayed start
      this.bufferAudioData(data);
      
      // Forward audio data only if actively recording
      if (this.isRecordingActive && this.audioDataCallback) {
        let processedData = data;
        
        // Apply noise gate if enabled
        if (this.configuration.enableNoiseGate) {
          processedData = this.applyNoiseGate(data, audioLevel);
        }
        
        // Apply compression if enabled
        if (this.configuration.enableCompression) {
          processedData = this.applyCompression(processedData);
        }
        
        this.audioDataCallback(processedData);
      }
      
    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.UNKNOWN_ERROR,
        `Error processing audio data: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private processVoiceActivityResult(vadResult: VoiceActivityResult, timestamp: number): void {
    const wasVoiceActive = this.isVoiceActive;
    this.isVoiceActive = vadResult.isVoice;
    
    if (this.isVoiceActive && !wasVoiceActive) {
      // Voice detected - start recording after delay
      this.voiceDetectionCount++;
      this.voiceActivationStartTime = timestamp;
      this.lastVoiceTime = timestamp;
      
      this.emitEvent(RecordingEventType.VOICE_DETECTED, {
        confidence: vadResult.confidence,
        audioLevel: this.currentAudioLevel,
        timestamp: new Date()
      });
      
      // Clear any pending silence detection
      this.clearSilenceDetectionTimer();
      
      // Start voice detection delay timer
      this.startVoiceDetectionDelayTimer();
      
    } else if (!this.isVoiceActive && wasVoiceActive) {
      // Silence detected - potentially stop recording after delay
      this.silenceDetectionCount++;
      this.silenceStartTime = timestamp;
      
      this.emitEvent(RecordingEventType.SILENCE_DETECTED, {
        confidence: vadResult.confidence,
        audioLevel: this.currentAudioLevel,
        timestamp: new Date()
      });
      
      // Clear any pending voice detection
      this.clearVoiceDetectionTimer();
      
      // Start silence detection delay timer
      this.startSilenceDetectionDelayTimer();
      
    } else if (this.isVoiceActive) {
      // Ongoing voice - update last voice time
      this.lastVoiceTime = timestamp;
    }
  }

  private startVoiceDetectionDelayTimer(): void {
    this.clearVoiceDetectionTimer();
    
    if (this.configuration.voiceDetectionDelay > 0) {
      this.voiceDetectionDelayTimeoutId = window.setTimeout(() => {
        this.activateRecording();
      }, this.configuration.voiceDetectionDelay);
    } else {
      // No delay - activate immediately
      this.activateRecording();
    }
  }

  private startSilenceDetectionDelayTimer(): void {
    this.clearSilenceDetectionTimer();
    
    if (this.configuration.silenceDetectionDelay > 0) {
      this.silenceDetectionDelayTimeoutId = window.setTimeout(() => {
        this.deactivateRecording();
      }, this.configuration.silenceDetectionDelay);
    } else {
      // No delay - deactivate immediately
      this.deactivateRecording();
    }
  }

  private activateRecording(): void {
    if (!this.isRecordingActive) {
      this.isRecordingActive = true;
      this.triggerActivationCount++;
      
      // Send buffered audio data if available
      this.flushAudioBuffer();
      
      this.emitEvent(RecordingEventType.TRIGGER_ACTIVATED, {
        reason: 'voice_detected',
        timestamp: new Date()
      });
    }
  }

  private deactivateRecording(): void {
    if (this.isRecordingActive) {
      this.isRecordingActive = false;
      
      // Update recording time
      this.updateRecordingTime();
      
      this.emitEvent(RecordingEventType.TRIGGER_DEACTIVATED, {
        reason: 'silence_detected',
        timestamp: new Date()
      });
      
      // Check if we should stop completely due to silence timeout
      if (this.configuration.autoStopOnSilence && this.configuration.silenceTimeout > 0) {
        setTimeout(() => {
          if (!this.isVoiceActive && this.state === RecordingState.RECORDING) {
            this.stopRecording();
          }
        }, this.configuration.silenceTimeout);
      }
    }
  }

  private bufferAudioData(data: Float32Array): void {
    if (!this.configuration.enableBackgroundRecording) {
      return;
    }
    
    // Add to buffer
    this.audioBuffer.push(new Float32Array(data));
    
    // Calculate buffer duration and trim if necessary
    const chunkDurationMs = (data.length / 16000) * 1000; // Assuming 16kHz sample rate
    let totalDuration = this.audioBuffer.length * chunkDurationMs;
    
    while (totalDuration > this.maxBufferDuration && this.audioBuffer.length > 0) {
      this.audioBuffer.shift();
      totalDuration -= chunkDurationMs;
    }
  }

  private flushAudioBuffer(): void {
    if (this.audioBuffer.length > 0 && this.audioDataCallback) {
      // Send buffered audio data
      for (const bufferedData of this.audioBuffer) {
        this.audioDataCallback(bufferedData);
      }
      
      // Clear buffer
      this.audioBuffer = [];
    }
  }

  private calculateAudioLevel(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private applyNoiseGate(data: Float32Array, audioLevel: number): Float32Array {
    if (audioLevel < this.configuration.noiseGateThreshold) {
      return new Float32Array(data.length);
    }
    return data;
  }

  private applyCompression(data: Float32Array): Float32Array {
    const ratio = this.configuration.compressionRatio;
    const threshold = 0.5;
    
    const compressedData = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      const amplitude = Math.abs(sample);
      
      if (amplitude > threshold) {
        const excess = amplitude - threshold;
        const compressedExcess = excess / ratio;
        const compressedAmplitude = threshold + compressedExcess;
        compressedData[i] = (sample >= 0 ? 1 : -1) * compressedAmplitude;
      } else {
        compressedData[i] = sample;
      }
    }
    
    return compressedData;
  }

  private setupMaxDurationTimer(): void {
    if (this.configuration.maxRecordingDuration > 0) {
      this.maxDurationTimeoutId = window.setTimeout(() => {
        this.emitEvent(RecordingEventType.TIMEOUT_REACHED, {
          reason: 'maximum_duration',
          duration: this.configuration.maxRecordingDuration
        });
        this.stopRecording();
      }, this.configuration.maxRecordingDuration);
    }
  }

  private clearVoiceDetectionTimer(): void {
    if (this.voiceDetectionDelayTimeoutId !== null) {
      clearTimeout(this.voiceDetectionDelayTimeoutId);
      this.voiceDetectionDelayTimeoutId = null;
    }
  }

  private clearSilenceDetectionTimer(): void {
    if (this.silenceDetectionDelayTimeoutId !== null) {
      clearTimeout(this.silenceDetectionDelayTimeoutId);
      this.silenceDetectionDelayTimeoutId = null;
    }
  }

  private clearAllTimers(): void {
    this.clearVoiceDetectionTimer();
    this.clearSilenceDetectionTimer();
    
    if (this.maxDurationTimeoutId !== null) {
      clearTimeout(this.maxDurationTimeoutId);
      this.maxDurationTimeoutId = null;
    }
  }

  private startQualityMonitoring(): void {
    this.stopQualityMonitoring();
    
    this.qualityMonitoringIntervalId = window.setInterval(() => {
      const qualityScore = this.calculateCurrentQualityScore();
      this.qualityScores.push(qualityScore);
      
      if (this.qualityScores.length > 10) {
        this.qualityScores.shift();
      }
      
    }, this.configuration.qualityMonitoringInterval);
  }

  private stopQualityMonitoring(): void {
    if (this.qualityMonitoringIntervalId !== null) {
      clearInterval(this.qualityMonitoringIntervalId);
      this.qualityMonitoringIntervalId = null;
    }
  }

  private calculateCurrentQualityScore(): number {
    const vadConfidence = this.voiceActivityDetector.getLastConfidence();
    const levelConsistency = Math.min(1.0, this.currentAudioLevel * 10);
    const errorRate = this.audioLevelCount > 0 ? this.errorCount / this.audioLevelCount : 0;
    const errorPenalty = Math.max(0, 1.0 - errorRate * 10);
    
    return (vadConfidence + levelConsistency) * 0.5 * errorPenalty;
  }

  private calculateQualityScore(): number {
    if (this.qualityScores.length === 0) {
      return 0;
    }
    
    const sum = this.qualityScores.reduce((acc, score) => acc + score, 0);
    return sum / this.qualityScores.length;
  }

  private updateRecordingTime(): void {
    if (this.recordingStartTime > 0) {
      const now = performance.now();
      const sessionTime = now - this.recordingStartTime;
      this.totalRecordingTime += sessionTime;
      
      if (this.isRecordingActive) {
        this.activeRecordingTime += sessionTime;
      }
    }
  }

  private resetStatistics(): void {
    this.totalRecordingTime = 0;
    this.activeRecordingTime = 0;
    this.silenceTime = 0;
    this.voiceDetectionCount = 0;
    this.silenceDetectionCount = 0;
    this.triggerActivationCount = 0;
    this.audioLevelSum = 0;
    this.audioLevelCount = 0;
    this.peakAudioLevel = 0;
    this.bufferOverflowCount = 0;
    this.errorCount = 0;
    this.qualityScores = [];
  }

  private validateConfiguration(config?: RecordingStrategyConfiguration): void {
    const configToValidate = config || this.configuration;
    
    if (!configToValidate.voiceActivationEnabled) {
      throw new Error('Voice activation must be enabled for VoiceActivatedRecordingStrategy');
    }
    
    if (configToValidate.voiceThreshold < 0 || configToValidate.voiceThreshold > 1) {
      throw new Error('Voice threshold must be between 0.0 and 1.0');
    }
    
    if (configToValidate.voiceDetectionDelay < 0) {
      throw new Error('Voice detection delay cannot be negative');
    }
    
    if (configToValidate.silenceDetectionDelay < 0) {
      throw new Error('Silence detection delay cannot be negative');
    }
  }

  private setState(newState: RecordingState): void {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  private emitEvent(type: RecordingEventType, data?: any): void {
    if (this.eventCallback) {
      const event: RecordingEvent = {
        type,
        timestamp: new Date(),
        data,
        strategyName: this.getStrategyName()
      };
      
      this.eventCallback(event);
    }
  }

  private handleError(error: RecordingStrategyError): void {
    this.errorCount++;
    
    if (this.errorCallback) {
      this.errorCallback(error);
    }
    
    this.emitEvent(RecordingEventType.ERROR_OCCURRED, {
      error: error.message,
      type: error.type
    });
  }

  private createError(
    type: RecordingStrategyErrorType,
    message: string,
    recoverable: boolean,
    originalError?: Error
  ): RecordingStrategyError {
    return {
      type,
      message,
      originalError,
      timestamp: new Date(),
      recoverable,
      strategyName: this.getStrategyName()
    };
  }
}

/**
 * Simple voice activity detector implementation
 */
class SimpleVoiceActivityDetector implements IVoiceActivityDetector {
  private config: VoiceActivityConfig = {
    threshold: 0.01,
    frameDuration: 20,
    voiceFrameCountThreshold: 3,
    silenceFrameCountThreshold: 5,
    enableSpectralAnalysis: true,
    enableZeroCrossingRate: true,
    enableEnergyAnalysis: true,
    adaptiveThreshold: true
  };
  
  private voiceFrameCount: number = 0;
  private silenceFrameCount: number = 0;
  private lastConfidence: number = 0;
  private energyHistory: number[] = [];
  private adaptiveThreshold: number = 0.01;

  async initialize(config: VoiceActivityConfig): Promise<void> {
    this.config = { ...config };
    this.adaptiveThreshold = config.threshold;
    this.reset();
  }

  processAudio(audioData: Float32Array): VoiceActivityResult {
    const energy = this.calculateEnergy(audioData);
    const zcr = this.config.enableZeroCrossingRate ? this.calculateZeroCrossingRate(audioData) : 0;
    const spectralCentroid = this.config.enableSpectralAnalysis ? this.calculateSpectralCentroid(audioData) : 0;
    
    // Update adaptive threshold
    if (this.config.adaptiveThreshold) {
      this.updateAdaptiveThreshold(energy);
    }
    
    // Determine if voice is present
    const threshold = this.config.adaptiveThreshold ? this.adaptiveThreshold : this.config.threshold;
    const isVoiceFrame = energy > threshold;
    
    // Update frame counters
    if (isVoiceFrame) {
      this.voiceFrameCount++;
      this.silenceFrameCount = 0;
    } else {
      this.silenceFrameCount++;
      this.voiceFrameCount = 0;
    }
    
    // Determine voice activity
    const isVoice = this.voiceFrameCount >= this.config.voiceFrameCountThreshold;
    
    // Calculate confidence
    const confidence = this.calculateConfidence(energy, zcr, spectralCentroid, isVoice);
    this.lastConfidence = confidence;
    
    return {
      isVoice,
      confidence,
      energy,
      spectralCentroid,
      zeroCrossingRate: zcr,
      timestamp: performance.now()
    };
  }

  updateConfiguration(config: Partial<VoiceActivityConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.threshold !== undefined) {
      this.adaptiveThreshold = config.threshold;
    }
  }

  getConfiguration(): VoiceActivityConfig {
    return { ...this.config };
  }

  getLastConfidence(): number {
    return this.lastConfidence;
  }

  cleanup(): void {
    this.reset();
  }

  private reset(): void {
    this.voiceFrameCount = 0;
    this.silenceFrameCount = 0;
    this.lastConfidence = 0;
    this.energyHistory = [];
  }

  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private calculateZeroCrossingRate(audioData: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (audioData.length - 1);
  }

  private calculateSpectralCentroid(audioData: Float32Array): number {
    // Simplified spectral centroid calculation
    const fftSize = Math.min(audioData.length, 256);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fftSize; i++) {
      const magnitude = Math.abs(audioData[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private updateAdaptiveThreshold(energy: number): void {
    this.energyHistory.push(energy);
    
    // Keep only recent history
    if (this.energyHistory.length > 100) {
      this.energyHistory.shift();
    }
    
    // Calculate adaptive threshold as a percentile of recent energy
    if (this.energyHistory.length >= 10) {
      const sortedEnergy = [...this.energyHistory].sort((a, b) => a - b);
      const percentileIndex = Math.floor(sortedEnergy.length * 0.3); // 30th percentile
      this.adaptiveThreshold = Math.max(
        sortedEnergy[percentileIndex],
        this.config.threshold * 0.5 // Minimum threshold
      );
    }
  }

  private calculateConfidence(energy: number, zcr: number, spectralCentroid: number, isVoice: boolean): number {
    let confidence = 0;
    
    // Energy-based confidence
    const energyConfidence = Math.min(1.0, energy / (this.adaptiveThreshold * 5));
    confidence += energyConfidence * 0.6;
    
    // ZCR-based confidence (voice typically has lower ZCR than noise)
    if (this.config.enableZeroCrossingRate) {
      const zcrConfidence = isVoice ? Math.max(0, 1.0 - zcr * 10) : zcr * 2;
      confidence += Math.min(1.0, zcrConfidence) * 0.2;
    }
    
    // Spectral centroid confidence
    if (this.config.enableSpectralAnalysis) {
      const spectralConfidence = Math.min(1.0, spectralCentroid / 50);
      confidence += spectralConfidence * 0.2;
    }
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }
}