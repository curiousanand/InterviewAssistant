package com.interview.assistant.domain.valueobject;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/**
 * Test suite for Confidence value object
 * 
 * Tests confidence validation, categorization, and business logic
 * Rationale: Ensures confidence scores are handled correctly for transcription quality
 */
class ConfidenceTest {

    @Test
    void shouldCreateValidConfidenceFromValue() {
        Confidence confidence = Confidence.of(0.85);
        
        assertThat(confidence.getValue()).isEqualTo(0.85);
        assertThat(confidence.getLevel()).isEqualTo(Confidence.ConfidenceLevel.MEDIUM);
    }

    @Test
    void shouldCreateConfidenceFromPercentage() {
        Confidence confidence = Confidence.fromPercentage(75.5);
        
        assertThat(confidence.getValue()).isEqualTo(0.755);
        assertThat(confidence.asPercentage()).isEqualTo(75.5);
    }

    @Test
    void shouldCreateSafeConfidenceWithBoundsChecking() {
        Confidence overMax = Confidence.safe(1.5);
        Confidence underMin = Confidence.safe(-0.3);
        Confidence valid = Confidence.safe(0.8);
        
        assertThat(overMax.getValue()).isEqualTo(1.0);
        assertThat(underMin.getValue()).isEqualTo(0.0);
        assertThat(valid.getValue()).isEqualTo(0.8);
    }

    @Test
    void shouldThrowExceptionForInvalidConfidenceValue() {
        assertThatThrownBy(() -> Confidence.of(-0.1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence value must be between 0.0 and 1.0");
        
        assertThatThrownBy(() -> Confidence.of(1.1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence value must be between 0.0 and 1.0");
    }

    @Test
    void shouldThrowExceptionForNaNOrInfinite() {
        assertThatThrownBy(() -> Confidence.of(Double.NaN))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence value cannot be NaN or infinite");
        
        assertThatThrownBy(() -> Confidence.of(Double.POSITIVE_INFINITY))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence value cannot be NaN or infinite");
    }

    @Test
    void shouldCategorizeConfidenceLevelsCorrectly() {
        assertThat(Confidence.of(0.95).getLevel()).isEqualTo(Confidence.ConfidenceLevel.HIGH);
        assertThat(Confidence.of(0.85).getLevel()).isEqualTo(Confidence.ConfidenceLevel.MEDIUM);
        assertThat(Confidence.of(0.65).getLevel()).isEqualTo(Confidence.ConfidenceLevel.LOW);
        assertThat(Confidence.of(0.45).getLevel()).isEqualTo(Confidence.ConfidenceLevel.ACCEPTABLE);
        assertThat(Confidence.of(0.25).getLevel()).isEqualTo(Confidence.ConfidenceLevel.UNACCEPTABLE);
    }

    @Test
    void shouldCheckAcceptabilityCorrectly() {
        assertThat(Confidence.of(0.8).isAcceptable()).isTrue();
        assertThat(Confidence.of(0.3).isAcceptable()).isTrue();
        assertThat(Confidence.of(0.2).isAcceptable()).isFalse();
    }

    @Test
    void shouldCheckHighQualityCorrectly() {
        assertThat(Confidence.of(0.95).isHighQuality()).isTrue();
        assertThat(Confidence.of(0.85).isHighQuality()).isFalse();
    }

    @Test
    void shouldCheckReviewRequirementCorrectly() {
        assertThat(Confidence.of(0.4).requiresReview()).isTrue();
        assertThat(Confidence.of(0.6).requiresReview()).isFalse();
    }

    @Test
    void shouldFormatAsPercentageString() {
        Confidence confidence = Confidence.of(0.856);
        
        assertThat(confidence.asPercentageString()).isEqualTo("85.6%");
    }

    @Test
    void shouldFormatAsLevelString() {
        Confidence confidence = Confidence.of(0.95);
        
        assertThat(confidence.asLevelString()).isEqualTo("High (95.0%)");
    }

    @Test
    void shouldCombineWithOtherConfidenceUsingWeightedAverage() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.6);
        
        Confidence combined = conf1.combineWith(conf2, 0.7);
        
        // Expected: 0.8 * 0.7 + 0.6 * 0.3 = 0.56 + 0.18 = 0.74
        assertThat(combined.getValue()).isCloseTo(0.74, offset(0.001));
    }

    @Test
    void shouldThrowExceptionForInvalidWeight() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.6);
        
        assertThatThrownBy(() -> conf1.combineWith(conf2, -0.1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Weight must be between 0.0 and 1.0");
        
        assertThatThrownBy(() -> conf1.combineWith(conf2, 1.1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Weight must be between 0.0 and 1.0");
    }

    @Test
    void shouldGetMinimumConfidence() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.6);
        
        Confidence min = conf1.min(conf2);
        
        assertThat(min.getValue()).isEqualTo(0.6);
    }

    @Test
    void shouldGetMaximumConfidence() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.6);
        
        Confidence max = conf1.max(conf2);
        
        assertThat(max.getValue()).isEqualTo(0.8);
    }

    @Test
    void shouldAdjustConfidenceWithinBounds() {
        Confidence confidence = Confidence.of(0.7);
        
        Confidence boosted = confidence.adjust(0.2);
        Confidence penalized = confidence.adjust(-0.1);
        Confidence overBoosted = confidence.adjust(0.5); // Should cap at 1.0
        
        assertThat(boosted.getValue()).isEqualTo(0.9);
        assertThat(penalized.getValue()).isEqualTo(0.6);
        assertThat(overBoosted.getValue()).isEqualTo(1.0);
    }

    @Test
    void shouldScaleConfidenceByFactor() {
        Confidence confidence = Confidence.of(0.8);
        
        Confidence scaled = confidence.scale(0.5);
        
        assertThat(scaled.getValue()).isEqualTo(0.4);
    }

    @Test
    void shouldThrowExceptionForNegativeScaleFactor() {
        Confidence confidence = Confidence.of(0.8);
        
        assertThatThrownBy(() -> confidence.scale(-0.5))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Scale factor cannot be negative");
    }

    @Test
    void shouldCompareConfidenceValues() {
        Confidence high = Confidence.of(0.9);
        Confidence low = Confidence.of(0.6);
        
        assertThat(high.isBetterThan(low)).isTrue();
        assertThat(low.isBetterThan(high)).isFalse();
        assertThat(low.isWorseThan(high)).isTrue();
        assertThat(high.isWorseThan(low)).isFalse();
    }

    @Test
    void shouldCalculateUncertainty() {
        Confidence confidence = Confidence.of(0.7);
        
        assertThat(confidence.getUncertainty()).isEqualTo(0.3);
    }

    @Test
    void shouldCalculateQualityScore() {
        Confidence perfect = Confidence.of(1.0);
        Confidence good = Confidence.of(0.8);
        
        double perfectScore = perfect.getQualityScore();
        double goodScore = good.getQualityScore();
        
        assertThat(perfectScore).isEqualTo(1.0);
        assertThat(goodScore).isLessThan(1.0);
        assertThat(goodScore).isGreaterThan(0.0);
    }

    @Test
    void shouldUseStaticConstants() {
        assertThat(Confidence.PERFECT.getValue()).isEqualTo(1.0);
        assertThat(Confidence.HIGH.getValue()).isEqualTo(0.95);
        assertThat(Confidence.GOOD.getValue()).isEqualTo(0.85);
        assertThat(Confidence.MEDIUM.getValue()).isEqualTo(0.75);
        assertThat(Confidence.LOW.getValue()).isEqualTo(0.6);
        assertThat(Confidence.POOR.getValue()).isEqualTo(0.4);
        assertThat(Confidence.VERY_LOW.getValue()).isEqualTo(0.2);
        assertThat(Confidence.ZERO.getValue()).isEqualTo(0.0);
    }

    @Test
    void shouldBeEqualBasedOnValue() {
        Confidence conf1 = Confidence.of(0.75);
        Confidence conf2 = Confidence.of(0.75);
        Confidence conf3 = Confidence.of(0.80);
        
        assertThat(conf1).isEqualTo(conf2);
        assertThat(conf1.hashCode()).isEqualTo(conf2.hashCode());
        assertThat(conf1).isNotEqualTo(conf3);
    }

    @Test
    void shouldHaveValidToString() {
        Confidence confidence = Confidence.of(0.85);
        String toString = confidence.toString();
        
        assertThat(toString).contains("0.85");
    }

    @Test
    void shouldHaveCorrectConfidenceLevelProperties() {
        Confidence.ConfidenceLevel high = Confidence.ConfidenceLevel.HIGH;
        
        assertThat(high.getDisplayName()).isEqualTo("High");
        assertThat(high.getDescription()).isEqualTo("Excellent transcription quality");
    }
}