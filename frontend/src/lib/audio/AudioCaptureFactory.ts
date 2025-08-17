import {
  IAudioCapture,
  IAudioCaptureFactory,
  AudioCaptureConfiguration,
  DEFAULT_AUDIO_CAPTURE_CONFIG
} from './interfaces/IAudioCapture';
import { AudioWorkletCapture } from './implementations/AudioWorkletCapture';
import { MediaRecorderCapture } from './implementations/MediaRecorderCapture';

/**
 * Audio capture factory for creating appropriate capture implementations
 * 
 * Why: Abstracts browser capability detection and implementation selection
 * Pattern: Factory Pattern - creates audio capture instances based on browser support
 * Rationale: Provides transparent fallback between AudioWorklet and MediaRecorder
 */
export class AudioCaptureFactory implements IAudioCaptureFactory {
  
  private static instance: AudioCaptureFactory | null = null;
  private availableDevicesCache: MediaDeviceInfo[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get singleton factory instance
   */
  static getInstance(): AudioCaptureFactory {
    if (!AudioCaptureFactory.instance) {
      AudioCaptureFactory.instance = new AudioCaptureFactory();
    }
    return AudioCaptureFactory.instance;
  }

  /**
   * Create audio capture instance based on browser capabilities
   */
  async createCapture(config?: Partial<AudioCaptureConfiguration>): Promise<IAudioCapture> {
    const finalConfig = { ...DEFAULT_AUDIO_CAPTURE_CONFIG, ...config };
    
    // Validate configuration
    this.validateConfiguration(finalConfig);
    
    try {
      // Check browser capabilities and create appropriate implementation
      if (this.supportsAudioWorklet() && this.shouldUseAudioWorklet(finalConfig)) {
        console.log('Creating AudioWorkletCapture implementation');
        return new AudioWorkletCapture(finalConfig);
      } else if (this.supportsMediaRecorder()) {
        console.log('Creating MediaRecorderCapture implementation (fallback)');
        return new MediaRecorderCapture(finalConfig);
      } else {
        throw new Error('No supported audio capture implementation available');
      }
      
    } catch (error) {
      console.warn('Failed to create primary audio capture implementation, trying fallback:', error);
      
      // Try fallback implementation
      if (this.supportsMediaRecorder()) {
        console.log('Creating MediaRecorderCapture implementation (fallback)');
        return new MediaRecorderCapture(finalConfig);
      } else {
        throw new Error(`No audio capture implementation available: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Check if AudioWorklet is supported
   */
  supportsAudioWorklet(): boolean {
    try {
      return typeof AudioWorkletNode !== 'undefined' && 
             typeof AudioContext !== 'undefined' &&
             'audioWorklet' in AudioContext.prototype &&
             this.isSecureContext();
    } catch (error) {
      console.debug('AudioWorklet support check failed:', error);
      return false;
    }
  }

  /**
   * Check if MediaRecorder is supported
   */
  supportsMediaRecorder(): boolean {
    try {
      return typeof MediaRecorder !== 'undefined' && 
             typeof MediaRecorder.isTypeSupported === 'function' &&
             this.hasMediaRecorderSupport();
    } catch (error) {
      console.debug('MediaRecorder support check failed:', error);
      return false;
    }
  }

  /**
   * Get list of available audio input devices
   */
  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    // Return cached devices if still valid
    if (this.availableDevicesCache && Date.now() < this.cacheExpiry) {
      return this.availableDevicesCache;
    }

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).mediaDevices) {
        // Request device access to get device labels
        const devices = await (navigator as any).mediaDevices.enumerateDevices();
        const audioInputDevices = devices.filter((device: any) => device.kind === 'audioinput');
        
        // Cache the results
        this.availableDevicesCache = audioInputDevices;
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
        
        return audioInputDevices;
      } else {
        console.warn('MediaDevices API not available');
        return [];
      }
      
    } catch (error) {
      console.warn('Failed to enumerate audio devices:', error);
      return [];
    }
  }

  /**
   * Get recommended configuration for current browser
   */
  getRecommendedConfiguration(): AudioCaptureConfiguration {
    const baseConfig = { ...DEFAULT_AUDIO_CAPTURE_CONFIG };
    
    // Adjust configuration based on browser capabilities
    if (this.supportsAudioWorklet()) {
      // AudioWorklet can handle lower latency
      baseConfig.bufferSize = 2048;
      baseConfig.chunkDuration = 50; // 50ms chunks
    } else if (this.supportsMediaRecorder()) {
      // MediaRecorder needs larger chunks for efficiency
      baseConfig.bufferSize = 4096;
      baseConfig.chunkDuration = 200; // 200ms chunks
    }

    // Adjust for mobile devices
    if (this.isMobileDevice()) {
      baseConfig.sampleRate = 16000; // Lower sample rate for mobile
      baseConfig.echoCancellation = true;
      baseConfig.noiseSuppression = true;
      baseConfig.autoGainControl = true;
    }

    // Adjust for Safari
    if (this.isSafari()) {
      baseConfig.echoCancellation = false; // Safari has issues with echo cancellation
      baseConfig.noiseSuppression = false;
    }

    return baseConfig;
  }

  /**
   * Test audio capture capabilities
   */
  async testCapabilities(): Promise<{
    audioWorkletSupported: boolean;
    mediaRecorderSupported: boolean;
    recommendedImplementation: string;
    availableDevices: MediaDeviceInfo[];
    supportedMimeTypes: string[];
  }> {
    const audioWorkletSupported = this.supportsAudioWorklet();
    const mediaRecorderSupported = this.supportsMediaRecorder();
    const availableDevices = await this.getAvailableDevices();
    const supportedMimeTypes = this.getSupportedMimeTypes();
    
    let recommendedImplementation = 'none';
    if (audioWorkletSupported) {
      recommendedImplementation = 'AudioWorklet';
    } else if (mediaRecorderSupported) {
      recommendedImplementation = 'MediaRecorder';
    }

    return {
      audioWorkletSupported,
      mediaRecorderSupported,
      recommendedImplementation,
      availableDevices,
      supportedMimeTypes
    };
  }

  /**
   * Check if permissions are granted for microphone access
   */
  async checkMicrophonePermissions(): Promise<{
    granted: boolean;
    state: PermissionState | 'unknown';
    canRequest: boolean;
  }> {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return {
          granted: permission.state === 'granted',
          state: permission.state,
          canRequest: permission.state !== 'denied'
        };
      } else if (typeof navigator !== 'undefined' && (navigator as any).mediaDevices) {
        // Fallback: try to access microphone to check permissions
        try {
          const stream = await (navigator as any).mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track: any) => track.stop());
          return {
            granted: true,
            state: 'granted',
            canRequest: true
          };
        } catch (error) {
          return {
            granted: false,
            state: 'unknown',
            canRequest: true
          };
        }
      } else {
        // No media API available
        return {
          granted: false,
          state: 'unknown',
          canRequest: false
        };
      }
    } catch (error) {
      console.warn('Failed to check microphone permissions:', error);
      return {
        granted: false,
        state: 'unknown',
        canRequest: true
      };
    }
  }

  /**
   * Request microphone permissions
   */
  async requestMicrophonePermissions(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).mediaDevices) {
        const stream = await (navigator as any).mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track: any) => track.stop());
        return true;
      } else {
        console.warn('MediaDevices API not available');
        return false;
      }
    } catch (error) {
      console.warn('Microphone permission denied or failed:', error);
      return false;
    }
  }

  // Private helper methods

  private shouldUseAudioWorklet(config: AudioCaptureConfiguration): boolean {
    // Use AudioWorklet for low-latency requirements
    if (config.chunkDuration < 100) {
      return true;
    }
    
    // Use AudioWorklet for real-time audio processing features
    if (config.silenceDetection || config.audioLevelMonitoring) {
      return true;
    }
    
    // Use AudioWorklet for high sample rates
    if (config.sampleRate > 22050) {
      return true;
    }
    
    return true; // Prefer AudioWorklet when available
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

    if (config.chunkDuration < 10 || config.chunkDuration > 5000) {
      throw new Error('Chunk duration must be between 10 and 5000 milliseconds');
    }

    if (config.silenceThreshold < 0 || config.silenceThreshold > 1) {
      throw new Error('Silence threshold must be between 0.0 and 1.0');
    }
  }

  private isSecureContext(): boolean {
    return typeof window !== 'undefined' && 
           (window.isSecureContext || 
            location.protocol === 'https:' || 
            location.hostname === 'localhost' || 
            location.hostname === '127.0.0.1');
  }

  private hasMediaRecorderSupport(): boolean {
    if (!MediaRecorder.isTypeSupported) {
      return false;
    }

    const testTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg'
    ];

    return testTypes.some(type => MediaRecorder.isTypeSupported(type));
  }

  private getSupportedMimeTypes(): string[] {
    if (!this.supportsMediaRecorder()) {
      return [];
    }

    const testTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/webm;codecs=pcm',
      'audio/mp4',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/ogg',
      'audio/ogg;codecs=opus',
      'audio/wav',
      'audio/mpeg'
    ];

    return testTypes.filter(type => MediaRecorder.isTypeSupported(type));
  }

  private isMobileDevice(): boolean {
    return typeof window !== 'undefined' && 
           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private isSafari(): boolean {
    return typeof window !== 'undefined' && 
           /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  private isFirefox(): boolean {
    return typeof window !== 'undefined' && 
           navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  }

  private isChrome(): boolean {
    return typeof window !== 'undefined' && 
           /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  }

  /**
   * Get browser-specific optimizations
   */
  getBrowserOptimizations(): {
    browser: string;
    recommendations: string[];
    warnings: string[];
  } {
    const recommendations: string[] = [];
    const warnings: string[] = [];
    let browser = 'unknown';

    if (this.isChrome()) {
      browser = 'Chrome';
      recommendations.push('Use AudioWorklet for best performance');
      recommendations.push('Enable hardware acceleration');
    } else if (this.isFirefox()) {
      browser = 'Firefox';
      recommendations.push('Use AudioWorklet where available');
      warnings.push('Some AudioWorklet features may be limited');
    } else if (this.isSafari()) {
      browser = 'Safari';
      recommendations.push('Use MediaRecorder implementation');
      warnings.push('AudioWorklet support may be limited');
      warnings.push('Disable echo cancellation for better compatibility');
    }

    if (this.isMobileDevice()) {
      recommendations.push('Use lower sample rates (16kHz)');
      recommendations.push('Enable noise suppression');
      warnings.push('Battery usage may be higher during recording');
    }

    if (!this.isSecureContext()) {
      warnings.push('HTTPS required for microphone access in production');
    }

    return {
      browser,
      recommendations,
      warnings
    };
  }

  /**
   * Clear device cache (useful when devices change)
   */
  clearDeviceCache(): void {
    this.availableDevicesCache = null;
    this.cacheExpiry = 0;
  }
}