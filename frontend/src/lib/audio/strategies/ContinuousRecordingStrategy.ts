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
  BufferOverflowStrategy,
  DEFAULT_RECORDING_STRATEGY_CONFIG
} from '../interfaces/IRecordingStrategy';
import { IAudioCapture, AudioCaptureState } from '../interfaces/IAudioCapture';

/**
 * Continuous recording strategy implementation
 * 
 * Why: Provides uninterrupted audio recording for constant monitoring
 * Pattern: Strategy Pattern - implements continuous recording behavior
 * Rationale: Ideal for scenarios requiring constant audio input without manual triggers
 */
export class ContinuousRecordingStrategy implements IRecordingStrategy {
  private audioCapture: IAudioCapture | null = null;
  private state: RecordingState = RecordingState.IDLE;
  private configuration: RecordingStrategyConfiguration;
  
  // Event handlers
  private eventCallback: ((event: RecordingEvent) => void) | null = null;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private errorCallback: ((error: RecordingStrategyError) => void) | null = null;

  // Recording state tracking
  private recordingStartTime: number = 0;
  private lastAudioTime: number = 0;
  private totalRecordingTime: number = 0;
  private activeRecordingTime: number = 0;
  private silenceTime: number = 0;
  
  // Audio processing
  private audioLevelSum: number = 0;
  private audioLevelCount: number = 0;
  private peakAudioLevel: number = 0;
  private currentAudioLevel: number = 0;
  
  // Silence detection
  private silenceStartTime: number = 0;
  private isInSilence: boolean = false;
  private voiceDetectionCount: number = 0;
  private silenceDetectionCount: number = 0;
  
  // Quality monitoring
  private qualityMonitoringIntervalId: number | null = null;
  private qualityScores: number[] = [];
  private bufferOverflowCount: number = 0;
  private errorCount: number = 0;
  
  // Auto-stop functionality
  private autoStopTimeoutId: number | null = null;
  private maxDurationTimeoutId: number | null = null;
  
  constructor(config?: Partial<RecordingStrategyConfiguration>) {
    this.configuration = { ...DEFAULT_RECORDING_STRATEGY_CONFIG, ...config };
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
        `Failed to initialize continuous recording strategy: ${error instanceof Error ? error.message : String(error)}`,
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
      
      // Start audio capture
      await this.audioCapture.start();
      
      this.recordingStartTime = performance.now();
      this.lastAudioTime = this.recordingStartTime;
      
      // Setup auto-stop timers
      this.setupAutoStopTimers();
      
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
        `Failed to start recording: ${error instanceof Error ? error.message : String(error)}`,
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
      
      // Clear timers
      this.clearTimers();
      
      // Stop quality monitoring
      this.stopQualityMonitoring();
      
      // Stop audio capture
      if (this.audioCapture) {
        await this.audioCapture.stop();
      }
      
      // Update recording time
      this.updateRecordingTime();
      
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
        `Failed to stop recording: ${error instanceof Error ? error.message : String(error)}`,
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
      if (this.audioCapture) {
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
        `Failed to pause recording: ${error instanceof Error ? error.message : String(error)}`,
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
      if (this.audioCapture) {
        await this.audioCapture.resume();
      }
      
      this.lastAudioTime = performance.now();
      this.setState(RecordingState.RECORDING);
      
      this.emitEvent(RecordingEventType.RECORDING_RESUMED, {
        timestamp: new Date()
      });

    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to resume recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  isRecording(): boolean {
    return this.state === RecordingState.RECORDING;
  }

  isPaused(): boolean {
    return this.state === RecordingState.PAUSED;
  }

  getState(): RecordingState {
    return this.state;
  }

  getStrategyName(): string {
    return 'ContinuousRecording';
  }

  getCapabilities(): RecordingStrategyCapabilities {
    return {
      strategyName: this.getStrategyName(),
      supportsVoiceActivation: false,
      supportsPushToTalk: false,
      supportsContinuousRecording: true,
      supportsPauseResume: true,
      supportsManualTrigger: true,
      supportsAutoStop: true,
      supportsQualityMonitoring: true,
      supportsNoiseGate: true,
      supportsCompression: true,
      minimumSilenceTimeout: 500, // 500ms
      maximumRecordingDuration: 3600000, // 1 hour
      supportedKeys: []
    };
  }

  async updateConfiguration(config: Partial<RecordingStrategyConfiguration>): Promise<void> {
    const newConfig = { ...this.configuration, ...config };
    this.validateConfiguration(newConfig);
    this.configuration = newConfig;
    
    // Update audio capture configuration if needed
    if (this.audioCapture && config.chunkDuration) {
      await this.audioCapture.updateConfiguration({
        chunkDuration: config.chunkDuration
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
      this.clearTimers();
      
      // Stop quality monitoring
      this.stopQualityMonitoring();
      
      // Remove audio capture handlers
      if (this.audioCapture) {
        this.audioCapture.removeAllListeners();
      }
      
      // Reset state
      this.state = RecordingState.IDLE;
      this.audioCapture = null;
      
      // Clear callbacks
      this.removeAllListeners();

    } catch (error) {
      console.warn('Error during continuous recording strategy cleanup:', error);
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
      triggerActivationCount: 0, // Not applicable for continuous recording
      averageAudioLevel: this.audioLevelCount > 0 ? this.audioLevelSum / this.audioLevelCount : 0,
      peakAudioLevel: this.peakAudioLevel,
      bufferOverflowCount: this.bufferOverflowCount,
      errorCount: this.errorCount,
      qualityScore: this.calculateQualityScore()
    };
  }

  // Private helper methods

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
      this.lastAudioTime = now;
      
      // Calculate audio level
      const audioLevel = this.calculateAudioLevel(data);
      this.currentAudioLevel = audioLevel;
      this.audioLevelSum += audioLevel;
      this.audioLevelCount++;
      this.peakAudioLevel = Math.max(this.peakAudioLevel, audioLevel);
      
      // Process silence detection
      this.processSilenceDetection(audioLevel, now);
      
      // Apply noise gate if enabled
      let processedData = data;
      if (this.configuration.enableNoiseGate) {
        processedData = this.applyNoiseGate(data, audioLevel);
      }
      
      // Apply compression if enabled
      if (this.configuration.enableCompression) {
        processedData = this.applyCompression(processedData);
      }
      
      // Forward audio data
      if (this.audioDataCallback) {
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

  private calculateAudioLevel(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private processSilenceDetection(audioLevel: number, timestamp: number): void {
    const isSilent = audioLevel < this.configuration.voiceThreshold;
    
    if (isSilent && !this.isInSilence) {
      // Silence started
      this.isInSilence = true;
      this.silenceStartTime = timestamp;
      this.silenceDetectionCount++;
      
      this.emitEvent(RecordingEventType.SILENCE_DETECTED, {
        audioLevel,
        timestamp: new Date()
      });
      
      // Setup auto-stop if enabled
      if (this.configuration.autoStopOnSilence && this.configuration.silenceTimeout > 0) {
        this.setupSilenceAutoStop();
      }
      
    } else if (!isSilent && this.isInSilence) {
      // Voice detected after silence
      this.isInSilence = false;
      this.silenceTime += timestamp - this.silenceStartTime;
      this.voiceDetectionCount++;
      
      this.emitEvent(RecordingEventType.VOICE_DETECTED, {
        audioLevel,
        timestamp: new Date()
      });
      
      // Clear auto-stop timer
      this.clearSilenceAutoStop();
    }
  }

  private applyNoiseGate(data: Float32Array, audioLevel: number): Float32Array {
    if (audioLevel < this.configuration.noiseGateThreshold) {
      // Gate closed - return silence
      return new Float32Array(data.length);
    }
    
    // Gate open - return original data
    return data;
  }

  private applyCompression(data: Float32Array): Float32Array {
    const ratio = this.configuration.compressionRatio;
    const threshold = 0.5; // Fixed threshold for simplicity
    
    const compressedData = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      const amplitude = Math.abs(sample);
      
      if (amplitude > threshold) {
        // Apply compression
        const excess = amplitude - threshold;
        const compressedExcess = excess / ratio;
        const compressedAmplitude = threshold + compressedExcess;
        compressedData[i] = (sample >= 0 ? 1 : -1) * compressedAmplitude;
      } else {
        // Below threshold - no compression
        compressedData[i] = sample;
      }
    }
    
    return compressedData;
  }

  private setupAutoStopTimers(): void {
    // Setup maximum duration timer
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

  private setupSilenceAutoStop(): void {
    this.clearSilenceAutoStop();
    
    if (this.configuration.silenceTimeout > 0) {
      this.autoStopTimeoutId = window.setTimeout(() => {
        this.emitEvent(RecordingEventType.TIMEOUT_REACHED, {
          reason: 'silence_timeout',
          duration: this.configuration.silenceTimeout
        });
        this.stopRecording();
      }, this.configuration.silenceTimeout);
    }
  }

  private clearSilenceAutoStop(): void {
    if (this.autoStopTimeoutId !== null) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
  }

  private clearTimers(): void {
    this.clearSilenceAutoStop();
    
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
      
      // Keep only last 10 scores
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
    // Simple quality score based on audio level consistency and error rate
    const levelConsistency = this.audioLevelCount > 0 ? 
      Math.min(1.0, this.currentAudioLevel * 10) : 0;
    const errorRate = this.audioLevelCount > 0 ? 
      this.errorCount / this.audioLevelCount : 0;
    const errorPenalty = Math.max(0, 1.0 - errorRate * 10);
    
    return levelConsistency * errorPenalty;
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
      
      if (!this.isInSilence) {
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
    this.audioLevelSum = 0;
    this.audioLevelCount = 0;
    this.peakAudioLevel = 0;
    this.bufferOverflowCount = 0;
    this.errorCount = 0;
    this.qualityScores = [];
  }

  private validateConfiguration(config?: RecordingStrategyConfiguration): void {
    const configToValidate = config || this.configuration;
    
    if (configToValidate.maxRecordingDuration < 0) {
      throw new Error('Maximum recording duration cannot be negative');
    }
    
    if (configToValidate.silenceTimeout < 0) {
      throw new Error('Silence timeout cannot be negative');
    }
    
    if (configToValidate.voiceThreshold < 0 || configToValidate.voiceThreshold > 1) {
      throw new Error('Voice threshold must be between 0.0 and 1.0');
    }
    
    if (configToValidate.chunkDuration < 10 || configToValidate.chunkDuration > 5000) {
      throw new Error('Chunk duration must be between 10 and 5000 milliseconds');
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