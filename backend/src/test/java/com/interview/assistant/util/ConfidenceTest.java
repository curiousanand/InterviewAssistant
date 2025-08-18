package com.interview.assistant.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for Confidence value object
 * <p>
 * Tests validation, categorization, and business logic
 */
@DisplayName("Confidence Value Object Tests")
class ConfidenceTest {

    @Test
    @DisplayName("Should create confidence with valid value")
    void shouldCreateConfidenceWithValidValue() {
        // When
        Confidence confidence = Confidence.of(0.85);

        // Then
        assertThat(confidence.getValue()).isEqualTo(0.85);
    }

    @Test
    @DisplayName("Should provide predefined confidence levels")
    void shouldProvidePredefinedConfidenceLevels() {
        // Test predefined constants
        assertThat(Confidence.PERFECT.getValue()).isEqualTo(1.0);
        assertThat(Confidence.HIGH.getValue()).isEqualTo(0.95);
        assertThat(Confidence.MEDIUM.getValue()).isEqualTo(0.75);
        assertThat(Confidence.LOW.getValue()).isEqualTo(0.6);
        assertThat(Confidence.ZERO.getValue()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("Should validate confidence range")
    void shouldValidateConfidenceRange() {
        // Test valid values
        assertThatNoException().isThrownBy(() -> Confidence.of(0.0));
        assertThatNoException().isThrownBy(() -> Confidence.of(0.5));
        assertThatNoException().isThrownBy(() -> Confidence.of(1.0));

        // Test invalid values
        assertThatThrownBy(() -> Confidence.of(-0.1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Confidence must be between 0.0 and 1.0");

        assertThatThrownBy(() -> Confidence.of(1.1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Confidence must be between 0.0 and 1.0");
    }

    @Test
    @DisplayName("Should categorize confidence levels correctly")
    void shouldCategorizeConfidenceLevelsCorrectly() {
        // Test HIGH confidence (>= 0.9)
        Confidence high1 = Confidence.of(0.95);
        Confidence high2 = Confidence.of(0.9);
        assertThat(high1.isHigh()).isTrue();
        assertThat(high2.isHigh()).isTrue();
        assertThat(high1.getLevel()).isEqualTo(Confidence.ConfidenceLevel.HIGH);

        // Test MEDIUM confidence (0.7 - 0.89)
        Confidence medium1 = Confidence.of(0.85);
        Confidence medium2 = Confidence.of(0.7);
        assertThat(medium1.getLevel()).isEqualTo(Confidence.ConfidenceLevel.MEDIUM);
        assertThat(medium2.getLevel()).isEqualTo(Confidence.ConfidenceLevel.MEDIUM);

        // Test LOW confidence (0.5 - 0.69)
        Confidence low1 = Confidence.of(0.6);
        Confidence low2 = Confidence.of(0.5);
        assertThat(low1.getLevel()).isEqualTo(Confidence.ConfidenceLevel.LOW);
        assertThat(low2.getLevel()).isEqualTo(Confidence.ConfidenceLevel.LOW);

        // Test VERY_LOW confidence (< 0.3)
        Confidence veryLow = Confidence.of(0.2);
        assertThat(veryLow.getLevel()).isEqualTo(Confidence.ConfidenceLevel.UNACCEPTABLE);
    }

    @Test
    @DisplayName("Should determine acceptability correctly")
    void shouldDetermineAcceptabilityCorrectly() {
        // Acceptable confidence (>= 0.3)
        Confidence acceptable1 = Confidence.of(0.8);
        Confidence acceptable2 = Confidence.of(0.3);
        assertThat(acceptable1.isAcceptable()).isTrue();
        assertThat(acceptable2.isAcceptable()).isTrue();

        // Unacceptable confidence (< 0.3)
        Confidence unacceptable = Confidence.of(0.2);
        assertThat(unacceptable.isAcceptable()).isFalse();
    }

    @Test
    @DisplayName("Should provide meaningful descriptions")
    void shouldProvideMeaningfulDescriptions() {
        assertThat(Confidence.of(0.95).asLevelString()).contains("High");
        assertThat(Confidence.of(0.8).asLevelString()).contains("Medium");
        assertThat(Confidence.of(0.6).asLevelString()).contains("Low");
        assertThat(Confidence.of(0.2).asLevelString()).contains("Unacceptable");
    }

    @Test
    @DisplayName("Should format as percentage correctly")
    void shouldFormatAsPercentageCorrectly() {
        Confidence confidence = Confidence.of(0.856);

        // Percentage as double
        assertThat(confidence.asPercentage()).isEqualTo(85.6);

        // Percentage as formatted string
        assertThat(confidence.asPercentageString()).isEqualTo("85.6%");
    }

    @Test
    @DisplayName("Should compare confidences correctly")
    void shouldCompareConfidencesCorrectly() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.9);
        Confidence conf3 = Confidence.of(0.8);

        // Test convenience methods
        assertThat(conf1.isWorseThan(conf2)).isTrue();
        assertThat(conf2.isBetterThan(conf1)).isTrue();
        assertThat(conf1.isWorseThan(conf3)).isFalse();
    }

    @Test
    @DisplayName("Should combine confidences correctly")
    void shouldCombineConfidencesCorrectly() {
        Confidence conf1 = Confidence.of(0.8);
        Confidence conf2 = Confidence.of(0.9);

        // Combine with equal weight (0.5)
        Confidence combined = conf1.combineWith(conf2, 0.5);
        // (0.8 * 0.5) + (0.9 * 0.5) = 0.4 + 0.45 = 0.85
        assertThat(combined.getValue()).isCloseTo(0.85, within(0.0001));

        // Combine with different weight (0.75)
        Confidence combined2 = conf1.combineWith(conf2, 0.75);
        // (0.8 * 0.75) + (0.9 * 0.25) = 0.6 + 0.225 = 0.825
        assertThat(combined2.getValue()).isCloseTo(0.825, within(0.0001));
    }

    @Test
    @DisplayName("Should handle boundary values correctly")
    void shouldHandleBoundaryValuesCorrectly() {
        // Test exact threshold boundaries
        Confidence exactHigh = Confidence.of(0.9);
        Confidence justBelowHigh = Confidence.of(0.89999);

        assertThat(exactHigh.isHigh()).isTrue();
        assertThat(justBelowHigh.isHigh()).isFalse();
        assertThat(justBelowHigh.getLevel()).isEqualTo(Confidence.ConfidenceLevel.MEDIUM);

        // Test zero and one
        Confidence zero = Confidence.of(0.0);
        Confidence one = Confidence.of(1.0);

        assertThat(zero.getLevel()).isEqualTo(Confidence.ConfidenceLevel.UNACCEPTABLE);
        assertThat(one.isHigh()).isTrue();
    }

    @Test
    @DisplayName("Should implement equals and hashCode correctly")
    void shouldImplementEqualsAndHashCodeCorrectly() {
        Confidence conf1 = Confidence.of(0.85);
        Confidence conf2 = Confidence.of(0.85);
        Confidence conf3 = Confidence.of(0.75);

        // Test equals
        assertThat(conf1).isEqualTo(conf2);
        assertThat(conf1).isNotEqualTo(conf3);
        assertThat(conf1).isNotEqualTo(null);
        assertThat(conf1).isNotEqualTo("not a confidence");

        // Test hashCode consistency
        assertThat(conf1.hashCode()).isEqualTo(conf2.hashCode());

        // Test reflexivity
        assertThat(conf1).isEqualTo(conf1);
    }

    @Test
    @DisplayName("Should provide meaningful toString")
    void shouldProvideMeaningfulToString() {
        Confidence confidence = Confidence.of(0.85);
        String toString = confidence.toString();

        assertThat(toString).contains("0.85");
        assertThat(toString).contains("Confidence");
    }

    @Test
    @DisplayName("Should handle precision correctly")
    void shouldHandlePrecisionCorrectly() {
        // Test floating point precision
        Confidence conf1 = Confidence.of(0.1 + 0.2); // Known floating point issue
        Confidence conf2 = Confidence.of(0.3);

        // Should handle floating point precision gracefully
        assertThat(Math.abs(conf1.getValue() - 0.3)).isLessThan(0.0001);
    }

    @Test
    @DisplayName("Should support confidence operations")
    void shouldSupportConfidenceOperations() {
        Confidence base = Confidence.of(0.8);

        // Test increase/decrease operations if available
        // Note: These methods would need to be implemented in the actual class
        // This is a test for potential future functionality

        // Test min/max operations
        Confidence high = Confidence.of(0.9);
        Confidence low = Confidence.of(0.6);

        Confidence max = base.max(high);
        Confidence min = base.min(low);

        assertThat(max.getValue()).isEqualTo(0.9);
        assertThat(min.getValue()).isEqualTo(0.6);
    }
}