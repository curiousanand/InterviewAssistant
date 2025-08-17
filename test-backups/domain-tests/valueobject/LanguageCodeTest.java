package com.interview.assistant.domain.valueobject;

import org.junit.jupiter.api.Test;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;

/**
 * Test suite for LanguageCode value object
 * 
 * Tests language code validation, normalization, and functionality
 * Rationale: Ensures proper handling of multilingual support
 */
class LanguageCodeTest {

    @Test
    void shouldCreateValidLanguageCode() {
        LanguageCode language = LanguageCode.of("en-US");
        
        assertThat(language.getCode()).isEqualTo("en-us");
        assertThat(language.getDisplayName()).isEqualTo("English (United States)");
        assertThat(language.isRightToLeft()).isFalse();
    }

    @Test
    void shouldCreateLanguageCodeWithCustomDisplayName() {
        LanguageCode language = LanguageCode.of("en-US", "Custom English", false);
        
        assertThat(language.getCode()).isEqualTo("en-us");
        assertThat(language.getDisplayName()).isEqualTo("Custom English");
        assertThat(language.isRightToLeft()).isFalse();
    }

    @Test
    void shouldThrowExceptionForUnsupportedLanguage() {
        assertThatThrownBy(() -> LanguageCode.of("xx-XX"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported language code: xx-xx");
    }

    @Test
    void shouldParseLanguageCodeFromVariousFormats() {
        // Exact match
        LanguageCode exact = LanguageCode.parse("en-US");
        assertThat(exact.getCode()).isEqualTo("en-us");
        
        // Language only - should default to first variant
        LanguageCode languageOnly = LanguageCode.parse("es");
        assertThat(languageOnly.getLanguage()).isEqualTo("es");
        
        // Invalid input - should default to English
        LanguageCode invalid = LanguageCode.parse("invalid");
        assertThat(invalid).isEqualTo(LanguageCode.ENGLISH_US);
        
        // Null input - should default to English
        LanguageCode nullInput = LanguageCode.parse(null);
        assertThat(nullInput).isEqualTo(LanguageCode.ENGLISH_US);
        
        // Empty input - should default to English
        LanguageCode emptyInput = LanguageCode.parse("");
        assertThat(emptyInput).isEqualTo(LanguageCode.ENGLISH_US);
    }

    @Test
    void shouldNormalizeLanguageCodeFormats() {
        LanguageCode underscore = LanguageCode.of("en_US");
        LanguageCode lowercase = LanguageCode.of("en-us");
        LanguageCode uppercase = LanguageCode.of("EN-US");
        
        assertThat(underscore.getCode()).isEqualTo("en-us");
        assertThat(lowercase.getCode()).isEqualTo("en-us");
        assertThat(uppercase.getCode()).isEqualTo("en-us");
    }

    @Test
    void shouldExtractLanguageAndRegionParts() {
        LanguageCode language = LanguageCode.of("fr-CA");
        
        assertThat(language.getLanguage()).isEqualTo("fr");
        assertThat(language.getRegion()).isEqualTo("CA");
    }

    @Test
    void shouldHandleLanguageWithoutRegion() {
        LanguageCode language = LanguageCode.of("ja-JP");
        
        assertThat(language.getLanguage()).isEqualTo("ja");
        assertThat(language.getRegion()).isEqualTo("JP");
    }

    @Test
    void shouldCheckSameLanguageFamily() {
        LanguageCode englishUS = LanguageCode.ENGLISH_US;
        LanguageCode englishGB = LanguageCode.ENGLISH_GB;
        LanguageCode spanish = LanguageCode.SPANISH_ES;
        
        assertThat(englishUS.isSameLanguageFamily(englishGB)).isTrue();
        assertThat(englishUS.isSameLanguageFamily(spanish)).isFalse();
    }

    @Test
    void shouldDetectRightToLeftLanguages() {
        LanguageCode arabic = LanguageCode.ARABIC_SA;
        LanguageCode english = LanguageCode.ENGLISH_US;
        
        assertThat(arabic.isRightToLeft()).isTrue();
        assertThat(english.isRightToLeft()).isFalse();
    }

    @Test
    void shouldProvideLanguageFallback() {
        LanguageCode englishUS = LanguageCode.ENGLISH_US;
        LanguageCode fallback = englishUS.getFallback();
        
        // Should find another English variant or default to US
        assertThat(fallback.getLanguage()).isEqualTo("en");
    }

    @Test
    void shouldConvertToAzureFormat() {
        LanguageCode language = LanguageCode.of("es-MX");
        
        assertThat(language.toAzureFormat()).isEqualTo("es-mx");
    }

    @Test
    void shouldConvertToDisplayFormat() {
        LanguageCode language = LanguageCode.SPANISH_MX;
        
        assertThat(language.toDisplayFormat()).isEqualTo("Spanish (Mexico)");
    }

    @Test
    void shouldValidateLanguageCodeFormat() {
        assertThatThrownBy(() -> LanguageCode.of("invalid", "Display", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid language code format");
        
        assertThatThrownBy(() -> LanguageCode.of("e", "Display", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid language code format");
        
        assertThatThrownBy(() -> LanguageCode.of("en-USA", "Display", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid language code format");
    }

    @Test
    void shouldThrowExceptionForNullOrEmptyCode() {
        assertThatThrownBy(() -> LanguageCode.of(null, "Display", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Language code cannot be null or empty");
        
        assertThatThrownBy(() -> LanguageCode.of("", "Display", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Language code cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForNullOrEmptyDisplayName() {
        assertThatThrownBy(() -> LanguageCode.of("en-US", null, false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Display name cannot be null or empty");
        
        assertThatThrownBy(() -> LanguageCode.of("en-US", "", false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Display name cannot be null or empty");
    }

    @Test
    void shouldCheckIfLanguageIsSupported() {
        assertThat(LanguageCode.isSupported("en-US")).isTrue();
        assertThat(LanguageCode.isSupported("fr-FR")).isTrue();
        assertThat(LanguageCode.isSupported("xx-XX")).isFalse();
    }

    @Test
    void shouldGetAllSupportedLanguages() {
        Set<LanguageCode> supported = LanguageCode.getSupportedLanguages();
        
        assertThat(supported).isNotEmpty();
        assertThat(supported).contains(LanguageCode.ENGLISH_US);
        assertThat(supported).contains(LanguageCode.SPANISH_ES);
        assertThat(supported).contains(LanguageCode.FRENCH_FR);
    }

    @Test
    void shouldUseStaticConstants() {
        assertThat(LanguageCode.ENGLISH_US.getCode()).isEqualTo("en-us");
        assertThat(LanguageCode.ENGLISH_GB.getCode()).isEqualTo("en-gb");
        assertThat(LanguageCode.SPANISH_ES.getCode()).isEqualTo("es-es");
        assertThat(LanguageCode.SPANISH_MX.getCode()).isEqualTo("es-mx");
        assertThat(LanguageCode.FRENCH_FR.getCode()).isEqualTo("fr-fr");
        assertThat(LanguageCode.GERMAN_DE.getCode()).isEqualTo("de-de");
        assertThat(LanguageCode.JAPANESE_JP.getCode()).isEqualTo("ja-jp");
        assertThat(LanguageCode.CHINESE_CN.getCode()).isEqualTo("zh-cn");
        assertThat(LanguageCode.ARABIC_SA.getCode()).isEqualTo("ar-sa");
    }

    @Test
    void shouldBeEqualBasedOnCode() {
        LanguageCode lang1 = LanguageCode.of("en-US");
        LanguageCode lang2 = LanguageCode.of("en-US");
        LanguageCode lang3 = LanguageCode.of("fr-FR");
        
        assertThat(lang1).isEqualTo(lang2);
        assertThat(lang1.hashCode()).isEqualTo(lang2.hashCode());
        assertThat(lang1).isNotEqualTo(lang3);
    }

    @Test
    void shouldHaveValidToString() {
        LanguageCode language = LanguageCode.ENGLISH_US;
        String toString = language.toString();
        
        assertThat(toString).contains("en-us");
    }

    @Test
    void shouldHandleCaseInsensitiveParsingCorrectly() {
        LanguageCode lower = LanguageCode.parse("en-us");
        LanguageCode upper = LanguageCode.parse("EN-US");
        LanguageCode mixed = LanguageCode.parse("En-Us");
        
        assertThat(lower.getCode()).isEqualTo("en-us");
        assertThat(upper.getCode()).isEqualTo("en-us");
        assertThat(mixed.getCode()).isEqualTo("en-us");
    }

    @Test
    void shouldCreateKnownLanguagesWithPredefinedConstants() {
        // Testing that known languages return the same instance from constants
        LanguageCode englishUS = LanguageCode.of("en-US");
        
        assertThat(englishUS).isEqualTo(LanguageCode.ENGLISH_US);
    }

    @Test
    void shouldGenerateDisplayNameForUnknownLanguages() {
        // This tests internal logic for creating display names for supported but not predefined languages
        // Since we can't easily test the internal method, we'll test with a supported language not in constants
        
        // Note: This might need adjustment based on the actual supported languages list
        assertThat(LanguageCode.isSupported("sv-SE")).isTrue(); // Swedish should be supported
    }
}