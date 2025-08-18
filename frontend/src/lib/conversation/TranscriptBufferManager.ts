import { TranscriptBuffer, TranscriptEvent, BufferState } from '../../types';

/**
 * Dual-buffer transcript management for real-time conversation flow
 * 
 * Why: Separates interim (live) and confirmed (final) transcripts for better UX
 * Pattern: State Machine - manages buffer transitions based on speech events
 * Rationale: Essential for pause-based conversation triggers and context management
 */
export class TranscriptBufferManager {
  private liveBuffer: TranscriptBuffer;
  private confirmedBuffer: TranscriptBuffer;
  private bufferState: BufferState = 'idle';
  
  // Configuration
  private readonly maxBufferLength = 10000; // Max characters per buffer
  private readonly maxBufferAge = 300000; // 5 minutes max age
  
  // Event handlers
  private onLiveUpdate: ((text: string, confidence: number) => void) | undefined;
  private onConfirmed: ((text: string, confidence: number) => void) | undefined;
  private onBufferStateChange: ((state: BufferState) => void) | undefined;
  
  constructor() {
    this.liveBuffer = this.createEmptyBuffer();
    this.confirmedBuffer = this.createEmptyBuffer();
  }
  
  /**
   * Process interim transcript (partial results from STT)
   */
  processInterimTranscript(text: string, confidence: number, sessionId: string): void {
    const timestamp = Date.now();
    
    // Update live buffer with interim text
    this.liveBuffer = {
      text: text.trim(),
      confidence: confidence,
      timestamp: timestamp,
      sessionId: sessionId,
      segments: this.segmentizeText(text, confidence, timestamp)
    };
    
    this.updateBufferState('listening');
    this.onLiveUpdate?.(this.liveBuffer.text, this.liveBuffer.confidence);
  }
  
  /**
   * Process final transcript (confirmed results from STT)
   */
  processFinalTranscript(text: string, confidence: number, sessionId: string): void {
    const timestamp = Date.now();
    const finalText = text.trim();
    
    if (!finalText) {
      return; // Ignore empty final transcripts
    }
    
    // Move content to confirmed buffer
    const newConfirmedText = this.confirmedBuffer.text 
      ? `${this.confirmedBuffer.text} ${finalText}`
      : finalText;
    
    // Check buffer length limits
    const truncatedText = this.truncateIfNeeded(newConfirmedText);
    
    this.confirmedBuffer = {
      text: truncatedText,
      confidence: this.calculateWeightedConfidence(
        this.confirmedBuffer.confidence,
        confidence,
        this.confirmedBuffer.text.length,
        finalText.length
      ),
      timestamp: timestamp,
      sessionId: sessionId,
      segments: [
        ...this.confirmedBuffer.segments,
        ...this.segmentizeText(finalText, confidence, timestamp)
      ]
    };
    
    // Clear live buffer after confirmation
    this.liveBuffer = this.createEmptyBuffer();
    
    this.updateBufferState('confirmed');
    this.onConfirmed?.(this.confirmedBuffer.text, this.confirmedBuffer.confidence);
  }
  
  /**
   * Handle silence detection - triggers buffer finalization
   */
  onSilenceDetected(silenceDuration: number): void {
    // If we have live content and sufficient silence, consider it final
    if (this.liveBuffer.text && silenceDuration > 500) {
      this.processFinalTranscript(
        this.liveBuffer.text, 
        this.liveBuffer.confidence, 
        this.liveBuffer.sessionId
      );
    }
    
    this.updateBufferState('paused');
  }
  
  /**
   * Handle speech detection - activates live buffer
   */
  onSpeechDetected(): void {
    this.updateBufferState('listening');
  }
  
  /**
   * Get current live transcript (interim)
   */
  getLiveTranscript(): string {
    return this.liveBuffer.text;
  }
  
  /**
   * Get confirmed transcript (finalized)
   */
  getConfirmedTranscript(): string {
    return this.confirmedBuffer.text;
  }
  
  /**
   * Get full conversation transcript (confirmed + live)
   */
  getFullTranscript(): string {
    const confirmed = this.confirmedBuffer.text;
    const live = this.liveBuffer.text;
    
    if (confirmed && live) {
      return `${confirmed} ${live}`;
    }
    return confirmed || live || '';
  }
  
  /**
   * Get conversation context for AI processing
   */
  getContextForAI(): {
    confirmedText: string;
    liveText: string;
    confidence: number;
    segments: number;
    lastUpdate: number;
  } {
    return {
      confirmedText: this.confirmedBuffer.text,
      liveText: this.liveBuffer.text,
      confidence: this.confirmedBuffer.confidence,
      segments: this.confirmedBuffer.segments.length,
      lastUpdate: Math.max(this.confirmedBuffer.timestamp, this.liveBuffer.timestamp)
    };
  }
  
  /**
   * Clear confirmed buffer (after processing)
   */
  clearConfirmedBuffer(): void {
    this.confirmedBuffer = this.createEmptyBuffer();
    this.updateBufferState('idle');
  }
  
  /**
   * Clear all buffers
   */
  clearAllBuffers(): void {
    this.liveBuffer = this.createEmptyBuffer();
    this.confirmedBuffer = this.createEmptyBuffer();
    this.updateBufferState('idle');
  }
  
  /**
   * Archive confirmed content and start fresh
   */
  archiveAndReset(): string {
    const archivedContent = this.confirmedBuffer.text;
    this.clearAllBuffers();
    return archivedContent;
  }
  
  /**
   * Create empty buffer structure
   */
  private createEmptyBuffer(): TranscriptBuffer {
    return {
      text: '',
      confidence: 0,
      timestamp: Date.now(),
      sessionId: '',
      segments: []
    };
  }
  
  /**
   * Segmentize text into individual words/phrases with metadata
   */
  private segmentizeText(text: string, confidence: number, timestamp: number) {
    return text.split(/\s+/).filter(word => word.trim()).map((word, index) => ({
      text: word,
      confidence: confidence,
      timestamp: timestamp + (index * 100), // Estimated timing
      startTime: timestamp + (index * 100),
      endTime: timestamp + ((index + 1) * 100)
    }));
  }
  
  /**
   * Calculate weighted confidence between old and new content
   */
  private calculateWeightedConfidence(
    oldConfidence: number, 
    newConfidence: number, 
    oldLength: number, 
    newLength: number
  ): number {
    if (oldLength === 0) return newConfidence;
    if (newLength === 0) return oldConfidence;
    
    const totalLength = oldLength + newLength;
    return (oldConfidence * oldLength + newConfidence * newLength) / totalLength;
  }
  
  /**
   * Truncate text if it exceeds buffer limits
   */
  private truncateIfNeeded(text: string): string {
    if (text.length <= this.maxBufferLength) {
      return text;
    }
    
    // Keep the most recent content
    const words = text.split(' ');
    let truncated = '';
    let currentLength = 0;
    
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (currentLength + word.length + 1 > this.maxBufferLength) {
        break;
      }
      truncated = word + (truncated ? ' ' + truncated : '');
      currentLength += word.length + 1;
    }
    
    return truncated;
  }
  
  /**
   * Update buffer state and notify listeners
   */
  private updateBufferState(newState: BufferState): void {
    if (this.bufferState !== newState) {
      this.bufferState = newState;
      this.onBufferStateChange?.(newState);
    }
  }
  
  /**
   * Get buffer statistics
   */
  getBufferStats(): {
    liveLength: number;
    confirmedLength: number;
    totalSegments: number;
    bufferState: BufferState;
    lastActivity: number;
  } {
    return {
      liveLength: this.liveBuffer.text.length,
      confirmedLength: this.confirmedBuffer.text.length,
      totalSegments: this.confirmedBuffer.segments.length + this.liveBuffer.segments.length,
      bufferState: this.bufferState,
      lastActivity: Math.max(this.confirmedBuffer.timestamp, this.liveBuffer.timestamp)
    };
  }
  
  /**
   * Check if buffers are stale and need cleanup
   */
  isStale(): boolean {
    const now = Date.now();
    const lastActivity = Math.max(this.confirmedBuffer.timestamp, this.liveBuffer.timestamp);
    return (now - lastActivity) > this.maxBufferAge;
  }
  
  // Event handler setters
  onLiveUpdate(callback: (text: string, confidence: number) => void): void {
    this.onLiveUpdate = callback;
  }
  
  onConfirmed(callback: (text: string, confidence: number) => void): void {
    this.onConfirmed = callback;
  }
  
  onBufferStateChange(callback: (state: BufferState) => void): void {
    this.onBufferStateChange = callback;
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearAllBuffers();
    this.onLiveUpdate = undefined;
    this.onConfirmed = undefined;
    this.onBufferStateChange = undefined;
  }
}