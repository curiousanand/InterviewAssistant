package com.interview.assistant.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for AudioFormat value object
 * 
 * Tests creation, validation, business logic, and edge cases
 */
@DisplayName("AudioFormat Value Object Tests")
class AudioFormatTest {
    
    @Test
    @DisplayName("Should create valid PCM audio format")
    void shouldCreateValidPcmAudioFormat() {
        // When
        AudioFormat format = AudioFormat.pcm(16000, 1, 16);
        
        // Then
        assertThat(format.getSampleRate()).isEqualTo(16000);
        assertThat(format.getChannels()).isEqualTo(1);
        assertThat(format.getBitsPerSample()).isEqualTo(16);
        assertThat(format.getEncoding()).isEqualTo("PCM");
    }
    
    @Test
    @DisplayName("Should create audio format with all parameters")
    void shouldCreateAudioFormatWithAllParameters() {
        // When
        AudioFormat format = AudioFormat.of(44100, 2, 16, "PCM");
        
        // Then
        assertThat(format.getSampleRate()).isEqualTo(44100);
        assertThat(format.getChannels()).isEqualTo(2);
        assertThat(format.getBitsPerSample()).isEqualTo(16);
        assertThat(format.getEncoding()).isEqualTo("PCM");
    }
    
    @Test
    @DisplayName("Should provide predefined standard formats")
    void shouldProvideStandardFormats() {
        // Test PCM 16kHz mono
        AudioFormat pcm16k = AudioFormat.PCM_16KHZ_MONO;
        assertThat(pcm16k.getSampleRate()).isEqualTo(16000);
        assertThat(pcm16k.getChannels()).isEqualTo(1);
        assertThat(pcm16k.isMono()).isTrue();
        
        // Test PCM 44kHz stereo
        AudioFormat pcm44k = AudioFormat.PCM_44KHZ_STEREO;
        assertThat(pcm44k.getSampleRate()).isEqualTo(44100);
        assertThat(pcm44k.getChannels()).isEqualTo(2);
        assertThat(pcm44k.isStereo()).isTrue();
        
        // Test PCM 48kHz mono
        AudioFormat pcm48k = AudioFormat.PCM_48KHZ_MONO;
        assertThat(pcm48k.getSampleRate()).isEqualTo(48000);
        assertThat(pcm48k.getChannels()).isEqualTo(1);
        assertThat(pcm48k.isMono()).isTrue();
    }
    
    @Test
    @DisplayName("Should validate sample rate correctly")
    void shouldValidateSampleRateCorrectly() {
        // Test invalid sample rates
        assertThatThrownBy(() -> AudioFormat.of(0, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be positive");
            
        assertThatThrownBy(() -> AudioFormat.of(-1000, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be positive");
            
        assertThatThrownBy(() -> AudioFormat.of(7999, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be between 8kHz and 192kHz");
            
        assertThatThrownBy(() -> AudioFormat.of(192001, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be between 8kHz and 192kHz");
    }
    
    @Test
    @DisplayName("Should validate channels correctly")
    void shouldValidateChannelsCorrectly() {
        // Test invalid channel counts
        assertThatThrownBy(() -> AudioFormat.of(16000, 0, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Channels must be between 1 and 8");
            
        assertThatThrownBy(() -> AudioFormat.of(16000, -1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Channels must be between 1 and 8");
            
        assertThatThrownBy(() -> AudioFormat.of(16000, 9, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Channels must be between 1 and 8");
    }
    
    @Test
    @DisplayName("Should validate bits per sample correctly")
    void shouldValidateBitsPerSampleCorrectly() {
        // Test invalid bits per sample
        assertThatThrownBy(() -> AudioFormat.of(16000, 1, 12, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Bits per sample must be 8, 16, 24, or 32");
            
        assertThatThrownBy(() -> AudioFormat.of(16000, 1, 0, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Bits per sample must be 8, 16, 24, or 32");
    }
    
    @Test
    @DisplayName("Should validate encoding correctly")
    void shouldValidateEncodingCorrectly() {
        // Test invalid encodings
        assertThatThrownBy(() -> AudioFormat.of(16000, 1, 16, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Encoding cannot be null or empty");
            
        assertThatThrownBy(() -> AudioFormat.of(16000, 1, 16, ""))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Encoding cannot be null or empty");
            
        assertThatThrownBy(() -> AudioFormat.of(16000, 1, 16, "   "))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Encoding cannot be null or empty");
    }
    
    @Test
    @DisplayName("Should detect mono and stereo correctly")
    void shouldDetectMonoAndStereoCorrectly() {
        AudioFormat mono = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat stereo = AudioFormat.of(16000, 2, 16, "PCM");
        AudioFormat surround = AudioFormat.of(16000, 6, 16, "PCM");
        
        assertThat(mono.isMono()).isTrue();
        assertThat(mono.isStereo()).isFalse();
        
        assertThat(stereo.isMono()).isFalse();
        assertThat(stereo.isStereo()).isTrue();
        
        assertThat(surround.isMono()).isFalse();
        assertThat(surround.isStereo()).isFalse();
    }
    
    @Test
    @DisplayName("Should detect CD quality correctly")
    void shouldDetectCdQualityCorrectly() {
        AudioFormat cdQuality = AudioFormat.of(44100, 2, 16, "PCM");
        AudioFormat notCdQuality1 = AudioFormat.of(48000, 2, 16, "PCM");
        AudioFormat notCdQuality2 = AudioFormat.of(44100, 2, 24, "PCM");
        
        assertThat(cdQuality.isCDQuality()).isTrue();
        assertThat(notCdQuality1.isCDQuality()).isFalse();
        assertThat(notCdQuality2.isCDQuality()).isFalse();
    }
    
    @Test
    @DisplayName("Should detect speech recognition suitability")
    void shouldDetectSpeechRecognitionSuitability() {
        // Suitable formats
        AudioFormat suitable1 = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat suitable2 = AudioFormat.of(44100, 2, 24, "PCM");
        AudioFormat suitable3 = AudioFormat.of(8000, 1, 32, "PCM");
        
        assertThat(suitable1.isSuitableForSpeechRecognition()).isTrue();
        assertThat(suitable2.isSuitableForSpeechRecognition()).isTrue();
        assertThat(suitable3.isSuitableForSpeechRecognition()).isTrue();
        
        // Unsuitable formats
        AudioFormat unsuitable1 = AudioFormat.of(7999, 1, 16, "PCM"); // Would fail validation
        AudioFormat unsuitable2 = AudioFormat.of(16000, 9, 16, "PCM"); // Would fail validation
        
        // These would fail during construction, so we test with valid but unsuitable formats
        AudioFormat borderline = AudioFormat.of(48001, 1, 16, "PCM"); // Just above 48kHz
        assertThat(borderline.isSuitableForSpeechRecognition()).isFalse();
    }
    
    @Test
    @DisplayName("Should calculate bytes per second correctly")
    void shouldCalculateBytesPerSecondCorrectly() {
        AudioFormat format = AudioFormat.of(16000, 1, 16, "PCM");
        
        // 16000 samples/sec * 1 channel * 16 bits/sample / 8 bits/byte = 32000 bytes/sec
        int expectedBytesPerSecond = 32000;
        
        assertThat(format.getBytesPerSecond()).isEqualTo(expectedBytesPerSecond);
    }
    
    @Test
    @DisplayName("Should calculate bytes for duration correctly")
    void shouldCalculateBytesForDurationCorrectly() {
        AudioFormat format = AudioFormat.of(16000, 1, 16, "PCM");
        
        // For 1 second (1000ms)
        long bytesFor1Second = format.getBytesForDuration(1000);
        assertThat(bytesFor1Second).isEqualTo(32000);
        
        // For 500ms
        long bytesFor500ms = format.getBytesForDuration(500);
        assertThat(bytesFor500ms).isEqualTo(16000);
    }
    
    @Test
    @DisplayName("Should create format variations correctly")
    void shouldCreateFormatVariationsCorrectly() {
        AudioFormat original = AudioFormat.of(44100, 2, 16, "PCM");
        
        // Test sample rate change
        AudioFormat newSampleRate = original.withSampleRate(48000);
        assertThat(newSampleRate.getSampleRate()).isEqualTo(48000);
        assertThat(newSampleRate.getChannels()).isEqualTo(2);
        assertThat(newSampleRate.getBitsPerSample()).isEqualTo(16);
        
        // Test to mono
        AudioFormat mono = original.toMono();
        assertThat(mono.getChannels()).isEqualTo(1);
        assertThat(mono.getSampleRate()).isEqualTo(44100);
        
        // Test to stereo
        AudioFormat monoOriginal = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat stereo = monoOriginal.toStereo();
        assertThat(stereo.getChannels()).isEqualTo(2);
        assertThat(stereo.getSampleRate()).isEqualTo(16000);
    }
    
    @Test
    @DisplayName("Should provide human readable description")
    void shouldProvideHumanReadableDescription() {
        AudioFormat mono = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat stereo = AudioFormat.of(44100, 2, 24, "PCM");
        AudioFormat surround = AudioFormat.of(48000, 6, 32, "FLAC");
        
        assertThat(mono.getDescription()).isEqualTo("PCM 16000Hz Mono 16-bit");
        assertThat(stereo.getDescription()).isEqualTo("FLAC 44100Hz Stereo 24-bit");
        assertThat(surround.getDescription()).isEqualTo("FLAC 48000Hz 6 channels 32-bit");
    }
    
    @Test
    @DisplayName("Should check compatibility correctly")
    void shouldCheckCompatibilityCorrectly() {
        AudioFormat format1 = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat format2 = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat format3 = AudioFormat.of(16000, 2, 16, "PCM"); // Different channels
        AudioFormat format4 = AudioFormat.of(44100, 1, 16, "PCM"); // Different sample rate
        AudioFormat format5 = AudioFormat.of(16000, 1, 16, "FLAC"); // Different encoding
        
        assertThat(format1.isCompatibleWith(format2)).isTrue();
        assertThat(format1.isCompatibleWith(format3)).isFalse(); // Different channels
        assertThat(format1.isCompatibleWith(format4)).isFalse(); // Different sample rate
        assertThat(format1.isCompatibleWith(format5)).isFalse(); // Different encoding
    }
    
    @Test
    @DisplayName("Should implement equals and hashCode correctly")
    void shouldImplementEqualsAndHashCodeCorrectly() {
        AudioFormat format1 = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat format2 = AudioFormat.of(16000, 1, 16, "PCM");
        AudioFormat format3 = AudioFormat.of(44100, 1, 16, "PCM");
        
        // Test equals
        assertThat(format1).isEqualTo(format2);
        assertThat(format1).isNotEqualTo(format3);
        assertThat(format1).isNotEqualTo(null);
        assertThat(format1).isNotEqualTo("not an audio format");
        
        // Test hashCode consistency
        assertThat(format1.hashCode()).isEqualTo(format2.hashCode());
        
        // Test reflexivity
        assertThat(format1).isEqualTo(format1);
    }
    
    @Test
    @DisplayName("Should provide meaningful toString")
    void shouldProvideMeaningfulToString() {
        AudioFormat format = AudioFormat.of(16000, 1, 16, "PCM");
        String toString = format.toString();
        
        assertThat(toString).contains("16000");
        assertThat(toString).contains("1");
        assertThat(toString).contains("16");
        assertThat(toString).contains("PCM");
        assertThat(toString).contains("AudioFormat");
    }
}