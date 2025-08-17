package com.interview.assistant.domain.valueobject;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AudioFormatTest {

    @Test
    void shouldCreateValidAudioFormat() {
        AudioFormat format = AudioFormat.of(44100, 2, 16, "PCM");
        
        assertThat(format.getSampleRate()).isEqualTo(44100);
        assertThat(format.getChannels()).isEqualTo(2);
        assertThat(format.getBitsPerSample()).isEqualTo(16);
        assertThat(format.getEncoding()).isEqualTo("PCM");
    }

    @Test
    void shouldCreatePCMFormat() {
        AudioFormat format = AudioFormat.pcm(16000, 1, 16);
        
        assertThat(format.getSampleRate()).isEqualTo(16000);
        assertThat(format.getChannels()).isEqualTo(1);
        assertThat(format.getBitsPerSample()).isEqualTo(16);
        assertThat(format.getEncoding()).isEqualTo("PCM");
    }

    @Test
    void shouldThrowExceptionForInvalidSampleRate() {
        assertThatThrownBy(() -> AudioFormat.of(0, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be positive");
        
        assertThatThrownBy(() -> AudioFormat.of(200000, 1, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Sample rate must be between 8kHz and 192kHz");
    }

    @Test
    void shouldThrowExceptionForInvalidChannels() {
        assertThatThrownBy(() -> AudioFormat.of(44100, 0, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Channels must be between 1 and 8");
        
        assertThatThrownBy(() -> AudioFormat.of(44100, 10, 16, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Channels must be between 1 and 8");
    }

    @Test
    void shouldThrowExceptionForInvalidBitsPerSample() {
        assertThatThrownBy(() -> AudioFormat.of(44100, 1, 12, "PCM"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Bits per sample must be 8, 16, 24, or 32");
    }

    @Test
    void shouldThrowExceptionForNullEncoding() {
        assertThatThrownBy(() -> AudioFormat.of(44100, 1, 16, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Encoding cannot be null or empty");
    }

    @Test
    void shouldDetectMonoFormat() {
        AudioFormat mono = AudioFormat.pcm(44100, 1, 16);
        AudioFormat stereo = AudioFormat.pcm(44100, 2, 16);
        
        assertThat(mono.isMono()).isTrue();
        assertThat(mono.isStereo()).isFalse();
        
        assertThat(stereo.isMono()).isFalse();
        assertThat(stereo.isStereo()).isTrue();
    }

    @Test
    void shouldDetectCDQuality() {
        AudioFormat cdQuality = AudioFormat.pcm(44100, 2, 16);
        AudioFormat notCdQuality = AudioFormat.pcm(48000, 2, 16);
        
        assertThat(cdQuality.isCDQuality()).isTrue();
        assertThat(notCdQuality.isCDQuality()).isFalse();
    }

    @Test
    void shouldDetectSuitableForSpeechRecognition() {
        AudioFormat suitable = AudioFormat.pcm(16000, 1, 16);
        AudioFormat unsuitable = AudioFormat.pcm(7000, 1, 16);
        
        assertThat(suitable.isSuitableForSpeechRecognition()).isTrue();
        assertThat(unsuitable.isSuitableForSpeechRecognition()).isFalse();
    }

    @Test
    void shouldCalculateBytesPerSecond() {
        AudioFormat format = AudioFormat.pcm(44100, 2, 16);
        
        int expectedBytesPerSecond = (44100 * 2 * 16) / 8;
        assertThat(format.getBytesPerSecond()).isEqualTo(expectedBytesPerSecond);
    }

    @Test
    void shouldCalculateBytesForDuration() {
        AudioFormat format = AudioFormat.pcm(16000, 1, 16);
        
        long bytesFor1Second = format.getBytesForDuration(1000);
        assertThat(bytesFor1Second).isEqualTo(format.getBytesPerSecond());
    }

    @Test
    void shouldConvertToMono() {
        AudioFormat stereo = AudioFormat.pcm(44100, 2, 16);
        AudioFormat mono = stereo.toMono();
        
        assertThat(mono.getChannels()).isEqualTo(1);
        assertThat(mono.getSampleRate()).isEqualTo(stereo.getSampleRate());
        assertThat(mono.getBitsPerSample()).isEqualTo(stereo.getBitsPerSample());
    }

    @Test
    void shouldConvertToStereo() {
        AudioFormat mono = AudioFormat.pcm(44100, 1, 16);
        AudioFormat stereo = mono.toStereo();
        
        assertThat(stereo.getChannels()).isEqualTo(2);
        assertThat(stereo.getSampleRate()).isEqualTo(mono.getSampleRate());
        assertThat(stereo.getBitsPerSample()).isEqualTo(mono.getBitsPerSample());
    }

    @Test
    void shouldChangeSampleRate() {
        AudioFormat original = AudioFormat.pcm(44100, 2, 16);
        AudioFormat changed = original.withSampleRate(48000);
        
        assertThat(changed.getSampleRate()).isEqualTo(48000);
        assertThat(changed.getChannels()).isEqualTo(original.getChannels());
        assertThat(changed.getBitsPerSample()).isEqualTo(original.getBitsPerSample());
    }

    @Test
    void shouldGenerateDescription() {
        AudioFormat format = AudioFormat.pcm(44100, 2, 16);
        String description = format.getDescription();
        
        assertThat(description).contains("PCM");
        assertThat(description).contains("44100Hz");
        assertThat(description).contains("Stereo");
        assertThat(description).contains("16-bit");
    }

    @Test
    void shouldCheckCompatibility() {
        AudioFormat format1 = AudioFormat.pcm(44100, 2, 16);
        AudioFormat format2 = AudioFormat.pcm(44100, 2, 16);
        AudioFormat format3 = AudioFormat.pcm(48000, 2, 16);
        
        assertThat(format1.isCompatibleWith(format2)).isTrue();
        assertThat(format1.isCompatibleWith(format3)).isFalse();
    }

    @Test
    void shouldUseStaticConstants() {
        assertThat(AudioFormat.PCM_16KHZ_MONO.getSampleRate()).isEqualTo(16000);
        assertThat(AudioFormat.PCM_16KHZ_MONO.getChannels()).isEqualTo(1);
        
        assertThat(AudioFormat.PCM_44KHZ_STEREO.getSampleRate()).isEqualTo(44100);
        assertThat(AudioFormat.PCM_44KHZ_STEREO.getChannels()).isEqualTo(2);
    }

    @Test
    void shouldBeEqualBasedOnValue() {
        AudioFormat format1 = AudioFormat.pcm(44100, 2, 16);
        AudioFormat format2 = AudioFormat.pcm(44100, 2, 16);
        
        assertThat(format1).isEqualTo(format2);
        assertThat(format1.hashCode()).isEqualTo(format2.hashCode());
    }
}