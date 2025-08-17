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
 * AudioWorklet-based audio capture implementation
 * 
 * Why: Provides low-latency, real-time audio processing using AudioWorklet
 * Pattern: Strategy Pattern - implements audio capture using AudioWorklet API
 * Rationale: Offers best performance and lowest latency for supported browsers
 */
export class AudioWorkletCapture implements IAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
  private state: AudioCaptureState = AudioCaptureState.IDLE;
  private configuration: AudioCaptureConfiguration;
  private currentAudioLevel: number = 0;
  private audioLevelMonitoringEnabled: boolean = true;
  
  // Event handlers
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private errorCallback: ((error: AudioCaptureError) => void) | null = null;
  private stateChangeCallback: ((state: AudioCaptureState) => void) | null = null;

  // Performance tracking
  private startTime: number = 0;
  private frameCount: number = 0;
  private dropCount: number = 0;
  
  constructor(config?: Partial<AudioCaptureConfiguration>) {
    this.configuration = { ...DEFAULT_AUDIO_CAPTURE_CONFIG, ...config };
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
      // Check AudioWorklet support
      if (!this.isAudioWorkletSupported()) {
        throw this.createError(
          AudioCaptureErrorType.BROWSER_NOT_SUPPORTED,
          'AudioWorklet is not supported in this browser',
          false,
          false
        );
      }

      // Create audio context
      await this.createAudioContext();

      // Get media stream
      await this.getMediaStream(constraints);

      // Setup audio worklet
      await this.setupAudioWorklet();

      // Connect audio nodes
      this.connectAudioNodes();

      this.startTime = performance.now();
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
      if (this.audioContext && this.audioContext.state === 'running') {
        await this.audioContext.suspend();
      }
      this.setState(AudioCaptureState.PAUSED);
    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
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
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.setState(AudioCaptureState.CAPTURING);
    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
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

    // Update worklet configuration if active
    if (this.workletNode && this.state === AudioCaptureState.CAPTURING) {
      this.workletNode.port.postMessage({
        type: 'update-config',
        data: {
          enableSilenceDetection: this.configuration.silenceDetection,
          silenceThreshold: this.configuration.silenceThreshold,
          enableAudioLevel: this.configuration.audioLevelMonitoring
        }
      });
    }
  }

  getCapabilities(): AudioCaptureCapabilities {
    return {
      implementation: 'AudioWorklet',
      supportsRealTime: true,
      supportsLowLatency: true,
      supportsAudioLevel: true,
      supportsSilenceDetection: true,
      supportsConfiguration: true,
      minSampleRate: 8000,
      maxSampleRate: 96000,
      supportedChannels: [1, 2],
      supportedBitDepths: [16, 24, 32],
      minBufferSize: 256,
      maxBufferSize: 16384,
      estimatedLatency: this.configuration.bufferSize / this.configuration.sampleRate * 1000 // ms
    };
  }

  getAudioLevel(): number | null {
    return this.audioLevelMonitoringEnabled ? this.currentAudioLevel : null;
  }

  setAudioLevelMonitoring(enabled: boolean): void {
    this.audioLevelMonitoringEnabled = enabled;
  }

  private async createAudioContext(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.configuration.sampleRate,
        latencyHint: 'interactive'
      });

      // Handle audio context state changes
      this.audioContext.addEventListener('statechange', () => {
        if (this.audioContext?.state === 'closed') {
          this.handleError(this.createError(
            AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
            'Audio context was closed unexpectedly',
            true,
            true
          ));
        }
      });

      // Ensure audio context is running
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
        `Failed to create audio context: ${error instanceof Error ? error.message : String(error)}`,
        false,
        true,
        error instanceof Error ? error : undefined
      );
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

  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Load audio worklet module
      const workletUrl = this.createWorkletBlobUrl();
      await this.audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Create worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        processorOptions: {
          sampleRate: this.configuration.sampleRate,
          channels: this.configuration.channels,
          bufferSize: this.configuration.bufferSize,
          enableSilenceDetection: this.configuration.silenceDetection,
          silenceThreshold: this.configuration.silenceThreshold,
          enableAudioLevel: this.configuration.audioLevelMonitoring
        }
      });

      // Handle worklet messages
      this.workletNode.port.onmessage = this.handleWorkletMessage.bind(this);

      // Handle worklet errors
      this.workletNode.addEventListener('processorerror', (event) => {
        this.handleError(this.createError(
          AudioCaptureErrorType.WORKLET_FAILED,
          'Audio worklet processor error',
          true,
          true,
          event as any
        ));
      });

    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.WORKLET_FAILED,
        `Failed to setup audio worklet: ${error instanceof Error ? error.message : String(error)}`,
        false,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private connectAudioNodes(): void {
    if (!this.audioContext || !this.mediaStream || !this.workletNode) {
      throw new Error('Audio components not initialized');
    }

    try {
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.workletNode);
    } catch (error) {
      throw this.createError(
        AudioCaptureErrorType.AUDIO_CONTEXT_FAILED,
        `Failed to connect audio nodes: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  private handleWorkletMessage(event: MessageEvent): void {
    try {
      const message = event.data;

      switch (message.type) {
        case 'audio-data':
          this.handleAudioData(message.data);
          break;

        case 'audio-level':
          this.handleAudioLevel(message.data);
          break;

        case 'silence-detected':
        case 'voice-detected':
          // These events could be used for voice activity detection
          break;

        case 'error':
          this.handleError(this.createError(
            AudioCaptureErrorType.WORKLET_FAILED,
            message.data.message || 'Worklet error',
            true,
            true
          ));
          break;

        default:
          console.debug('Unknown worklet message type:', message.type);
      }
    } catch (error) {
      this.handleError(this.createError(
        AudioCaptureErrorType.WORKLET_FAILED,
        `Error handling worklet message: ${error instanceof Error ? error.message : String(error)}`,
        true,
        true,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private handleAudioData(data: any): void {
    if (!this.audioDataCallback) {
      return;
    }

    try {
      // Convert Int16Array back to Float32Array
      const int16Data = data.audioData as Int16Array;
      const float32Data = new Float32Array(int16Data.length);
      
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32767;
      }

      this.frameCount++;
      this.audioDataCallback(float32Data);

    } catch (error) {
      this.dropCount++;
      console.warn('Failed to process audio data:', error);
    }
  }

  private handleAudioLevel(data: any): void {
    if (this.audioLevelMonitoringEnabled) {
      this.currentAudioLevel = data.level || 0;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Disconnect and cleanup worklet
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }

      // Disconnect source node
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
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
      this.currentAudioLevel = 0;
      this.frameCount = 0;
      this.dropCount = 0;

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
    if (config.sampleRate < 8000 || config.sampleRate > 96000) {
      throw new Error('Sample rate must be between 8000 and 96000 Hz');
    }

    if (config.channels < 1 || config.channels > 2) {
      throw new Error('Channels must be 1 or 2');
    }

    if (config.bufferSize < 256 || config.bufferSize > 16384) {
      throw new Error('Buffer size must be between 256 and 16384');
    }

    if (config.silenceThreshold < 0 || config.silenceThreshold > 1) {
      throw new Error('Silence threshold must be between 0.0 and 1.0');
    }
  }

  private isAudioWorkletSupported(): boolean {
    return typeof AudioWorkletNode !== 'undefined' && 
           typeof AudioContext !== 'undefined' &&
           'audioWorklet' in AudioContext.prototype;
  }

  private createWorkletBlobUrl(): string {
    // Import the worklet code
    const workletCode = `
      // Audio worklet processor code would be injected here
      // This is a simplified version - the actual implementation would load the worklet file
      class AudioCaptureProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          this.bufferSize = options.processorOptions?.bufferSize || 4096;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }
        
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0];
            for (let i = 0; i < inputData.length; i++) {
              this.buffer[this.bufferIndex] = inputData[i];
              this.bufferIndex++;
              
              if (this.bufferIndex >= this.bufferSize) {
                this.port.postMessage({
                  type: 'audio-data',
                  data: { audioData: this.buffer.slice() },
                  timestamp: Date.now()
                });
                this.bufferIndex = 0;
              }
            }
          }
          return true;
        }
      }
      
      registerProcessor('audio-capture-processor', AudioCaptureProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  // Performance monitoring methods
  getPerformanceStats() {
    const elapsedTime = (performance.now() - this.startTime) / 1000;
    return {
      framesProcessed: this.frameCount,
      framesDropped: this.dropCount,
      frameRate: elapsedTime > 0 ? this.frameCount / elapsedTime : 0,
      dropRate: this.frameCount > 0 ? this.dropCount / this.frameCount : 0,
      elapsedTime
    };
  }
}