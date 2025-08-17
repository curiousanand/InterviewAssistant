/**
 * Audio capture interface for abstracting browser audio APIs
 * 
 * Why: Provides consistent interface across different browser audio implementations
 * Pattern: Interface Segregation - defines minimal audio capture contract
 * Rationale: Enables polymorphic audio capture with different strategies
 */
export interface IAudioCapture {
  /**
   * Start audio capture
   * @param constraints MediaStreamConstraints for audio configuration
   * @returns Promise that resolves when capture starts
   */
  start(constraints?: MediaStreamConstraints): Promise<void>;

  /**
   * Stop audio capture and cleanup resources
   * @returns Promise that resolves when capture stops
   */
  stop(): Promise<void>;

  /**
   * Pause audio capture temporarily
   * @returns Promise that resolves when capture pauses
   */
  pause(): Promise<void>;

  /**
   * Resume paused audio capture
   * @returns Promise that resolves when capture resumes
   */
  resume(): Promise<void>;

  /**
   * Check if audio capture is currently active
   * @returns True if capturing audio
   */
  isCapturing(): boolean;

  /**
   * Check if audio capture is paused
   * @returns True if capture is paused
   */
  isPaused(): boolean;

  /**
   * Get current audio capture state
   * @returns Current capture state
   */
  getState(): AudioCaptureState;

  /**
   * Register callback for audio data chunks
   * @param callback Function to handle audio data
   */
  onAudioData(callback: (data: Float32Array) => void): void;

  /**
   * Register callback for audio capture errors
   * @param callback Function to handle errors
   */
  onError(callback: (error: AudioCaptureError) => void): void;

  /**
   * Register callback for state changes
   * @param callback Function to handle state changes
   */
  onStateChange(callback: (state: AudioCaptureState) => void): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;

  /**
   * Get current audio capture configuration
   * @returns Current audio configuration
   */
  getConfiguration(): AudioCaptureConfiguration;

  /**
   * Update audio capture configuration
   * @param config New configuration to apply
   * @returns Promise that resolves when configuration is updated
   */
  updateConfiguration(config: Partial<AudioCaptureConfiguration>): Promise<void>;

  /**
   * Get capture capabilities of current implementation
   * @returns Capabilities information
   */
  getCapabilities(): AudioCaptureCapabilities;

  /**
   * Get current audio level (0.0 to 1.0)
   * @returns Audio level or null if not available
   */
  getAudioLevel(): number | null;

  /**
   * Enable/disable audio level monitoring
   * @param enabled Whether to monitor audio levels
   */
  setAudioLevelMonitoring(enabled: boolean): void;
}

/**
 * Audio capture state enumeration
 */
export enum AudioCaptureState {
  IDLE = 'idle',
  STARTING = 'starting',
  CAPTURING = 'capturing',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * Audio capture error types
 */
export enum AudioCaptureErrorType {
  PERMISSION_DENIED = 'permission_denied',
  DEVICE_NOT_FOUND = 'device_not_found',
  DEVICE_IN_USE = 'device_in_use',
  BROWSER_NOT_SUPPORTED = 'browser_not_supported',
  AUDIO_CONTEXT_FAILED = 'audio_context_failed',
  WORKLET_FAILED = 'worklet_failed',
  MEDIARECORDER_FAILED = 'mediarecorder_failed',
  STREAM_FAILED = 'stream_failed',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Audio capture error information
 */
export interface AudioCaptureError {
  type: AudioCaptureErrorType;
  message: string;
  originalError?: Error;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * Audio capture configuration
 */
export interface AudioCaptureConfiguration {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  deviceId?: string;
  audioLevelMonitoring: boolean;
  silenceDetection: boolean;
  silenceThreshold: number; // 0.0 to 1.0
  chunkDuration: number; // milliseconds
}

/**
 * Audio capture capabilities
 */
export interface AudioCaptureCapabilities {
  implementation: string;
  supportsRealTime: boolean;
  supportsLowLatency: boolean;
  supportsAudioLevel: boolean;
  supportsSilenceDetection: boolean;
  supportsConfiguration: boolean;
  minSampleRate: number;
  maxSampleRate: number;
  supportedChannels: number[];
  supportedBitDepths: number[];
  minBufferSize: number;
  maxBufferSize: number;
  estimatedLatency: number; // milliseconds
}

/**
 * Default audio capture configuration
 */
export const DEFAULT_AUDIO_CAPTURE_CONFIG: AudioCaptureConfiguration = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  bufferSize: 4096,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  audioLevelMonitoring: true,
  silenceDetection: false,
  silenceThreshold: 0.01,
  chunkDuration: 100 // 100ms chunks for low latency
};

/**
 * Audio capture factory interface
 */
export interface IAudioCaptureFactory {
  /**
   * Create audio capture instance based on browser capabilities
   * @param config Optional configuration override
   * @returns Audio capture instance
   */
  createCapture(config?: Partial<AudioCaptureConfiguration>): Promise<IAudioCapture>;

  /**
   * Check if AudioWorklet is supported
   * @returns True if AudioWorklet is available
   */
  supportsAudioWorklet(): boolean;

  /**
   * Check if MediaRecorder is supported
   * @returns True if MediaRecorder is available
   */
  supportsMediaRecorder(): boolean;

  /**
   * Get list of available audio input devices
   * @returns Promise resolving to device list
   */
  getAvailableDevices(): Promise<MediaDeviceInfo[]>;

  /**
   * Get recommended configuration for current browser
   * @returns Recommended configuration
   */
  getRecommendedConfiguration(): AudioCaptureConfiguration;
}