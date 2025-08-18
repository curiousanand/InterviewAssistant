package com.interview.assistant.util;

import java.util.logging.Logger;

/**
 * Confidence value object representing confidence scores (0.0-1.0)
 * 
 * Why: Type-safe confidence handling with validation and categorization
 * Pattern: DDD Value Object - immutable with business logic
 * Rationale: Confidence scores are critical for transcription quality assessment
 */
public class Confidence {
    
    private static final Logger logger = Logger.getLogger(Confidence.class.getName());
    
    private final double value;
    
    // Getter for value
    public double getValue() {
        return value;
    }
    
    // Confidence level thresholds
    private static final double HIGH_THRESHOLD = 0.9;
    private static final double MEDIUM_THRESHOLD = 0.7;
    private static final double LOW_THRESHOLD = 0.5;
    private static final double ACCEPTABLE_THRESHOLD = 0.3;
    
    // Predefined confidence levels
    public static final Confidence PERFECT = new Confidence(1.0);
    public static final Confidence HIGH = new Confidence(0.95);
    public static final Confidence GOOD = new Confidence(0.85);
    public static final Confidence MEDIUM = new Confidence(0.75);
    public static final Confidence LOW = new Confidence(0.6);
    public static final Confidence POOR = new Confidence(0.4);
    public static final Confidence VERY_LOW = new Confidence(0.2);
    public static final Confidence ZERO = new Confidence(0.0);
    
    private Confidence(double value) {
        validateValue(value);
        this.value = value;
    }
    
    /**
     * Create confidence with validation
     * Why: Factory method ensures valid confidence creation
     */
    public static Confidence of(double value) {
        return new Confidence(value);
    }
    
    /**
     * Create confidence from percentage
     * Why: Convenient creation from percentage values
     */
    public static Confidence fromPercentage(double percentage) {
        return new Confidence(percentage / 100.0);
    }
    
    /**
     * Create confidence with safe bounds checking
     * Why: Graceful handling of out-of-bounds values
     */
    public static Confidence safe(double value) {
        double boundedValue = Math.max(0.0, Math.min(1.0, value));
        return new Confidence(boundedValue);
    }
    
    /**
     * Get confidence level category
     * Why: Business logic for confidence interpretation
     */
    public ConfidenceLevel getLevel() {
        if (value >= HIGH_THRESHOLD) return ConfidenceLevel.HIGH;
        if (value >= MEDIUM_THRESHOLD) return ConfidenceLevel.MEDIUM;
        if (value >= LOW_THRESHOLD) return ConfidenceLevel.LOW;
        if (value >= ACCEPTABLE_THRESHOLD) return ConfidenceLevel.ACCEPTABLE;
        return ConfidenceLevel.UNACCEPTABLE;
    }
    
    /**
     * Check if confidence is acceptable for processing
     * Why: Business rule for transcription acceptance
     */
    public boolean isAcceptable() {
        return value >= ACCEPTABLE_THRESHOLD;
    }
    
    /**
     * Check if confidence is high quality
     * Why: Quality assessment for transcription
     */
    public boolean isHighQuality() {
        return value >= HIGH_THRESHOLD;
    }
    
    /**
     * Check if confidence is high
     * Why: Alias for high quality check for compatibility
     */
    public boolean isHigh() {
        return isHighQuality();
    }
    
    /**
     * Check if confidence requires human review
     * Why: Business rule for manual verification
     */
    public boolean requiresReview() {
        return value < LOW_THRESHOLD;
    }
    
    /**
     * Get confidence as percentage
     * Why: Display formatting for UI
     */
    public double asPercentage() {
        return value * 100.0;
    }
    
    /**
     * Get confidence as formatted percentage string
     * Why: Human-readable confidence display
     */
    public String asPercentageString() {
        return String.format("%.1f%%", asPercentage());
    }
    
    /**
     * Get confidence as formatted string with level
     * Why: Comprehensive confidence display
     */
    public String asLevelString() {
        return String.format("%s (%.1f%%)", getLevel().getDisplayName(), asPercentage());
    }
    
    /**
     * Combine with another confidence using weighted average
     * Why: Aggregate confidence calculation
     */
    public Confidence combineWith(Confidence other, double weight) {
        validateWeight(weight);
        double combinedValue = (this.value * weight) + (other.value * (1.0 - weight));
        return new Confidence(combinedValue);
    }
    
    /**
     * Get minimum confidence with another
     * Why: Conservative confidence estimation
     */
    public Confidence min(Confidence other) {
        return new Confidence(Math.min(this.value, other.value));
    }
    
    /**
     * Get maximum confidence with another
     * Why: Optimistic confidence estimation
     */
    public Confidence max(Confidence other) {
        return new Confidence(Math.max(this.value, other.value));
    }
    
    /**
     * Apply confidence boost/penalty
     * Why: Confidence adjustment based on context
     */
    public Confidence adjust(double adjustment) {
        return safe(value + adjustment);
    }
    
    /**
     * Scale confidence by factor
     * Why: Proportional confidence adjustment
     */
    public Confidence scale(double factor) {
        validateScaleFactor(factor);
        return safe(value * factor);
    }
    
    /**
     * Check if confidence is better than threshold
     * Why: Comparison logic for confidence-based decisions
     */
    public boolean isBetterThan(Confidence threshold) {
        return this.value > threshold.value;
    }
    
    /**
     * Check if confidence is worse than threshold
     * Why: Comparison logic for confidence-based decisions
     */
    public boolean isWorseThan(Confidence threshold) {
        return this.value < threshold.value;
    }
    
    /**
     * Get confidence distance from perfect (1.0)
     * Why: Uncertainty measurement
     */
    public double getUncertainty() {
        return 1.0 - value;
    }
    
    /**
     * Convert to quality score (weighted differently than raw confidence)
     * Why: Business-specific quality assessment
     */
    public double getQualityScore() {
        // Apply sigmoid-like curve to emphasize high confidence
        return Math.pow(value, 0.7);
    }
    
    private void validateValue(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            throw new IllegalArgumentException("Confidence value cannot be NaN or infinite");
        }
        if (value < 0.0 || value > 1.0) {
            throw new IllegalArgumentException("Confidence value must be between 0.0 and 1.0");
        }
    }
    
    private void validateWeight(double weight) {
        if (weight < 0.0 || weight > 1.0) {
            throw new IllegalArgumentException("Weight must be between 0.0 and 1.0");
        }
    }
    
    private void validateScaleFactor(double factor) {
        if (factor < 0.0) {
            throw new IllegalArgumentException("Scale factor cannot be negative");
        }
    }
    
    // Equals, hashCode, and toString methods (replacing Lombok annotations)
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        Confidence that = (Confidence) obj;
        return Double.compare(that.value, value) == 0;
    }
    
    @Override
    public int hashCode() {
        return Double.hashCode(value);
    }
    
    @Override
    public String toString() {
        return "Confidence{value=" + value + ", level=" + getLevel() + "}";
    }
    
    /**
     * Confidence level enumeration
     */
    public enum ConfidenceLevel {
        HIGH("High", "Excellent transcription quality"),
        MEDIUM("Medium", "Good transcription quality"),
        LOW("Low", "Fair transcription quality"),
        ACCEPTABLE("Acceptable", "Usable transcription quality"),
        UNACCEPTABLE("Unacceptable", "Poor transcription quality");
        
        private final String displayName;
        private final String description;
        
        ConfidenceLevel(String displayName, String description) {
            this.displayName = displayName;
            this.description = description;
        }
        
        public String getDisplayName() {
            return displayName;
        }
        
        public String getDescription() {
            return description;
        }
    }
}