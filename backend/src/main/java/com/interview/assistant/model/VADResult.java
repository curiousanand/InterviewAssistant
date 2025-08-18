package com.interview.assistant.model;

/**
 * Voice Activity Detection result data model
 * 
 * Why: Represents VAD analysis results for audio chunks with confidence metrics
 * Pattern: Value Object - immutable data structure for VAD processing results
 * Rationale: Core data structure for real-time speech detection and silence analysis
 */
public class VADResult {
    
    private final boolean hasSpeech;
    private final double energy;
    private final double confidence;
    private final long timestamp;
    private final double threshold;
    private final long silenceDuration;
    private final long speechDuration;
    
    public VADResult(boolean hasSpeech, double energy, double confidence, long timestamp) {
        this(hasSpeech, energy, confidence, timestamp, 0.01, 0, 0);
    }
    
    public VADResult(boolean hasSpeech, double energy, double confidence, long timestamp, 
                    double threshold, long silenceDuration, long speechDuration) {
        this.hasSpeech = hasSpeech;
        this.energy = energy;
        this.confidence = confidence;
        this.timestamp = timestamp;
        this.threshold = threshold;
        this.silenceDuration = silenceDuration;
        this.speechDuration = speechDuration;
    }
    
    /**
     * Check if speech was detected
     */
    public boolean hasSpeech() {
        return hasSpeech;
    }
    
    /**
     * Get audio energy level
     */
    public double getEnergy() {
        return energy;
    }
    
    /**
     * Get VAD confidence score
     */
    public double getConfidence() {
        return confidence;
    }
    
    /**
     * Get timestamp when VAD was performed
     */
    public long getTimestamp() {
        return timestamp;
    }
    
    /**
     * Get energy threshold used for detection
     */
    public double getThreshold() {
        return threshold;
    }
    
    /**
     * Get duration of current silence in milliseconds
     */
    public long getSilenceDuration() {
        return silenceDuration;
    }
    
    /**
     * Get duration of current speech in milliseconds
     */
    public long getSpeechDuration() {
        return speechDuration;
    }
    
    /**
     * Create a copy with updated durations
     */
    public VADResult withDurations(long silenceDuration, long speechDuration) {
        return new VADResult(hasSpeech, energy, confidence, timestamp, threshold, 
                           silenceDuration, speechDuration);
    }
    
    /**
     * Create a copy with updated threshold
     */
    public VADResult withThreshold(double threshold) {
        return new VADResult(hasSpeech, energy, confidence, timestamp, threshold, 
                           silenceDuration, speechDuration);
    }
    
    /**
     * Check if this result indicates a state transition
     */
    public boolean isStateTransition(VADResult previous) {
        return previous != null && previous.hasSpeech != this.hasSpeech;
    }
    
    /**
     * Get signal-to-noise ratio estimate
     */
    public double getSNREstimate() {
        if (threshold <= 0) {
            return 0.0;
        }
        return energy / threshold;
    }
    
    /**
     * Check if energy level is significantly above threshold
     */
    public boolean isHighConfidenceSpeech() {
        return hasSpeech && confidence > 0.8 && energy > (threshold * 2.0);
    }
    
    /**
     * Check if this indicates clear silence
     */
    public boolean isClearSilence() {
        return !hasSpeech && energy < (threshold * 0.5);
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        VADResult vadResult = (VADResult) obj;
        return hasSpeech == vadResult.hasSpeech &&
               Double.compare(vadResult.energy, energy) == 0 &&
               Double.compare(vadResult.confidence, confidence) == 0 &&
               timestamp == vadResult.timestamp &&
               Double.compare(vadResult.threshold, threshold) == 0;
    }
    
    @Override
    public int hashCode() {
        int result = Boolean.hashCode(hasSpeech);
        result = 31 * result + Double.hashCode(energy);
        result = 31 * result + Double.hashCode(confidence);
        result = 31 * result + Long.hashCode(timestamp);
        result = 31 * result + Double.hashCode(threshold);
        return result;
    }
    
    @Override
    public String toString() {
        return String.format("VADResult{speech=%s, energy=%.3f, conf=%.2f, silence=%dms, speech=%dms}", 
            hasSpeech, energy, confidence, silenceDuration, speechDuration);
    }
    
    /**
     * Get detailed statistics for monitoring
     */
    public VADStatistics getStatistics() {
        return new VADStatistics(
            hasSpeech,
            energy,
            confidence,
            threshold,
            getSNREstimate(),
            silenceDuration,
            speechDuration,
            timestamp
        );
    }
    
    /**
     * Inner class for detailed VAD statistics
     */
    public static class VADStatistics {
        private final boolean hasSpeech;
        private final double energy;
        private final double confidence;
        private final double threshold;
        private final double snrEstimate;
        private final long silenceDuration;
        private final long speechDuration;
        private final long timestamp;
        
        public VADStatistics(boolean hasSpeech, double energy, double confidence, double threshold,
                           double snrEstimate, long silenceDuration, long speechDuration, long timestamp) {
            this.hasSpeech = hasSpeech;
            this.energy = energy;
            this.confidence = confidence;
            this.threshold = threshold;
            this.snrEstimate = snrEstimate;
            this.silenceDuration = silenceDuration;
            this.speechDuration = speechDuration;
            this.timestamp = timestamp;
        }
        
        // Getters
        public boolean hasSpeech() { return hasSpeech; }
        public double getEnergy() { return energy; }
        public double getConfidence() { return confidence; }
        public double getThreshold() { return threshold; }
        public double getSnrEstimate() { return snrEstimate; }
        public long getSilenceDuration() { return silenceDuration; }
        public long getSpeechDuration() { return speechDuration; }
        public long getTimestamp() { return timestamp; }
        
        @Override
        public String toString() {
            return String.format("VADStats{speech=%s, energy=%.3f, snr=%.2f, silence=%dms, speech=%dms}", 
                hasSpeech, energy, snrEstimate, silenceDuration, speechDuration);
        }
    }
}