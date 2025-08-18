package com.interview.assistant.util;


import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * LanguageCode value object representing ISO language codes
 * 
 * Why: Type-safe language handling with validation
 * Pattern: DDD Value Object - immutable with business logic
 * Rationale: Language codes are fundamental to multilingual support
 */
public class LanguageCode {
    
    private final String code;
    private final String displayName;
    private final boolean rtl; // Right-to-left language
    
    // Getters
    public String getCode() { return code; }
    public String getDisplayName() { return displayName; }
    public boolean isRtl() { return rtl; }
    
    // Supported languages for speech recognition
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of(
        "en-US", "en-GB", "en-AU", "en-CA", "en-IN",
        "es-ES", "es-MX", "es-AR", "es-CO", "es-CL",
        "fr-FR", "fr-CA", "fr-BE", "fr-CH",
        "de-DE", "de-AT", "de-CH",
        "it-IT", "it-CH",
        "pt-PT", "pt-BR",
        "ru-RU",
        "ja-JP",
        "ko-KR",
        "zh-CN", "zh-TW", "zh-HK",
        "ar-SA", "ar-EG", "ar-AE",
        "hi-IN",
        "nl-NL", "nl-BE",
        "sv-SE",
        "da-DK",
        "no-NO",
        "fi-FI",
        "pl-PL",
        "cs-CZ",
        "hu-HU",
        "tr-TR",
        "he-IL",
        "th-TH"
    );
    
    // Common language defaults
    public static final LanguageCode ENGLISH_US = new LanguageCode("en-US", "English (United States)", false);
    public static final LanguageCode ENGLISH_GB = new LanguageCode("en-GB", "English (United Kingdom)", false);
    public static final LanguageCode SPANISH_ES = new LanguageCode("es-ES", "Spanish (Spain)", false);
    public static final LanguageCode SPANISH_MX = new LanguageCode("es-MX", "Spanish (Mexico)", false);
    public static final LanguageCode FRENCH_FR = new LanguageCode("fr-FR", "French (France)", false);
    public static final LanguageCode GERMAN_DE = new LanguageCode("de-DE", "German (Germany)", false);
    public static final LanguageCode JAPANESE_JP = new LanguageCode("ja-JP", "Japanese (Japan)", false);
    public static final LanguageCode CHINESE_CN = new LanguageCode("zh-CN", "Chinese (Simplified)", false);
    public static final LanguageCode ARABIC_SA = new LanguageCode("ar-SA", "Arabic (Saudi Arabia)", true);
    
    private LanguageCode(String code, String displayName, boolean rtl) {
        validateCode(code);
        validateDisplayName(displayName);
        
        this.code = code.toLowerCase();
        this.displayName = displayName;
        this.rtl = rtl;
    }
    
    /**
     * Create language code with validation
     * Why: Factory method ensures valid language code creation
     */
    public static LanguageCode of(String code) {
        String normalizedCode = normalizeCode(code);
        validateSupported(normalizedCode);
        
        return createKnownLanguage(normalizedCode);
    }
    
    /**
     * Create language code with custom display name
     * Why: Support for custom language configurations
     */
    public static LanguageCode of(String code, String displayName, boolean rtl) {
        String normalizedCode = normalizeCode(code);
        return new LanguageCode(normalizedCode, displayName, rtl);
    }
    
    /**
     * Parse language code from various formats
     * Why: Flexible parsing for different input sources
     */
    public static LanguageCode parse(String input) {
        if (input == null || input.trim().isEmpty()) {
            return ENGLISH_US; // Default fallback
        }
        
        String normalized = normalizeCode(input.trim());
        
        // Try exact match first
        if (SUPPORTED_LANGUAGES.contains(normalized)) {
            return of(normalized);
        }
        
        // Try language-only match (e.g., "en" -> "en-US")
        String languageOnly = normalized.split("-")[0];
        return SUPPORTED_LANGUAGES.stream()
            .filter(code -> code.startsWith(languageOnly + "-"))
            .findFirst()
            .map(LanguageCode::of)
            .orElse(ENGLISH_US);
    }
    
    /**
     * Create language code from string (alias for parse method)
     * Why: Alternative method name for compatibility
     */
    public static LanguageCode fromString(String input) {
        return parse(input);
    }
    
    /**
     * Get all supported languages
     * Why: Provide list for UI selection
     */
    public static Set<LanguageCode> getSupportedLanguages() {
        return SUPPORTED_LANGUAGES.stream()
            .map(LanguageCode::createKnownLanguage)
            .collect(Collectors.toSet());
    }
    
    /**
     * Check if language is supported
     * Why: Validation for language selection
     */
    public static boolean isSupported(String code) {
        return SUPPORTED_LANGUAGES.contains(normalizeCode(code));
    }
    
    /**
     * Get language part only (without region)
     * Why: Language family grouping
     */
    public String getLanguage() {
        return code.split("-")[0];
    }
    
    /**
     * Get region part only
     * Why: Regional variant identification
     */
    public String getRegion() {
        String[] parts = code.split("-");
        return parts.length > 1 ? parts[1] : null;
    }
    
    /**
     * Check if same language family
     * Why: Language similarity checking
     */
    public boolean isSameLanguageFamily(LanguageCode other) {
        return this.getLanguage().equals(other.getLanguage());
    }
    
    /**
     * Check if language requires right-to-left text direction
     * Why: UI layout decisions
     */
    public boolean isRightToLeft() {
        return rtl;
    }
    
    /**
     * Get fallback language for unsupported input
     * Why: Graceful degradation for unsupported languages
     */
    public LanguageCode getFallback() {
        String language = getLanguage();
        
        // Try to find another variant of the same language
        LanguageCode fallback = SUPPORTED_LANGUAGES.stream()
            .filter(code -> code.startsWith(language + "-"))
            .filter(code -> !code.equals(this.code))
            .findFirst()
            .map(LanguageCode::createKnownLanguage)
            .orElse(ENGLISH_US);
            
        return fallback;
    }
    
    /**
     * Convert to Azure Speech Service format
     * Why: Service integration compatibility
     */
    public String toAzureFormat() {
        // Azure uses the same BCP-47 format
        return code;
    }
    
    /**
     * Convert to display format for UI
     * Why: User-friendly language selection
     */
    public String toDisplayFormat() {
        return displayName;
    }
    
    private static String normalizeCode(String code) {
        if (code == null) return "";
        
        // Handle common formats: en_US, en-us, EN-US -> en-US
        String normalized = code.replace("_", "-").toLowerCase();
        
        // Ensure proper casing for region
        String[] parts = normalized.split("-");
        if (parts.length == 2) {
            return parts[0] + "-" + parts[1].toUpperCase();
        }
        
        return normalized;
    }
    
    private static LanguageCode createKnownLanguage(String code) {
        // Return predefined constants for known languages
        switch (code) {
            case "en-us": return ENGLISH_US;
            case "en-gb": return ENGLISH_GB;
            case "es-es": return SPANISH_ES;
            case "es-mx": return SPANISH_MX;
            case "fr-fr": return FRENCH_FR;
            case "de-de": return GERMAN_DE;
            case "ja-jp": return JAPANESE_JP;
            case "zh-cn": return CHINESE_CN;
            case "ar-sa": return ARABIC_SA;
            default:
                // Create new instance for other supported languages
                return new LanguageCode(code, getDisplayNameForCode(code), isRtlLanguage(code));
        }
    }
    
    private static String getDisplayNameForCode(String code) {
        // Simplified display name generation
        String[] parts = code.split("-");
        String language = parts[0];
        String region = parts.length > 1 ? parts[1] : "";
        
        return capitalizeFirst(language) + 
               (region.isEmpty() ? "" : " (" + region.toUpperCase() + ")");
    }
    
    private static boolean isRtlLanguage(String code) {
        String language = code.split("-")[0];
        return Arrays.asList("ar", "he", "fa", "ur").contains(language);
    }
    
    private static String capitalizeFirst(String input) {
        if (input == null || input.isEmpty()) return input;
        return input.substring(0, 1).toUpperCase() + input.substring(1);
    }
    
    private void validateCode(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Language code cannot be null or empty");
        }
        
        if (!code.matches("^[a-z]{2}(-[A-Z]{2})?$")) {
            throw new IllegalArgumentException("Invalid language code format. Expected: xx or xx-XX");
        }
    }
    
    private void validateDisplayName(String displayName) {
        if (displayName == null || displayName.trim().isEmpty()) {
            throw new IllegalArgumentException("Display name cannot be null or empty");
        }
    }
    
    private static void validateSupported(String code) {
        if (!SUPPORTED_LANGUAGES.contains(code)) {
            throw new IllegalArgumentException("Unsupported language code: " + code);
        }
    }
}