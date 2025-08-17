/**
 * Audio Worklet Processor for low-latency audio capture
 * 
 * Why: Provides real-time audio processing with minimal latency
 * Pattern: Worker Pattern - offloads audio processing to dedicated thread
 * Rationale: Enables consistent audio processing without blocking main thread
 */

declare global {
  interface AudioWorkletGlobalScope {
    registerProcessor(name: string, processorClass: any): void;
  }
}

interface AudioProcessorOptions {
  numberOfInputs?: number;
  numberOfOutputs?: number;
  outputChannelCount?: number[];
  parameterData?: Record<string, number>;
  processorOptions?: {
    sampleRate: number;
    channels: number;
    bufferSize: number;
    enableSilenceDetection: boolean;
    silenceThreshold: number;
    enableAudioLevel: boolean;
  };
}

interface AudioProcessorMessage {
  type: 'audio-data' | 'audio-level' | 'silence-detected' | 'voice-detected' | 'error' | 'config-update';
  data?: any;
  timestamp: number;
}

/**
 * Audio processor worklet for real-time audio capture
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  private sampleRate: number;
  private channels: number;
  private bufferSize: number;
  private enableSilenceDetection: boolean;
  private silenceThreshold: number;
  private enableAudioLevel: boolean;

  // Audio processing state
  private audioBuffer: Float32Array[];
  private bufferIndex: number;
  private totalSamples: number;

  // Audio level tracking
  private audioLevelSum: number;
  private audioLevelSamples: number;
  private lastAudioLevel: number;

  // Silence detection
  private silenceCount: number;
  private voiceCount: number;
  private lastVoiceState: boolean;
  private silenceDetectionFrames: number;

  // Performance tracking
  private lastProcessTime: number;
  private frameCount: number;

  constructor(options: AudioProcessorOptions) {
    super();

    // Initialize configuration
    const config = options.processorOptions || {};
    this.sampleRate = config.sampleRate || 16000;
    this.channels = config.channels || 1;
    this.bufferSize = config.bufferSize || 4096;
    this.enableSilenceDetection = config.enableSilenceDetection || false;
    this.silenceThreshold = config.silenceThreshold || 0.01;
    this.enableAudioLevel = config.enableAudioLevel || true;

    // Initialize audio buffers
    this.audioBuffer = [];
    for (let i = 0; i < this.channels; i++) {
      this.audioBuffer[i] = new Float32Array(this.bufferSize);
    }
    this.bufferIndex = 0;
    this.totalSamples = 0;

    // Initialize audio level tracking
    this.audioLevelSum = 0;
    this.audioLevelSamples = 0;
    this.lastAudioLevel = 0;

    // Initialize silence detection
    this.silenceCount = 0;
    this.voiceCount = 0;
    this.lastVoiceState = false;
    this.silenceDetectionFrames = Math.floor(this.sampleRate * 0.1); // 100ms

    // Initialize performance tracking
    this.lastProcessTime = 0;
    this.frameCount = 0;

    // Listen for configuration updates
    this.port.onmessage = this.handleMessage.bind(this);

    this.sendMessage({
      type: 'config-update',
      data: {
        sampleRate: this.sampleRate,
        channels: this.channels,
        bufferSize: this.bufferSize,
        enableSilenceDetection: this.enableSilenceDetection,
        silenceThreshold: this.silenceThreshold,
        enableAudioLevel: this.enableAudioLevel
      },
      timestamp: Date.now()
    });
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const startTime = performance.now();
    
    try {
      const input = inputs[0];
      if (!input || input.length === 0) {
        return true;
      }

      const frameLength = input[0].length;
      let maxAudioLevel = 0;

      // Process each channel
      for (let channel = 0; channel < Math.min(input.length, this.channels); channel++) {
        const inputChannel = input[channel];
        const bufferChannel = this.audioBuffer[channel];

        // Copy input data to buffer
        for (let i = 0; i < frameLength; i++) {
          const sample = inputChannel[i];
          bufferChannel[this.bufferIndex + i] = sample;

          // Track audio level
          if (this.enableAudioLevel) {
            const sampleLevel = Math.abs(sample);
            maxAudioLevel = Math.max(maxAudioLevel, sampleLevel);
            this.audioLevelSum += sampleLevel;
            this.audioLevelSamples++;
          }
        }
      }

      this.bufferIndex += frameLength;
      this.totalSamples += frameLength;

      // Process audio level
      if (this.enableAudioLevel && this.audioLevelSamples > 0) {
        const averageLevel = this.audioLevelSum / this.audioLevelSamples;
        this.lastAudioLevel = Math.max(averageLevel, maxAudioLevel);

        // Send audio level updates periodically
        if (this.frameCount % 10 === 0) { // Every ~10 frames
          this.sendMessage({
            type: 'audio-level',
            data: {
              level: this.lastAudioLevel,
              peak: maxAudioLevel
            },
            timestamp: Date.now()
          });
        }

        // Reset audio level tracking
        this.audioLevelSum = 0;
        this.audioLevelSamples = 0;
      }

      // Process silence detection
      if (this.enableSilenceDetection) {
        this.processSilenceDetection(maxAudioLevel);
      }

      // Send audio data when buffer is full
      if (this.bufferIndex >= this.bufferSize) {
        this.sendAudioData();
        this.resetBuffer();
      }

      this.frameCount++;

      // Track processing performance
      const processingTime = performance.now() - startTime;
      if (processingTime > 1.0) { // Log if processing takes more than 1ms
        console.warn(`Audio processing took ${processingTime.toFixed(2)}ms`);
      }

      return true;

    } catch (error) {
      this.sendMessage({
        type: 'error',
        data: {
          message: 'Audio processing error',
          error: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      });

      return false;
    }
  }

  private processSilenceDetection(audioLevel: number): void {
    const isSilence = audioLevel < this.silenceThreshold;

    if (isSilence) {
      this.silenceCount++;
      this.voiceCount = 0;
    } else {
      this.voiceCount++;
      this.silenceCount = 0;
    }

    // Determine voice state based on consecutive frames
    const currentVoiceState = this.voiceCount > this.silenceDetectionFrames / 10; // 10ms of voice
    
    // Send voice state change events
    if (currentVoiceState !== this.lastVoiceState) {
      this.sendMessage({
        type: currentVoiceState ? 'voice-detected' : 'silence-detected',
        data: {
          voiceState: currentVoiceState,
          audioLevel: audioLevel,
          duration: currentVoiceState ? this.voiceCount : this.silenceCount
        },
        timestamp: Date.now()
      });

      this.lastVoiceState = currentVoiceState;
    }
  }

  private sendAudioData(): void {
    try {
      // Convert Float32Array to Int16Array for efficient transmission
      const int16Buffer = new Int16Array(this.bufferSize * this.channels);
      
      for (let channel = 0; channel < this.channels; channel++) {
        const channelBuffer = this.audioBuffer[channel];
        
        for (let i = 0; i < this.bufferSize; i++) {
          // Convert from float (-1.0 to 1.0) to int16 (-32768 to 32767)
          const sample = Math.max(-1, Math.min(1, channelBuffer[i]));
          int16Buffer[i * this.channels + channel] = Math.round(sample * 32767);
        }
      }

      this.sendMessage({
        type: 'audio-data',
        data: {
          audioData: int16Buffer,
          sampleRate: this.sampleRate,
          channels: this.channels,
          samples: this.bufferSize,
          timestamp: Date.now(),
          totalSamples: this.totalSamples
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.sendMessage({
        type: 'error',
        data: {
          message: 'Failed to send audio data',
          error: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      });
    }
  }

  private resetBuffer(): void {
    this.bufferIndex = 0;
    
    // Clear buffers
    for (let channel = 0; channel < this.channels; channel++) {
      this.audioBuffer[channel].fill(0);
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = event.data;
      
      switch (message.type) {
        case 'update-config':
          this.updateConfiguration(message.data);
          break;
          
        case 'reset-buffers':
          this.resetBuffer();
          break;
          
        case 'get-stats':
          this.sendStats();
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
    } catch (error) {
      this.sendMessage({
        type: 'error',
        data: {
          message: 'Message handling error',
          error: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      });
    }
  }

  private updateConfiguration(config: any): void {
    if (config.enableSilenceDetection !== undefined) {
      this.enableSilenceDetection = config.enableSilenceDetection;
    }
    
    if (config.silenceThreshold !== undefined) {
      this.silenceThreshold = Math.max(0, Math.min(1, config.silenceThreshold));
    }
    
    if (config.enableAudioLevel !== undefined) {
      this.enableAudioLevel = config.enableAudioLevel;
    }

    this.sendMessage({
      type: 'config-update',
      data: {
        enableSilenceDetection: this.enableSilenceDetection,
        silenceThreshold: this.silenceThreshold,
        enableAudioLevel: this.enableAudioLevel
      },
      timestamp: Date.now()
    });
  }

  private sendStats(): void {
    this.sendMessage({
      type: 'stats',
      data: {
        frameCount: this.frameCount,
        totalSamples: this.totalSamples,
        bufferIndex: this.bufferIndex,
        lastAudioLevel: this.lastAudioLevel,
        voiceCount: this.voiceCount,
        silenceCount: this.silenceCount,
        lastVoiceState: this.lastVoiceState
      },
      timestamp: Date.now()
    });
  }

  private sendMessage(message: AudioProcessorMessage): void {
    try {
      this.port.postMessage(message);
    } catch (error) {
      console.error('Failed to send message from audio processor:', error);
    }
  }
}

// Register the processor
try {
  registerProcessor('audio-capture-processor', AudioCaptureProcessor);
} catch (error) {
  console.error('Failed to register audio processor:', error);
}