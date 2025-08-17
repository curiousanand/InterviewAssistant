import {
  IAudioCapture,
  AudioCaptureState,
  AudioCaptureError,
  AudioCaptureErrorType,
  AudioCaptureConfiguration,
  AudioCaptureCapabilities,
  DEFAULT_AUDIO_CAPTURE_CONFIG
} from '../interfaces/IAudioCapture';

/**
 * MediaRecorder-based audio capture implementation
 * 
 * Why: Provides fallback audio capture using MediaRecorder API
 * Pattern: Strategy Pattern - implements audio capture using MediaRecorder API
 * Rationale: Ensures browser compatibility when AudioWorklet is not available
 */
export class MediaRecorderCapture implements IAudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  
  private state: AudioCaptureState = AudioCaptureState.IDLE;
  private configuration: AudioCaptureConfiguration;
  private currentAudioLevel: number = 0;
  private audioLevelMonitoringEnabled: boolean = true;
  
  // Event handlers
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private errorCallback: ((error: AudioCaptureError) => void) | null = null;
  private stateChangeCallback: ((state: AudioCaptureState) => void) | null = null;

  // Recording state
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private recordingStartTime: number = 0;
  private audioChunks: Blob[] = [];
  
  // Audio level monitoring
  private audioLevelIntervalId: number | null = null;
  private audioDataArray: Uint8Array | null = null;
  
  // Silence detection
  private silenceDetectionEnabled: boolean = false;
  private silenceThreshold: number = 0.01;
  private silenceStartTime: number = 0;
  private lastVoiceTime: number = 0;
  private isCurrentlySilent: boolean = false;

  // Performance tracking
  private frameCount: number = 0;
  private dropCount: number = 0;
  
  constructor(config?: Partial<AudioCaptureConfiguration>) {
    this.configuration = { ...DEFAULT_AUDIO_CAPTURE_CONFIG, ...config };
    this.silenceDetectionEnabled = this.configuration.silenceDetection;
    this.silenceThreshold = this.configuration.silenceThreshold;
  }

  async start(constraints?: MediaStreamConstraints): Promise<void> {
    if (this.state !== AudioCaptureState.IDLE) {
      throw this.createError(
        AudioCaptureErrorType.CONFIGURATION_ERROR,
        'Audio capture is already active',
        false,
        false
      );
    }

    this.setState(AudioCaptureState.STARTING);

    try {
      // Check MediaRecorder support
      if (!this.isMediaRecorderSupported()) {
        throw this.createError(
          AudioCaptureErrorType.BROWSER_NOT_SUPPORTED,
          'MediaRecorder is not supported in this browser',
          false,
          false
        );
      }

      // Get media stream
      await this.getMediaStream(constraints);

      // Setup audio context for level monitoring
      await this.setupAudioContext();

      // Setup MediaRecorder
      this.setupMediaRecorder();

      // Start recording
      this.startRecording();

      this.recordingStartTime = performance.now();
      this.frameCount = 0;
      this.dropCount = 0;

      this.setState(AudioCaptureState.CAPTURING);

    } catch (error) {
      this.setState(AudioCaptureState.ERROR);
      await this.cleanup();
      
      if (error instanceof Error && (error as any).isAudioCaptureError) {
        throw error;
      }
      
      throw this.createError(
        AudioCaptureErrorType.UNKNOWN_ERROR,
        `Failed to start audio capture: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  async stop(): Promise<void> {
    if (this.state === AudioCaptureState.IDLE) {
      return;
    }

    this.setState(AudioCaptureState.STOPPING);

    try {
      this.stopRecording();
      await this.cleanup();
      this.setState(AudioCaptureState.IDLE);
    } catch (error) {
      this.setState(AudioCaptureState.ERROR);
      throw this.createError(
        AudioCaptureErrorType.UNKNOWN_ERROR,
        `Failed to stop audio capture: ${error instanceof Error ? error.message : String(error)}`,
        false,
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  async pause(): Promise<void> {
    if (this.state !== AudioCaptureState.CAPTURING) {
      throw this.createError(
        AudioCaptureErrorType.CONFIGURATION_ERROR,
        'Cannot pause audio capture - not currently capturing',
        false,
        false
      );
    }

    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      
      this.stopAudioLevelMonitoring();
      this.isPaused = true;
      this.setState(AudioCaptureState.PAUSED);
    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.MEDIARECORDER_FAILED,
        `Failed to pause audio capture: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  async resume(): Promise<void> {
    if (this.state !== AudioCaptureState.PAUSED) {
      throw this.createError(
        AudioCaptureErrorType.CONFIGURATION_ERROR,
        'Cannot resume audio capture - not currently paused',
        false,
        false
      );
    }

    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
      
      this.startAudioLevelMonitoring();
      this.isPaused = false;
      this.setState(AudioCaptureState.CAPTURING);
    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.MEDIARECORDER_FAILED,
        `Failed to resume audio capture: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  isCapturing(): boolean {
    return this.state === AudioCaptureState.CAPTURING;
  }

  isPaused(): boolean {
    return this.state === AudioCaptureState.PAUSED;
  }

  getState(): AudioCaptureState {
    return this.state;
  }

  onAudioData(callback: (data: Float32Array) => void): void {
    this.audioDataCallback = callback;
  }

  onError(callback: (error: AudioCaptureError) => void): void {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: AudioCaptureState) => void): void {
    this.stateChangeCallback = callback;
  }

  removeAllListeners(): void {
    this.audioDataCallback = null;
    this.errorCallback = null;
    this.stateChangeCallback = null;
  }

  getConfiguration(): AudioCaptureConfiguration {
    return { ...this.configuration };
  }

  async updateConfiguration(config: Partial<AudioCaptureConfiguration>): Promise<void> {
    const newConfig = { ...this.configuration, ...config };
    
    // Validate configuration
    this.validateConfiguration(newConfig);
    
    this.configuration = newConfig;

    // Update silence detection settings
    if (config.silenceDetection !== undefined) {
      this.silenceDetectionEnabled = config.silenceDetection;
    }
    
    if (config.silenceThreshold !== undefined) {
      this.silenceThreshold = config.silenceThreshold;
    }

    // Update audio level monitoring
    if (config.audioLevelMonitoring !== undefined) {
      this.audioLevelMonitoringEnabled = config.audioLevelMonitoring;
      
      if (this.state === AudioCaptureState.CAPTURING) {
        if (this.audioLevelMonitoringEnabled) {
          this.startAudioLevelMonitoring();
        } else {
          this.stopAudioLevelMonitoring();
        }
      }
    }
  }

  getCapabilities(): AudioCaptureCapabilities {
    return {
      implementation: 'MediaRecorder',
      supportsRealTime: false, // MediaRecorder provides chunks, not real-time samples
      supportsLowLatency: false,
      supportsAudioLevel: true,
      supportsSilenceDetection: true,
      supportsConfiguration: true,
      minSampleRate: 8000,
      maxSampleRate: 48000,
      supportedChannels: [1, 2],
      supportedBitDepths: [16], // MediaRecorder typically uses 16-bit
      minBufferSize: 1024,
      maxBufferSize: 8192,
      estimatedLatency: this.configuration.chunkDuration // Based on chunk duration
    };
  }

  getAudioLevel(): number | null {
    return this.audioLevelMonitoringEnabled ? this.currentAudioLevel : null;
  }

  setAudioLevelMonitoring(enabled: boolean): void {
    this.audioLevelMonitoringEnabled = enabled;
    
    if (this.state === AudioCaptureState.CAPTURING) {
      if (enabled) {
        this.startAudioLevelMonitoring();
      } else {
        this.stopAudioLevelMonitoring();
      }
    }
  }

  private async getMediaStream(constraints?: MediaStreamConstraints): Promise<void> {
    const audioConstraints: MediaTrackConstraints = {
      sampleRate: this.configuration.sampleRate,
      channelCount: this.configuration.channels,
      echoCancellation: this.configuration.echoCancellation,
      noiseSuppression: this.configuration.noiseSuppression,
      autoGainControl: this.configuration.autoGainControl,
      ...(this.configuration.deviceId && { deviceId: this.configuration.deviceId })
    };

    const finalConstraints: MediaStreamConstraints = {
      audio: audioConstraints,
      video: false,
      ...constraints
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
      
      // Handle stream ending
      this.mediaStream.addEventListener('inactive', () => {
        this.handleError(this.createError(
          AudioCaptureErrorType.STREAM_FAILED,
          'Media stream became inactive',
          true,
          true
        ));
      });

    } catch (error) {
      let errorType = AudioCaptureErrorType.UNKNOWN_ERROR;
      let recoverable = false;
      let retryable = true;

      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorType = AudioCaptureErrorType.PERMISSION_DENIED;
            retryable = false;
            break;
          case 'NotFoundError':
            errorType = AudioCaptureErrorType.DEVICE_NOT_FOUND;
            break;
          case 'NotReadableError':
            errorType = AudioCaptureErrorType.DEVICE_IN_USE;
            break;
          case 'AbortError':
            errorType = AudioCaptureErrorType.STREAM_FAILED;
            break;
        }
      }

      throw this.createError(
        errorType,
        `Failed to get media stream: ${error instanceof Error ? error.message : String(error)}`,
        recoverable,
        retryable,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async setupAudioContext(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.configuration.sampleRate
      });

      if (!this.mediaStream) {
        throw new Error('Media stream not available');
      }

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create analyzer for audio level monitoring
      this.analyzerNode = this.audioContext.createAnalyser();
      this.analyzerNode.fftSize = 256;
      this.analyzerNode.smoothingTimeConstant = 0.8;

      // Connect nodes
      this.sourceNode.connect(this.analyzerNode);

      // Initialize audio data array
      this.audioDataArray = new Uint8Array(this.analyzerNode.frequencyBinCount);

    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
        `Failed to setup audio context: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private setupMediaRecorder(): void {
    if (!this.mediaStream) {
      throw new Error('Media stream not available');
    }

    try {
      // Determine MIME type
      const mimeType = this.getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: this.configuration.sampleRate * this.configuration.bitDepth * this.configuration.channels
      });

      // Handle data available
      this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        this.handleError(this.createError(
          AudioCaptureErrorType.MEDIARECORDER_FAILED,
          `MediaRecorder error: ${(event as any).error?.message || 'Unknown error'}`,
          true,
          true,
          (event as any).error
        ));
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        this.processAudioChunks();
      };

    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.MEDIARECORDER_FAILED,
        `Failed to setup MediaRecorder: ${error instanceof Error ? error.message : String(error)}`,
        false,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private startRecording(): void {
    if (!this.mediaRecorder) {
      throw new Error('MediaRecorder not initialized');
    }

    try {
      this.audioChunks = [];
      this.isRecording = true;
      
      // Start recording with time slices for regular data events
      this.mediaRecorder.start(this.configuration.chunkDuration);
      
      // Start audio level monitoring
      if (this.audioLevelMonitoringEnabled) {
        this.startAudioLevelMonitoring();
      }

    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.MEDIARECORDER_FAILED,
        `Failed to start recording: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private stopRecording(): void {
    try {
      this.isRecording = false;
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      this.stopAudioLevelMonitoring();

    } catch (error) {
      console.warn('Error stopping MediaRecorder:', error);
    }
  }

  private handleDataAvailable(event: BlobEvent): void {
    if (event.data && event.data.size > 0) {
      this.audioChunks.push(event.data);
      this.frameCount++;
      
      // Convert blob to audio data
      this.convertBlobToAudioData(event.data);
    }
  }

  private async convertBlobToAudioData(blob: Blob): Promise<void> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      
      // Decode audio data
      if (this.audioContext) {
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Convert to Float32Array
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        
        if (this.audioDataCallback) {
          this.audioDataCallback(channelData);
        }
      }
      
    } catch (error) {
      this.dropCount++;
      console.warn('Failed to convert audio blob:', error);
    }
  }

  private processAudioChunks(): void {
    if (this.audioChunks.length > 0) {
      // Could process final audio chunks here if needed
      this.audioChunks = [];
    }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.analyzerNode || !this.audioDataArray) {
      return;
    }

    this.stopAudioLevelMonitoring(); // Clear any existing interval
    
    this.audioLevelIntervalId = window.setInterval(() => {
      if (!this.analyzerNode || !this.audioDataArray) {
        return;
      }

      this.analyzerNode.getByteFrequencyData(this.audioDataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < this.audioDataArray.length; i++) {
        sum += this.audioDataArray[i] * this.audioDataArray[i];
      }
      
      const rms = Math.sqrt(sum / this.audioDataArray.length);
      this.currentAudioLevel = rms / 255; // Normalize to 0-1
      
      // Silence detection
      if (this.silenceDetectionEnabled) {
        this.processSilenceDetection(this.currentAudioLevel);
      }
      
    }, 50); // Update every 50ms
  }

  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelIntervalId !== null) {
      clearInterval(this.audioLevelIntervalId);
      this.audioLevelIntervalId = null;
    }
  }

  private processSilenceDetection(audioLevel: number): void {
    const now = performance.now();
    const isSilent = audioLevel < this.silenceThreshold;
    
    if (isSilent && !this.isCurrentlySilent) {
      // Silence started
      this.isCurrentlySilent = true;
      this.silenceStartTime = now;
    } else if (!isSilent && this.isCurrentlySilent) {
      // Voice detected after silence
      this.isCurrentlySilent = false;
      this.lastVoiceTime = now;
    } else if (!isSilent) {
      // Ongoing voice
      this.lastVoiceTime = now;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Stop recording
      this.stopRecording();
      
      // Stop audio level monitoring
      this.stopAudioLevelMonitoring();

      // Disconnect audio nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      if (this.analyzerNode) {
        this.analyzerNode.disconnect();
        this.analyzerNode = null;
      }

      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Reset state
      this.mediaRecorder = null;
      this.currentAudioLevel = 0;
      this.audioChunks = [];
      this.audioDataArray = null;
      this.isRecording = false;
      this.isPaused = false;

    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  private setState(newState: AudioCaptureState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateChangeCallback?.(newState);
    }
  }

  private handleError(error: AudioCaptureError): void {
    this.setState(AudioCaptureState.ERROR);
    this.errorCallback?.(error);
  }

  private createError(
    type: AudioCaptureErrorType,
    message: string,
    recoverable: boolean,
    retryable: boolean,
    originalError?: Error
  ): AudioCaptureError {
    const error = {
      type,
      message,
      originalError,
      timestamp: new Date(),
      recoverable,
      retryable
    } as AudioCaptureError;

    (error as any).isAudioCaptureError = true;
    return error;
  }

  private validateConfiguration(config: AudioCaptureConfiguration): void {
    if (config.sampleRate < 8000 || config.sampleRate > 48000) {
      throw new Error('Sample rate must be between 8000 and 48000 Hz for MediaRecorder');
    }

    if (config.channels < 1 || config.channels > 2) {
      throw new Error('Channels must be 1 or 2');
    }

    if (config.chunkDuration < 50 || config.chunkDuration > 5000) {
      throw new Error('Chunk duration must be between 50 and 5000 milliseconds');
    }

    if (config.silenceThreshold < 0 || config.silenceThreshold > 1) {
      throw new Error('Silence threshold must be between 0.0 and 1.0');
    }
  }

  private isMediaRecorderSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported;
  }

  private getSupportedMimeType(): string {
    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];

    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return '';
  }

  // Performance monitoring methods
  getPerformanceStats() {
    const elapsedTime = (performance.now() - this.recordingStartTime) / 1000;
    return {
      chunksProcessed: this.frameCount,
      chunksDropped: this.dropCount,
      chunkRate: elapsedTime > 0 ? this.frameCount / elapsedTime : 0,
      dropRate: this.frameCount > 0 ? this.dropCount / this.frameCount : 0,
      elapsedTime,
      isRecording: this.isRecording
    };
  }

  // Silence detection status
  getSilenceDetectionStatus() {
    return {
      enabled: this.silenceDetectionEnabled,
      threshold: this.silenceThreshold,
      currentlyInSilence: this.isCurrentlySilent,
      lastVoiceTime: this.lastVoiceTime,
      silenceStartTime: this.silenceStartTime
    };
  }
}