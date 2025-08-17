import { IAudioCapture } from './IAudioCapture';

/**
 * Recording strategy interface for different recording behaviors
 * 
 * Why: Enables different recording modes and patterns for various use cases
 * Pattern: Strategy Pattern - defines interchangeable recording behaviors
 * Rationale: Provides flexibility in how audio recording is triggered and managed
 */
export interface IRecordingStrategy {
  /**
   * Initialize the recording strategy
   * @param audioCapture Audio capture implementation to use
   * @param config Strategy-specific configuration
   */
  initialize(audioCapture: IAudioCapture, config?: Partial<RecordingStrategyConfiguration>): Promise<void>;

  /**
   * Start recording with this strategy
   */
  startRecording(): Promise<void>;

  /**
   * Stop recording
   */
  stopRecording(): Promise<void>;

  /**
   * Pause recording (if supported)
   */
  pauseRecording(): Promise<void>;

  /**
   * Resume recording (if supported)
   */
  resumeRecording(): Promise<void>;

  /**
   * Check if recording is currently active
   */
  isRecording(): boolean;

  /**
   * Check if recording is paused
   */
  isPaused(): boolean;

  /**
   * Get current recording state
   */
  getState(): RecordingState;

  /**
   * Get strategy name for identification
   */
  getStrategyName(): string;

  /**
   * Get strategy capabilities
   */
  getCapabilities(): RecordingStrategyCapabilities;

  /**
   * Update strategy configuration
   */
  updateConfiguration(config: Partial<RecordingStrategyConfiguration>): Promise<void>;

  /**
   * Get current configuration
   */
  getConfiguration(): RecordingStrategyConfiguration;

  /**
   * Register callback for recording events
   */
  onRecordingEvent(callback: (event: RecordingEvent) => void): void;

  /**
   * Register callback for audio data
   */
  onAudioData(callback: (data: Float32Array) => void): void;

  /**
   * Register callback for errors
   */
  onError(callback: (error: RecordingStrategyError) => void): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;

  /**
   * Get strategy statistics
   */
  getStatistics(): RecordingStatistics;
}

/**
 * Recording state enumeration
 */
export enum RecordingState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * Recording event types
 */
export enum RecordingEventType {
  RECORDING_STARTED = 'recording_started',
  RECORDING_STOPPED = 'recording_stopped',
  RECORDING_PAUSED = 'recording_paused',
  RECORDING_RESUMED = 'recording_resumed',
  VOICE_DETECTED = 'voice_detected',
  SILENCE_DETECTED = 'silence_detected',
  TRIGGER_ACTIVATED = 'trigger_activated',
  TRIGGER_DEACTIVATED = 'trigger_deactivated',
  TIMEOUT_REACHED = 'timeout_reached',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Recording event information
 */
export interface RecordingEvent {
  type: RecordingEventType;
  timestamp: Date;
  data?: any;
  strategyName: string;
}

/**
 * Recording strategy error
 */
export interface RecordingStrategyError {
  type: RecordingStrategyErrorType;
  message: string;
  originalError?: Error;
  timestamp: Date;
  recoverable: boolean;
  strategyName: string;
}

/**
 * Recording strategy error types
 */
export enum RecordingStrategyErrorType {
  INITIALIZATION_FAILED = 'initialization_failed',
  AUDIO_CAPTURE_FAILED = 'audio_capture_failed',
  VOICE_DETECTION_FAILED = 'voice_detection_failed',
  KEYBOARD_EVENT_FAILED = 'keyboard_event_failed',
  CONFIGURATION_ERROR = 'configuration_error',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Recording strategy configuration
 */
export interface RecordingStrategyConfiguration {
  // Common settings
  maxRecordingDuration: number; // milliseconds, 0 = unlimited
  autoStopOnSilence: boolean;
  silenceTimeout: number; // milliseconds
  
  // Voice activation settings
  voiceActivationEnabled: boolean;
  voiceThreshold: number; // 0.0 to 1.0
  voiceDetectionDelay: number; // milliseconds
  silenceDetectionDelay: number; // milliseconds
  
  // Push-to-talk settings
  pushToTalkKey: string; // key code or key name
  pushToTalkModifiers: string[]; // modifier keys (ctrl, alt, shift, meta)
  holdToRecord: boolean; // true = hold key, false = toggle
  
  // Continuous recording settings
  chunkDuration: number; // milliseconds
  enableBackgroundRecording: boolean;
  
  // Audio processing settings
  enableNoiseGate: boolean;
  noiseGateThreshold: number; // 0.0 to 1.0
  enableCompression: boolean;
  compressionRatio: number;
  
  // Advanced settings
  bufferOverflowStrategy: BufferOverflowStrategy;
  enableRecordingQuality: boolean;
  qualityMonitoringInterval: number; // milliseconds
}

/**
 * Buffer overflow strategies
 */
export enum BufferOverflowStrategy {
  DROP_OLDEST = 'drop_oldest',
  DROP_NEWEST = 'drop_newest',
  EXPAND_BUFFER = 'expand_buffer',
  STOP_RECORDING = 'stop_recording'
}

/**
 * Recording strategy capabilities
 */
export interface RecordingStrategyCapabilities {
  strategyName: string;
  supportsVoiceActivation: boolean;
  supportsPushToTalk: boolean;
  supportsContinuousRecording: boolean;
  supportsPauseResume: boolean;
  supportsManualTrigger: boolean;
  supportsAutoStop: boolean;
  supportsQualityMonitoring: boolean;
  supportsNoiseGate: boolean;
  supportsCompression: boolean;
  minimumSilenceTimeout: number;
  maximumRecordingDuration: number;
  supportedKeys: string[];
}

/**
 * Recording statistics
 */
export interface RecordingStatistics {
  strategyName: string;
  totalRecordingTime: number; // milliseconds
  activeRecordingTime: number; // milliseconds
  silenceTime: number; // milliseconds
  voiceDetectionCount: number;
  silenceDetectionCount: number;
  triggerActivationCount: number;
  averageAudioLevel: number;
  peakAudioLevel: number;
  bufferOverflowCount: number;
  errorCount: number;
  qualityScore: number; // 0.0 to 1.0
}

/**
 * Default recording strategy configuration
 */
export const DEFAULT_RECORDING_STRATEGY_CONFIG: RecordingStrategyConfiguration = {
  // Common settings
  maxRecordingDuration: 300000, // 5 minutes
  autoStopOnSilence: true,
  silenceTimeout: 3000, // 3 seconds
  
  // Voice activation settings
  voiceActivationEnabled: true,
  voiceThreshold: 0.01,
  voiceDetectionDelay: 300, // 300ms
  silenceDetectionDelay: 1000, // 1 second
  
  // Push-to-talk settings
  pushToTalkKey: 'Space',
  pushToTalkModifiers: [],
  holdToRecord: true,
  
  // Continuous recording settings
  chunkDuration: 100, // 100ms
  enableBackgroundRecording: false,
  
  // Audio processing settings
  enableNoiseGate: false,
  noiseGateThreshold: 0.005,
  enableCompression: false,
  compressionRatio: 2.0,
  
  // Advanced settings
  bufferOverflowStrategy: BufferOverflowStrategy.DROP_OLDEST,
  enableRecordingQuality: true,
  qualityMonitoringInterval: 1000 // 1 second
};

/**
 * Recording strategy factory interface
 */
export interface IRecordingStrategyFactory {
  /**
   * Create recording strategy by name
   */
  createStrategy(strategyName: string, config?: Partial<RecordingStrategyConfiguration>): Promise<IRecordingStrategy>;

  /**
   * Get available strategy names
   */
  getAvailableStrategies(): string[];

  /**
   * Get strategy capabilities by name
   */
  getStrategyCapabilities(strategyName: string): RecordingStrategyCapabilities;

  /**
   * Get recommended strategy for current environment
   */
  getRecommendedStrategy(): string;
}

/**
 * Voice activity detection interface
 */
export interface IVoiceActivityDetector {
  /**
   * Initialize voice activity detector
   */
  initialize(config: VoiceActivityConfig): Promise<void>;

  /**
   * Process audio data and detect voice activity
   */
  processAudio(audioData: Float32Array): VoiceActivityResult;

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<VoiceActivityConfig>): void;

  /**
   * Get current configuration
   */
  getConfiguration(): VoiceActivityConfig;

  /**
   * Cleanup resources
   */
  cleanup(): void;
}

/**
 * Voice activity configuration
 */
export interface VoiceActivityConfig {
  threshold: number; // 0.0 to 1.0
  frameDuration: number; // milliseconds
  voiceFrameCountThreshold: number;
  silenceFrameCountThreshold: number;
  enableSpectralAnalysis: boolean;
  enableZeroCrossingRate: boolean;
  enableEnergyAnalysis: boolean;
  adaptiveThreshold: boolean;
}

/**
 * Voice activity detection result
 */
export interface VoiceActivityResult {
  isVoice: boolean;
  confidence: number; // 0.0 to 1.0
  energy: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  timestamp: number;
}

/**
 * Keyboard event handler interface
 */
export interface IKeyboardEventHandler {
  /**
   * Initialize keyboard event handling
   */
  initialize(config: KeyboardEventConfig): void;

  /**
   * Register key event callback
   */
  onKeyEvent(callback: (event: KeyboardRecordingEvent) => void): void;

  /**
   * Update key configuration
   */
  updateConfiguration(config: Partial<KeyboardEventConfig>): void;

  /**
   * Enable/disable keyboard event handling
   */
  setEnabled(enabled: boolean): void;

  /**
   * Check if enabled
   */
  isEnabled(): boolean;

  /**
   * Cleanup event listeners
   */
  cleanup(): void;
}

/**
 * Keyboard event configuration
 */
export interface KeyboardEventConfig {
  targetKey: string;
  modifiers: string[];
  preventDefault: boolean;
  stopPropagation: boolean;
  enableOnlyWhenFocused: boolean;
  enableGlobalCapture: boolean;
}

/**
 * Keyboard recording event
 */
export interface KeyboardRecordingEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  modifiers: string[];
  timestamp: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}