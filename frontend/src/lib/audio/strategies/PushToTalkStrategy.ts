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
  IKeyboardEventHandler,
  KeyboardEventConfig,
  KeyboardRecordingEvent,
  DEFAULT_RECORDING_STRATEGY_CONFIG
} from '../interfaces/IRecordingStrategy';
import { IAudioCapture, AudioCaptureState } from '../interfaces/IAudioCapture';

/**
 * Push-to-talk recording strategy implementation
 * 
 * Why: Provides manual control over recording through keyboard input
 * Pattern: Strategy Pattern - implements push-to-talk recording behavior
 * Rationale: Gives users precise control over when recording occurs
 */
export class PushToTalkStrategy implements IRecordingStrategy {
  private audioCapture: IAudioCapture | null = null;
  private keyboardHandler: SimpleKeyboardEventHandler;
  private state: RecordingState = RecordingState.IDLE;
  private configuration: RecordingStrategyConfiguration;
  
  // Event handlers
  private eventCallback: ((event: RecordingEvent) => void) | null = null;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private errorCallback: ((error: RecordingStrategyError) => void) | null = null;

  // Recording state tracking
  private recordingStartTime: number = 0;
  private keyPressTime: number = 0;
  private totalRecordingTime: number = 0;
  private activeRecordingTime: number = 0;
  private silenceTime: number = 0;
  
  // Push-to-talk state
  private isKeyPressed: boolean = false;
  private isRecordingActive: boolean = false;
  private triggerActivationCount: number = 0;
  private keyPressCount: number = 0;
  private keyReleaseCount: number = 0;
  
  // Audio processing
  private audioLevelSum: number = 0;
  private audioLevelCount: number = 0;
  private peakAudioLevel: number = 0;
  private currentAudioLevel: number = 0;
  
  // Timing management
  private maxDurationTimeoutId: number | null = null;
  private holdTimeoutId: number | null = null;
  
  // Quality monitoring
  private qualityMonitoringIntervalId: number | null = null;
  private qualityScores: number[] = [];
  private bufferOverflowCount: number = 0;
  private errorCount: number = 0;
  
  // Key state tracking
  private currentModifiers: Set<string> = new Set();
  private lastKeyEvent: KeyboardRecordingEvent | null = null;
  
  constructor(config?: Partial<RecordingStrategyConfiguration>) {
    this.configuration = { ...DEFAULT_RECORDING_STRATEGY_CONFIG, ...config };
    this.keyboardHandler = new SimpleKeyboardEventHandler();
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
      
      // Initialize keyboard event handler
      this.initializeKeyboardHandler();
      
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
        `Failed to initialize push-to-talk recording strategy: ${error instanceof Error ? error.message : String(error)}`,
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
      
      // Start audio capture (but not necessarily recording until key is pressed)
      await this.audioCapture.start();
      
      this.recordingStartTime = performance.now();
      
      // Enable keyboard event handling
      this.keyboardHandler.setEnabled(true);
      
      // Setup maximum duration timer
      this.setupMaxDurationTimer();
      
      // Start quality monitoring
      if (this.configuration.enableRecordingQuality) {
        this.startQualityMonitoring();
      }
      
      this.emitEvent(RecordingEventType.RECORDING_STARTED, {
        timestamp: new Date(),
        configuration: this.configuration,
        keyConfig: {
          key: this.configuration.pushToTalkKey,
          modifiers: this.configuration.pushToTalkModifiers,
          holdToRecord: this.configuration.holdToRecord
        }
      });

    } catch (error) {
      this.setState(RecordingState.ERROR);
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to start push-to-talk recording: ${error instanceof Error ? error.message : String(error)}`,
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
      
      // Deactivate recording if active
      if (this.isRecordingActive) {
        this.deactivateRecording();
      }
      
      // Disable keyboard event handling
      this.keyboardHandler.setEnabled(false);
      
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
      
      // Reset push-to-talk state
      this.isKeyPressed = false;
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
        `Failed to stop push-to-talk recording: ${error instanceof Error ? error.message : String(error)}`,
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
      // Deactivate recording if active
      if (this.isRecordingActive) {
        this.deactivateRecording();
      }
      
      // Disable keyboard handling
      this.keyboardHandler.setEnabled(false);
      
      // Pause underlying audio capture
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
        `Failed to pause push-to-talk recording: ${error instanceof Error ? error.message : String(error)}`,
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
      // Resume underlying audio capture
      if (this.audioCapture) {
        await this.audioCapture.resume();
      }
      
      // Re-enable keyboard handling
      this.keyboardHandler.setEnabled(true);
      
      this.recordingStartTime = performance.now();
      this.setState(RecordingState.RECORDING);
      
      this.emitEvent(RecordingEventType.RECORDING_RESUMED, {
        timestamp: new Date()
      });

    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.AUDIO_CAPTURE_FAILED,
        `Failed to resume push-to-talk recording: ${error instanceof Error ? error.message : String(error)}`,
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
    return 'PushToTalk';
  }

  getCapabilities(): RecordingStrategyCapabilities {
    return {
      strategyName: this.getStrategyName(),
      supportsVoiceActivation: false,
      supportsPushToTalk: true,
      supportsContinuousRecording: false,
      supportsPauseResume: true,
      supportsManualTrigger: true,
      supportsAutoStop: true,
      supportsQualityMonitoring: true,
      supportsNoiseGate: true,
      supportsCompression: true,
      minimumSilenceTimeout: 0, // Not applicable
      maximumRecordingDuration: 3600000, // 1 hour
      supportedKeys: ['Space', 'Enter', 'Tab', 'Control', 'Alt', 'Shift', 'Meta']
    };
  }

  async updateConfiguration(config: Partial<RecordingStrategyConfiguration>): Promise<void> {
    const newConfig = { ...this.configuration, ...config };
    this.validateConfiguration(newConfig);
    this.configuration = newConfig;
    
    // Update keyboard handler configuration
    if (config.pushToTalkKey !== undefined || config.pushToTalkModifiers !== undefined) {
      this.keyboardHandler.updateConfiguration({
        targetKey: this.configuration.pushToTalkKey,
        modifiers: this.configuration.pushToTalkModifiers,
        preventDefault: true,
        stopPropagation: true,
        enableOnlyWhenFocused: false,
        enableGlobalCapture: true
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
      
      // Cleanup keyboard handler
      this.keyboardHandler.cleanup();
      
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
      console.warn('Error during push-to-talk recording strategy cleanup:', error);
    }
  }

  getStatistics(): RecordingStatistics {
    return {
      strategyName: this.getStrategyName(),
      totalRecordingTime: this.totalRecordingTime,
      activeRecordingTime: this.activeRecordingTime,
      silenceTime: this.silenceTime,
      voiceDetectionCount: 0, // Not applicable
      silenceDetectionCount: 0, // Not applicable
      triggerActivationCount: this.triggerActivationCount,
      averageAudioLevel: this.audioLevelCount > 0 ? this.audioLevelSum / this.audioLevelCount : 0,
      peakAudioLevel: this.peakAudioLevel,
      bufferOverflowCount: this.bufferOverflowCount,
      errorCount: this.errorCount,
      qualityScore: this.calculateQualityScore()
    };
  }

  // Push-to-talk specific methods

  /**
   * Check if push-to-talk key is currently pressed
   */
  isKeyPressed(): boolean {
    return this.isKeyPressed;
  }

  /**
   * Get key press statistics
   */
  getKeyStatistics() {
    return {
      keyPressCount: this.keyPressCount,
      keyReleaseCount: this.keyReleaseCount,
      currentKey: this.configuration.pushToTalkKey,
      currentModifiers: Array.from(this.currentModifiers),
      lastKeyEvent: this.lastKeyEvent
    };
  }

  /**
   * Manually trigger recording (for programmatic control)
   */
  async manualTriggerStart(): Promise<void> {
    if (this.state === RecordingState.RECORDING && !this.isRecordingActive) {
      this.activateRecording('manual_trigger');
    }
  }

  /**
   * Manually stop triggered recording
   */
  async manualTriggerStop(): Promise<void> {
    if (this.isRecordingActive) {
      this.deactivateRecording('manual_trigger');
    }
  }

  // Private helper methods

  private initializeKeyboardHandler(): void {
    try {
      const keyConfig: KeyboardEventConfig = {
        targetKey: this.configuration.pushToTalkKey,
        modifiers: this.configuration.pushToTalkModifiers,
        preventDefault: true,
        stopPropagation: true,
        enableOnlyWhenFocused: false,
        enableGlobalCapture: true
      };
      
      this.keyboardHandler.initialize(keyConfig);
      
      // Handle key events
      this.keyboardHandler.onKeyEvent((event: KeyboardRecordingEvent) => {
        this.handleKeyEvent(event);
      });
      
    } catch (error) {
      throw this.createError(
        RecordingStrategyErrorType.KEYBOARD_EVENT_FAILED,
        `Failed to initialize keyboard handler: ${error instanceof Error ? error.message : String(error)}`,
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

  private handleKeyEvent(event: KeyboardRecordingEvent): void {
    try {
      this.lastKeyEvent = event;
      
      // Update modifier state
      this.updateModifierState(event);
      
      // Check if this is the target key with correct modifiers
      if (this.isTargetKeyEvent(event)) {
        if (event.type === 'keydown') {
          this.handleKeyDown(event);
        } else if (event.type === 'keyup') {
          this.handleKeyUp(event);
        }
      }
      
    } catch (error) {
      this.handleError(this.createError(
        RecordingStrategyErrorType.KEYBOARD_EVENT_FAILED,
        `Error handling key event: ${error instanceof Error ? error.message : String(error)}`,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private handleKeyDown(event: KeyboardRecordingEvent): void {
    if (!this.isKeyPressed) {
      this.isKeyPressed = true;
      this.keyPressCount++;
      this.keyPressTime = performance.now();
      
      // Prevent default behavior
      event.preventDefault();
      event.stopPropagation();
      
      // Activate recording
      this.activateRecording('key_press');
      
      // Setup hold timeout if configured
      if (this.configuration.maxRecordingDuration > 0) {
        this.setupHoldTimeout();
      }
    }
  }

  private handleKeyUp(event: KeyboardRecordingEvent): void {
    if (this.isKeyPressed) {
      this.isKeyPressed = false;
      this.keyReleaseCount++;
      
      // Prevent default behavior
      event.preventDefault();
      event.stopPropagation();
      
      // Clear hold timeout
      this.clearHoldTimeout();
      
      // Deactivate recording based on configuration
      if (this.configuration.holdToRecord) {
        // Hold-to-record: stop recording when key is released
        this.deactivateRecording('key_release');
      }
      // Toggle mode: key release doesn't stop recording
    }
  }

  private activateRecording(reason: string): void {
    if (!this.isRecordingActive && this.state === RecordingState.RECORDING) {
      this.isRecordingActive = true;
      this.triggerActivationCount++;
      
      this.emitEvent(RecordingEventType.TRIGGER_ACTIVATED, {
        reason,
        timestamp: new Date(),
        keyPressed: this.isKeyPressed
      });
    }
  }

  private deactivateRecording(reason: string): void {
    if (this.isRecordingActive) {
      this.isRecordingActive = false;
      
      // Update recording time
      this.updateRecordingTime();
      
      this.emitEvent(RecordingEventType.TRIGGER_DEACTIVATED, {
        reason,
        timestamp: new Date(),
        keyPressed: this.isKeyPressed
      });
    }
  }

  private handleAudioData(data: Float32Array): void {
    try {
      // Calculate audio level
      const audioLevel = this.calculateAudioLevel(data);
      this.currentAudioLevel = audioLevel;
      this.audioLevelSum += audioLevel;
      this.audioLevelCount++;
      this.peakAudioLevel = Math.max(this.peakAudioLevel, audioLevel);
      
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

  private updateModifierState(event: KeyboardRecordingEvent): void {
    // Update current modifier state based on event
    ['Control', 'Alt', 'Shift', 'Meta'].forEach(modifier => {
      const isPressed = event.modifiers.includes(modifier.toLowerCase());
      if (isPressed) {
        this.currentModifiers.add(modifier);
      } else if (event.key === modifier) {
        // Key release for modifier key
        this.currentModifiers.delete(modifier);
      }
    });
  }

  private isTargetKeyEvent(event: KeyboardRecordingEvent): boolean {
    // Check if this is the target key
    const isTargetKey = event.key === this.configuration.pushToTalkKey || 
                       event.code === this.configuration.pushToTalkKey;
    
    if (!isTargetKey) {
      return false;
    }
    
    // Check if required modifiers are pressed
    const requiredModifiers = this.configuration.pushToTalkModifiers;
    const pressedModifiers = event.modifiers;
    
    // All required modifiers must be pressed
    for (const modifier of requiredModifiers) {
      if (!pressedModifiers.includes(modifier)) {
        return false;
      }
    }
    
    // No extra modifiers should be pressed (unless explicitly allowed)
    for (const modifier of pressedModifiers) {
      if (!requiredModifiers.includes(modifier)) {
        return false;
      }
    }
    
    return true;
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

  private setupHoldTimeout(): void {
    this.clearHoldTimeout();
    
    // Prevent excessively long key holds
    const maxHoldDuration = Math.min(this.configuration.maxRecordingDuration, 60000); // Max 1 minute hold
    
    if (maxHoldDuration > 0) {
      this.holdTimeoutId = window.setTimeout(() => {
        this.deactivateRecording('hold_timeout');
        this.isKeyPressed = false; // Force key release
      }, maxHoldDuration);
    }
  }

  private clearHoldTimeout(): void {
    if (this.holdTimeoutId !== null) {
      clearTimeout(this.holdTimeoutId);
      this.holdTimeoutId = null;
    }
  }

  private clearAllTimers(): void {
    if (this.maxDurationTimeoutId !== null) {
      clearTimeout(this.maxDurationTimeoutId);
      this.maxDurationTimeoutId = null;
    }
    
    this.clearHoldTimeout();
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
    const levelConsistency = Math.min(1.0, this.currentAudioLevel * 10);
    const errorRate = this.audioLevelCount > 0 ? this.errorCount / this.audioLevelCount : 0;
    const errorPenalty = Math.max(0, 1.0 - errorRate * 10);
    const keyResponseTime = this.isKeyPressed ? 1.0 : 0.5; // Bonus for responsive key handling
    
    return levelConsistency * errorPenalty * keyResponseTime;
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
    this.triggerActivationCount = 0;
    this.keyPressCount = 0;
    this.keyReleaseCount = 0;
    this.audioLevelSum = 0;
    this.audioLevelCount = 0;
    this.peakAudioLevel = 0;
    this.bufferOverflowCount = 0;
    this.errorCount = 0;
    this.qualityScores = [];
    this.currentModifiers.clear();
    this.lastKeyEvent = null;
  }

  private validateConfiguration(config?: RecordingStrategyConfiguration): void {
    const configToValidate = config || this.configuration;
    
    if (!configToValidate.pushToTalkKey || configToValidate.pushToTalkKey.trim().length === 0) {
      throw new Error('Push-to-talk key must be specified');
    }
    
    if (!Array.isArray(configToValidate.pushToTalkModifiers)) {
      throw new Error('Push-to-talk modifiers must be an array');
    }
    
    const validModifiers = ['ctrl', 'alt', 'shift', 'meta'];
    for (const modifier of configToValidate.pushToTalkModifiers) {
      if (!validModifiers.includes(modifier.toLowerCase())) {
        throw new Error(`Invalid modifier: ${modifier}. Valid modifiers are: ${validModifiers.join(', ')}`);
      }
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
 * Simple keyboard event handler implementation
 */
class SimpleKeyboardEventHandler implements IKeyboardEventHandler {
  private config: KeyboardEventConfig = {
    targetKey: 'Space',
    modifiers: [],
    preventDefault: true,
    stopPropagation: true,
    enableOnlyWhenFocused: false,
    enableGlobalCapture: true
  };
  
  private enabled: boolean = false;
  private keyEventCallback: ((event: KeyboardRecordingEvent) => void) | null = null;
  
  // Event handlers
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;

  initialize(config: KeyboardEventConfig): void {
    this.config = { ...config };
    this.setupEventHandlers();
  }

  onKeyEvent(callback: (event: KeyboardRecordingEvent) => void): void {
    this.keyEventCallback = callback;
  }

  updateConfiguration(config: Partial<KeyboardEventConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  cleanup(): void {
    this.removeEventHandlers();
    this.keyEventCallback = null;
    this.enabled = false;
  }

  private setupEventHandlers(): void {
    this.keyDownHandler = (event: KeyboardEvent) => {
      if (this.enabled) {
        this.handleKeyEvent('keydown', event);
      }
    };
    
    this.keyUpHandler = (event: KeyboardEvent) => {
      if (this.enabled) {
        this.handleKeyEvent('keyup', event);
      }
    };
    
    // Add global event listeners
    if (this.config.enableGlobalCapture) {
      document.addEventListener('keydown', this.keyDownHandler, true);
      document.addEventListener('keyup', this.keyUpHandler, true);
    } else {
      window.addEventListener('keydown', this.keyDownHandler);
      window.addEventListener('keyup', this.keyUpHandler);
    }
  }

  private removeEventHandlers(): void {
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler, true);
      window.removeEventListener('keydown', this.keyDownHandler);
    }
    
    if (this.keyUpHandler) {
      document.removeEventListener('keyup', this.keyUpHandler, true);
      window.removeEventListener('keyup', this.keyUpHandler);
    }
    
    this.keyDownHandler = null;
    this.keyUpHandler = null;
  }

  private handleKeyEvent(type: 'keydown' | 'keyup', event: KeyboardEvent): void {
    if (!this.keyEventCallback) {
      return;
    }
    
    // Check focus requirements
    if (this.config.enableOnlyWhenFocused && !document.hasFocus()) {
      return;
    }
    
    // Extract modifiers
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    
    // Create recording event
    const recordingEvent: KeyboardRecordingEvent = {
      type,
      key: event.key,
      code: event.code,
      modifiers,
      timestamp: performance.now(),
      preventDefault: () => {
        if (this.config.preventDefault) {
          event.preventDefault();
        }
      },
      stopPropagation: () => {
        if (this.config.stopPropagation) {
          event.stopPropagation();
        }
      }
    };
    
    // Call the callback
    this.keyEventCallback(recordingEvent);
  }
}