package com.interview.assistant.util;

import java.time.Instant;
import java.util.logging.Logger;

/**
 * Transcription result value object
 * 
 * Why: Encapsulates transcription output with metadata
 * Pattern: Value Object - immutable data container
 * Rationale: Provides type-safe transcription results with confidence metrics
 */
public class TranscriptionResult {
    
    private static final Logger logger = Logger.getLogger(TranscriptionResult.class.getName());
    
    // Transcription content
    private final String text;
    private final String language;
    
    // Transcription metadata
    private final Confidence confidence;
    private final boolean isFinal;
    private final boolean isPartial;
    
    // Timing information
    private final Instant timestamp;
    private final long durationMs;
    private final long offsetMs;
    
    // Audio metadata
    private final String audioFormat;
    private final int sampleRate;
    private final int channels;
    
    // Constructors
    public TranscriptionResult(String text, String language, Confidence confidence, boolean isFinal, 
                              boolean isPartial, Instant timestamp, long durationMs, long offsetMs,
                              String audioFormat, int sampleRate, int channels) {
        this.text = text;
        this.language = language;
        this.confidence = confidence;
        this.isFinal = isFinal;
        this.isPartial = isPartial;
        this.timestamp = timestamp;
        this.durationMs = durationMs;
        this.offsetMs = offsetMs;
        this.audioFormat = audioFormat;
        this.sampleRate = sampleRate;
        this.channels = channels;
    }
    
    // Simplified constructor for basic usage
    public TranscriptionResult(String text, String language, Confidence confidence, boolean isFinal, boolean isPartial) {
        this(text, language, confidence, isFinal, isPartial, Instant.now(), 0, 0, null, 0, 0);
    }
    
    /**
     * Create a final transcription result
     */
    public static TranscriptionResult createFinal(String text, String language, Confidence confidence) {
        return new TranscriptionResult(text, language, confidence, true, false);
    }
    
    /**
     * Create a partial transcription result
     */
    public static TranscriptionResult createPartial(String text, String language, Confidence confidence) {
        return new TranscriptionResult(text, language, confidence, false, true);
    }
    
    // Getters
    public String getText() {
        return text != null ? text.trim() : "";
    }
    
    public String getLanguage() {
        return language;
    }
    
    public Confidence getConfidence() {
        return confidence;
    }
    
    public boolean isFinal() {
        return isFinal;
    }
    
    public boolean isPartial() {
        return isPartial;
    }
    
    public Instant getTimestamp() {
        return timestamp;
    }
    
    public long getDurationMs() {
        return durationMs;
    }
    
    public long getOffsetMs() {
        return offsetMs;
    }
    
    public String getAudioFormat() {
        return audioFormat;
    }
    
    public int getSampleRate() {
        return sampleRate;
    }
    
    public int getChannels() {
        return channels;
    }
    
    /**
     * Check if transcription has sufficient confidence
     */
    public boolean hasHighConfidence() {
        return confidence != null && confidence.isHigh();
    }
    
    /**
     * Check if transcription result is empty
     */
    public boolean isEmpty() {
        return text == null || text.trim().isEmpty();
    }
    
}