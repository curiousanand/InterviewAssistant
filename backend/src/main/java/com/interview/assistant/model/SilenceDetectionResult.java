package com.interview.assistant.model;

/**
 * Silence detection result data model for conversation flow
 * 
 * Why: Represents silence/speech transition analysis for conversation orchestration
 * Pattern: Value Object - immutable data structure for silence detection results
 * Rationale: Core data structure for pause classification and conversation flow management
 */
public class SilenceDetectionResult {
    
    private final boolean stateChanged;
    private final boolean isSpeech;
    private final long silenceDuration;
    private final long speechDuration;
    private final long timestamp;
    private final SilenceType silenceType;
    private final double confidence;
    
    // Silence classification types
    public enum SilenceType {
        NONE,               // Currently speaking
        NATURAL_GAP,        // Brief pause in speech (< 1s)
        END_OF_THOUGHT,     // Longer pause indicating end of statement (1-3s)
        WAITING_FOR_RESPONSE, // Extended silence waiting for AI response (> 3s)
        TIMEOUT             // Very long silence indicating session timeout
    }
    
    public SilenceDetectionResult(boolean stateChanged, boolean isSpeech, long silenceDuration) {
        this(stateChanged, isSpeech, silenceDuration, 0, System.currentTimeMillis(), 
             classifySilence(silenceDuration, isSpeech), 0.8);
    }
    
    public SilenceDetectionResult(boolean stateChanged, boolean isSpeech, long silenceDuration, 
                                long speechDuration, long timestamp, SilenceType silenceType, double confidence) {
        this.stateChanged = stateChanged;
        this.isSpeech = isSpeech;
        this.silenceDuration = silenceDuration;
        this.speechDuration = speechDuration;
        this.timestamp = timestamp;
        this.silenceType = silenceType;
        this.confidence = confidence;
    }
    
    /**
     * Classify silence duration into conversation flow categories
     */
    private static SilenceType classifySilence(long silenceDuration, boolean isSpeech) {
        if (isSpeech) {
            return SilenceType.NONE;
        }
        
        if (silenceDuration < 1000) {
            return SilenceType.NATURAL_GAP;
        } else if (silenceDuration < 3000) {
            return SilenceType.END_OF_THOUGHT;
        } else if (silenceDuration < 10000) {
            return SilenceType.WAITING_FOR_RESPONSE;
        } else {
            return SilenceType.TIMEOUT;
        }
    }
    
    /**
     * Check if state changed from previous detection
     */
    public boolean hasStateChanged() {
        return stateChanged;
    }
    
    /**
     * Check if currently detecting speech
     */
    public boolean isSpeech() {
        return isSpeech;
    }
    
    /**
     * Get current silence duration in milliseconds
     */
    public long getSilenceDuration() {
        return silenceDuration;
    }
    
    /**
     * Get current speech duration in milliseconds
     */
    public long getSpeechDuration() {
        return speechDuration;
    }
    
    /**
     * Get timestamp of detection
     */
    public long getTimestamp() {
        return timestamp;
    }
    
    /**
     * Get classified silence type
     */
    public SilenceType getSilenceType() {
        return silenceType;
    }
    
    /**
     * Get confidence score for detection
     */
    public double getConfidence() {
        return confidence;
    }
    
    /**
     * Check if this silence should trigger conversation processing
     */
    public boolean shouldTriggerProcessing() {
        return silenceType == SilenceType.END_OF_THOUGHT || 
               silenceType == SilenceType.WAITING_FOR_RESPONSE;
    }
    
    /**
     * Check if this indicates a natural speech pause
     */
    public boolean isNaturalPause() {
        return silenceType == SilenceType.NATURAL_GAP;
    }
    
    /**
     * Check if this indicates end of user input
     */
    public boolean isEndOfInput() {
        return silenceType == SilenceType.END_OF_THOUGHT;
    }
    
    /**
     * Check if user is waiting for AI response
     */
    public boolean isWaitingForResponse() {
        return silenceType == SilenceType.WAITING_FOR_RESPONSE;
    }
    
    /**
     * Check if session has timed out
     */
    public boolean isTimeout() {
        return silenceType == SilenceType.TIMEOUT;
    }
    
    /**
     * Check if this is a transition from speech to silence
     */
    public boolean isSpeechToSilence() {
        return stateChanged && !isSpeech;
    }
    
    /**
     * Check if this is a transition from silence to speech
     */
    public boolean isSilenceToSpeech() {
        return stateChanged && isSpeech;
    }
    
    /**
     * Get priority level for processing (higher = more urgent)
     */
    public int getProcessingPriority() {
        switch (silenceType) {
            case TIMEOUT:
                return 4;
            case WAITING_FOR_RESPONSE:
                return 3;
            case END_OF_THOUGHT:
                return 2;
            case NATURAL_GAP:
                return 1;
            case NONE:
            default:
                return 0;
        }
    }
    
    /**
     * Create a copy with updated durations
     */
    public SilenceDetectionResult withDurations(long silenceDuration, long speechDuration) {
        SilenceType newType = classifySilence(silenceDuration, isSpeech);
        return new SilenceDetectionResult(stateChanged, isSpeech, silenceDuration, 
                                        speechDuration, timestamp, newType, confidence);
    }
    
    /**
     * Create a copy with state change flag
     */
    public SilenceDetectionResult withStateChange(boolean stateChanged) {
        return new SilenceDetectionResult(stateChanged, isSpeech, silenceDuration, 
                                        speechDuration, timestamp, silenceType, confidence);
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        SilenceDetectionResult that = (SilenceDetectionResult) obj;
        return stateChanged == that.stateChanged &&
               isSpeech == that.isSpeech &&
               silenceDuration == that.silenceDuration &&
               speechDuration == that.speechDuration &&
               timestamp == that.timestamp &&
               silenceType == that.silenceType &&
               Double.compare(that.confidence, confidence) == 0;
    }
    
    @Override
    public int hashCode() {
        int result = Boolean.hashCode(stateChanged);
        result = 31 * result + Boolean.hashCode(isSpeech);
        result = 31 * result + Long.hashCode(silenceDuration);
        result = 31 * result + Long.hashCode(speechDuration);
        result = 31 * result + Long.hashCode(timestamp);
        result = 31 * result + (silenceType != null ? silenceType.hashCode() : 0);
        result = 31 * result + Double.hashCode(confidence);
        return result;
    }
    
    @Override
    public String toString() {
        return String.format("SilenceDetection{changed=%s, speech=%s, silence=%dms, type=%s, conf=%.2f}", 
            stateChanged, isSpeech, silenceDuration, silenceType, confidence);
    }
    
    /**
     * Get detailed statistics for monitoring
     */
    public SilenceStatistics getStatistics() {
        return new SilenceStatistics(
            stateChanged,
            isSpeech,
            silenceDuration,
            speechDuration,
            silenceType,
            confidence,
            getProcessingPriority(),
            timestamp
        );
    }
    
    /**
     * Inner class for detailed silence statistics
     */
    public static class SilenceStatistics {
        private final boolean stateChanged;
        private final boolean isSpeech;
        private final long silenceDuration;
        private final long speechDuration;
        private final SilenceType silenceType;
        private final double confidence;
        private final int processingPriority;
        private final long timestamp;
        
        public SilenceStatistics(boolean stateChanged, boolean isSpeech, long silenceDuration, 
                               long speechDuration, SilenceType silenceType, double confidence,
                               int processingPriority, long timestamp) {
            this.stateChanged = stateChanged;
            this.isSpeech = isSpeech;
            this.silenceDuration = silenceDuration;
            this.speechDuration = speechDuration;
            this.silenceType = silenceType;
            this.confidence = confidence;
            this.processingPriority = processingPriority;
            this.timestamp = timestamp;
        }
        
        // Getters
        public boolean hasStateChanged() { return stateChanged; }
        public boolean isSpeech() { return isSpeech; }
        public long getSilenceDuration() { return silenceDuration; }
        public long getSpeechDuration() { return speechDuration; }
        public SilenceType getSilenceType() { return silenceType; }
        public double getConfidence() { return confidence; }
        public int getProcessingPriority() { return processingPriority; }
        public long getTimestamp() { return timestamp; }
        
        @Override
        public String toString() {
            return String.format("SilenceStats{type=%s, silence=%dms, speech=%dms, priority=%d}", 
                silenceType, silenceDuration, speechDuration, processingPriority);
        }
    }
}