import { VADResult, VADConfig } from '../../types';

/**
 * Voice Activity Detection (VAD) for real-time audio processing
 * 
 * Why: Detects speech vs silence to trigger conversation flow events
 * Pattern: Observer - emits events when voice activity changes
 * Rationale: Core component for pause detection in conversation orchestration
 */
export class VoiceActivityDetector {
  private config: VADConfig;
  private isActive = false;
  private silenceStartTime: number | null = null;
  private speechStartTime: number | null = null;
  private currentEnergyLevel = 0;
  private energyBuffer: number[] = [];
  private readonly bufferSize = 10;
  
  // Event handlers
  private onActivityChange: ((result: VADResult) => void) | undefined;
  private onSilenceDetected: ((duration: number) => void) | undefined;
  private onSpeechDetected: (() => void) | undefined;
  
  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      silenceThreshold: config.silenceThreshold ?? 0.01,
      silenceDuration: config.silenceDuration ?? 800, // 800ms default
      energyThreshold: config.energyThreshold ?? 0.02,
      minSpeechDuration: config.minSpeechDuration ?? 200, // 200ms minimum speech
      adaptiveThreshold: config.adaptiveThreshold ?? true,
      ...config
    };
  }
  
  /**
   * Process audio data and detect voice activity
   */
  processAudioData(audioData: Float32Array): VADResult {
    const energy = this.calculateRMSEnergy(audioData);
    this.currentEnergyLevel = energy;
    
    // Update energy buffer for adaptive threshold
    this.energyBuffer.push(energy);
    if (this.energyBuffer.length > this.bufferSize) {
      this.energyBuffer.shift();
    }
    
    const threshold = this.getAdaptiveThreshold();
    const hasSpeech = energy > threshold;
    const currentTime = Date.now();
    
    // State transitions
    if (hasSpeech) {
      this.handleSpeechDetected(currentTime);
    } else {
      this.handleSilenceDetected(currentTime);
    }
    
    const result: VADResult = {
      hasSpeech,
      energy: energy,
      threshold: threshold,
      silenceDuration: this.getCurrentSilenceDuration(currentTime),
      speechDuration: this.getCurrentSpeechDuration(currentTime),
      timestamp: currentTime
    };
    
    this.onActivityChange?.(result);
    return result;
  }
  
  /**
   * Calculate RMS (Root Mean Square) energy of audio data
   */
  private calculateRMSEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }
  
  /**
   * Get adaptive threshold based on recent energy levels
   */
  private getAdaptiveThreshold(): number {
    if (!this.config.adaptiveThreshold || this.energyBuffer.length === 0) {
      return this.config.silenceThreshold;
    }
    
    const avgEnergy = this.energyBuffer.reduce((sum, val) => sum + val, 0) / this.energyBuffer.length;
    const minThreshold = this.config.silenceThreshold;
    const maxThreshold = this.config.energyThreshold;
    
    // Adaptive threshold is 2x average energy but within bounds
    return Math.max(minThreshold, Math.min(maxThreshold, avgEnergy * 2));
  }
  
  /**
   * Handle speech detection
   */
  private handleSpeechDetected(currentTime: number): void {
    if (!this.isActive) {
      this.isActive = true;
      this.speechStartTime = currentTime;
      this.silenceStartTime = null;
      
      // Only emit speech detected after minimum duration
      setTimeout(() => {
        if (this.isActive && this.speechStartTime === currentTime) {
          this.onSpeechDetected?.();
        }
      }, this.config.minSpeechDuration);
    }
  }
  
  /**
   * Handle silence detection
   */
  private handleSilenceDetected(currentTime: number): void {
    if (this.isActive) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = currentTime;
      }
      
      const silenceDuration = currentTime - this.silenceStartTime;
      
      // Check if silence duration exceeds threshold
      if (silenceDuration >= this.config.silenceDuration) {
        this.isActive = false;
        this.speechStartTime = null;
        this.onSilenceDetected?.(silenceDuration);
      }
    } else if (!this.silenceStartTime) {
      this.silenceStartTime = currentTime;
    }
  }
  
  /**
   * Get current silence duration
   */
  private getCurrentSilenceDuration(currentTime: number): number {
    if (!this.silenceStartTime) return 0;
    return currentTime - this.silenceStartTime;
  }
  
  /**
   * Get current speech duration
   */
  private getCurrentSpeechDuration(currentTime: number): number {
    if (!this.speechStartTime || !this.isActive) return 0;
    return currentTime - this.speechStartTime;
  }
  
  /**
   * Update VAD configuration
   */
  updateConfig(newConfig: Partial<VADConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current VAD state
   */
  getCurrentState(): {
    isActive: boolean;
    currentEnergy: number;
    threshold: number;
    silenceDuration: number;
    speechDuration: number;
  } {
    const currentTime = Date.now();
    return {
      isActive: this.isActive,
      currentEnergy: this.currentEnergyLevel,
      threshold: this.getAdaptiveThreshold(),
      silenceDuration: this.getCurrentSilenceDuration(currentTime),
      speechDuration: this.getCurrentSpeechDuration(currentTime)
    };
  }
  
  /**
   * Reset VAD state
   */
  reset(): void {
    this.isActive = false;
    this.silenceStartTime = null;
    this.speechStartTime = null;
    this.currentEnergyLevel = 0;
    this.energyBuffer = [];
  }
  
  // Event handler setters
  onActivityChange(callback: (result: VADResult) => void): void {
    this.onActivityChange = callback;
  }
  
  onSilenceDetected(callback: (duration: number) => void): void {
    this.onSilenceDetected = callback;
  }
  
  onSpeechDetected(callback: () => void): void {
    this.onSpeechDetected = callback;
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.reset();
    this.onActivityChange = undefined;
    this.onSilenceDetected = undefined;
    this.onSpeechDetected = undefined;
  }
}