import { EventEmitter } from 'events';

/**
 * Real-time Audio Capture System
 * 
 * Features:
 * - Always-listening with continuous streaming
 * - Voice Activity Detection (VAD)
 * - Browser compatibility (AudioWorklet + MediaRecorder fallback)
 * - Low-latency processing with configurable buffer sizes
 * - Automatic quality adjustment based on connection
 */
export class RealTimeAudioCapture extends EventEmitter {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  
  public isInitialized = false;
  private isCapturing = false;
  private useAudioWorklet = false;
  
  // Audio processing settings
  private settings: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
  };
  
  // Performance monitoring
  private stats = {
    packetsProcessed: 0,
    audioDropouts: 0,
    lastAudioTime: 0,
    averageLatency: 0
  };
  
  // Voice Activity Detection
  private vadThreshold = 0.01;
  private lastVoiceActivity = 0;
  private vadBuffer: Float32Array[] = [];

  constructor(settings: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
  }) {
    super();
    
    this.settings = {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      bufferSize: 4096,
      echoCancellation: true,
      noiseSuppression: true,
      ...settings
    };
  }

  /**
   * Initialize audio capture system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('RealTimeAudioCapture already initialized');
      return;
    }
    
    try {
      console.log('🎤 Initializing real-time audio capture...');
      
      // Check if we're in browser environment
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Audio capture not supported in this environment');
      }
      
      // Request microphone permission
      await this.requestMicrophonePermission();
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.settings.sampleRate,
        latencyHint: 'interactive'
      });
      
      // Check for AudioWorklet support
      this.useAudioWorklet = 'audioWorklet' in this.audioContext;
      
      if (this.useAudioWorklet) {
        await this.initializeAudioWorklet();
        console.log('✅ Using AudioWorklet for low-latency processing');
      } else {
        console.log('⚠️ AudioWorklet not supported, falling back to MediaRecorder');
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Real-time audio capture initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio capture:', error);
      throw error;
    }
  }

  /**
   * Request microphone permission
   */
  private async requestMicrophonePermission(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.settings.sampleRate,
          channelCount: this.settings.channels,
          echoCancellation: this.settings.echoCancellation,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: true,
          latency: { ideal: 0.01 } // 10ms target latency
        }
      });
      
      console.log('✅ Microphone permission granted');
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      throw new Error('Microphone access is required for voice interaction');
    }
  }

  /**
   * Initialize AudioWorklet for low-latency processing
   */
  private async initializeAudioWorklet(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio context or media stream not initialized');
    }
    
    try {
      // Load AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      
      // Create AudioWorklet node
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: this.settings.channels,
        processorOptions: {
          bufferSize: this.settings.bufferSize,
          sampleRate: this.settings.sampleRate
        }
      });
      
      // Handle audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        this.handleAudioData(event.data);
      };
      
      // Connect audio source
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.audioWorkletNode);
      
      console.log('✅ AudioWorklet initialized');
    } catch (error) {
      console.warn('AudioWorklet initialization failed, falling back to MediaRecorder:', error);
      this.useAudioWorklet = false;
    }
  }

  /**
   * Start continuous audio capture
   */
  async startContinuousCapture(onAudioChunk: (chunk: Float32Array) => void): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Audio capture not initialized. Call initialize() first.');
    }
    
    if (this.isCapturing) {
      console.warn('Audio capture already active');
      return;
    }
    
    try {
      console.log('🎤 Starting continuous audio capture...');
      
      // Store callback for audio chunks
      this.removeAllListeners('audioChunk');
      this.on('audioChunk', onAudioChunk);
      
      if (this.useAudioWorklet && this.audioWorkletNode) {
        // Start AudioWorklet processing
        this.audioWorkletNode.port.postMessage({ command: 'start' });
      } else {
        // Fallback to MediaRecorder
        await this.startMediaRecorderCapture();
      }
      
      this.isCapturing = true;
      this.emit('captureStarted');
      
      console.log('✅ Continuous audio capture started');
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      throw error;
    }
  }

  /**
   * Fallback MediaRecorder capture
   */
  private async startMediaRecorderCapture(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('Media stream not available');
    }
    
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      // Process audio data in small chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.processMediaRecorderChunk(event.data);
        }
      };
      
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        this.emit('error', 'Audio recording error');
      };
      
      // Start recording with small time slice for low latency
      this.mediaRecorder.start(100); // 100ms chunks
      
      console.log('✅ MediaRecorder capture started');
    } catch (error) {
      console.error('❌ MediaRecorder setup failed:', error);
      throw error;
    }
  }

  /**
   * Process MediaRecorder audio chunks
   */
  private async processMediaRecorderChunk(blob: Blob): Promise<void> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      
      // Convert to AudioBuffer using Web Audio API
      if (this.audioContext) {
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0); // Get first channel
        
        // Process as Float32Array
        this.handleAudioData({ audioData: channelData, timestamp: performance.now() });
      }
    } catch (error) {
      console.error('Error processing MediaRecorder chunk:', error);
    }
  }

  /**
   * Handle audio data from any source
   */
  private handleAudioData(data: { audioData: Float32Array; timestamp: number }): void {
    if (!this.isCapturing) return;
    
    const { audioData, timestamp } = data;
    
    // Update statistics
    this.stats.packetsProcessed++;
    this.stats.lastAudioTime = timestamp;
    
    // Perform Voice Activity Detection
    const vadResult = this.performVAD(audioData);
    
    // Emit audio chunk with VAD info
    this.emit('audioChunk', audioData);
    this.emit('voiceActivity', vadResult);
    
    // Check for audio dropouts
    if (timestamp - this.stats.lastAudioTime > 200) { // 200ms gap
      this.stats.audioDropouts++;
      this.emit('audioDropout', timestamp - this.stats.lastAudioTime);
    }
  }

  /**
   * Perform Voice Activity Detection
   */
  private performVAD(audioData: Float32Array): {
    hasVoice: boolean;
    confidence: number;
    energy: number;
    timestamp: number;
  } {
    // Calculate RMS energy
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    energy = Math.sqrt(energy / audioData.length);
    
    // Simple voice activity detection
    const hasVoice = energy > this.vadThreshold;
    const confidence = Math.min(energy / this.vadThreshold, 1.0);
    
    if (hasVoice) {
      this.lastVoiceActivity = performance.now();
    }
    
    return {
      hasVoice,
      confidence,
      energy,
      timestamp: performance.now()
    };
  }

  /**
   * Stop audio capture
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }
    
    try {
      console.log('🔇 Stopping audio capture...');
      
      this.isCapturing = false;
      
      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({ command: 'stop' });
        // Don't disconnect the node, just stop processing
        // This allows for quick restart without reinitializing
      }
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // Clear audio chunk listeners for clean restart
      this.removeAllListeners('audioChunk');
      
      this.emit('captureStopped');
      console.log('✅ Audio capture stopped');
    } catch (error) {
      console.error('Error stopping audio capture:', error);
    }
  }

  /**
   * Update audio settings
   */
  async updateSettings(newSettings: Partial<typeof this.settings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    
    // If capture is active, restart with new settings
    if (this.isCapturing) {
      await this.stopCapture();
      // Small delay to ensure cleanup
      setTimeout(async () => {
        if (this.isInitialized) {
          const currentCallback = this.listeners('audioChunk')[0];
          if (currentCallback) {
            await this.startContinuousCapture(currentCallback as any);
          }
        }
      }, 100);
    }
    
    console.log('⚙️ Audio settings updated', this.settings);
  }

  /**
   * Get current audio statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get current voice activity status
   */
  getVoiceActivityStatus(): {
    isActive: boolean;
    timeSinceLastVoice: number;
  } {
    const now = performance.now();
    return {
      isActive: now - this.lastVoiceActivity < 1000, // 1 second threshold
      timeSinceLastVoice: now - this.lastVoiceActivity
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up audio capture...');
    
    try {
      if (this.isCapturing) {
        await this.stopCapture();
      }
      
      if (this.audioWorkletNode) {
        this.audioWorkletNode.disconnect();
        this.audioWorkletNode = null;
      }
      
      if (this.mediaRecorder) {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
      }
      
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.removeAllListeners();
      this.isInitialized = false;
      
      console.log('✅ Audio capture cleanup complete');
    } catch (error) {
      console.error('Error during audio cleanup:', error);
    }
  }
}