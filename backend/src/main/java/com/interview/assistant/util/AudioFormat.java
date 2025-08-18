package com.interview.assistant.util;

import java.util.logging.Logger;

/**
 * AudioFormat value object representing audio processing parameters
 * <p>
 * Why: Immutable value object for type safety and validation
 * Pattern: DDD Value Object - equality based on value, not identity
 * Rationale: Audio format parameters are fundamental to audio processing
 */
public class AudioFormat {

    // Standard audio formats
    public static final AudioFormat PCM_16KHZ_MONO = new AudioFormat(16000, 1, 16, "PCM");
    public static final AudioFormat PCM_44KHZ_STEREO = new AudioFormat(44100, 2, 16, "PCM");
    public static final AudioFormat PCM_48KHZ_MONO = new AudioFormat(48000, 1, 16, "PCM");
    private static final Logger logger = Logger.getLogger(AudioFormat.class.getName());
    private final int sampleRate;
    private final int channels;
    private final int bitsPerSample;
    private final String encoding;

    private AudioFormat(int sampleRate, int channels, int bitsPerSample, String encoding) {
        validateSampleRate(sampleRate);
        validateChannels(channels);
        validateBitsPerSample(bitsPerSample);
        validateEncoding(encoding);

        this.sampleRate = sampleRate;
        this.channels = channels;
        this.bitsPerSample = bitsPerSample;
        this.encoding = encoding;
    }

    /**
     * Create audio format with validation
     * Why: Factory method ensures valid audio format creation
     */
    public static AudioFormat of(int sampleRate, int channels, int bitsPerSample, String encoding) {
        return new AudioFormat(sampleRate, channels, bitsPerSample, encoding);
    }

    /**
     * Create PCM audio format
     * Why: Convenience method for most common format
     */
    public static AudioFormat pcm(int sampleRate, int channels, int bitsPerSample) {
        return new AudioFormat(sampleRate, channels, bitsPerSample, "PCM");
    }

    // Getters
    public int getSampleRate() {
        return sampleRate;
    }

    public int getChannels() {
        return channels;
    }

    public int getBitsPerSample() {
        return bitsPerSample;
    }

    public String getEncoding() {
        return encoding;
    }

    /**
     * Check if format is mono
     * Why: Business logic for audio processing decisions
     */
    public boolean isMono() {
        return channels == 1;
    }

    /**
     * Check if format is stereo
     * Why: Business logic for audio processing decisions
     */
    public boolean isStereo() {
        return channels == 2;
    }

    /**
     * Check if format is CD quality
     * Why: Quality assessment for audio processing
     */
    public boolean isCDQuality() {
        return sampleRate == 44100 && bitsPerSample == 16;
    }

    /**
     * Check if format is suitable for speech recognition
     * Why: Validation for transcription services
     */
    public boolean isSuitableForSpeechRecognition() {
        return sampleRate >= 8000 && sampleRate <= 48000 &&
                channels <= 2 &&
                (bitsPerSample == 16 || bitsPerSample == 24 || bitsPerSample == 32);
    }

    /**
     * Calculate bytes per second
     * Why: Performance and storage calculations
     */
    public int getBytesPerSecond() {
        return (sampleRate * channels * bitsPerSample) / 8;
    }

    /**
     * Calculate bytes for duration
     * Why: Memory and storage calculations
     */
    public long getBytesForDuration(long durationMs) {
        return (getBytesPerSecond() * durationMs) / 1000;
    }

    /**
     * Convert to another sample rate
     * Why: Audio format conversion requirements
     */
    public AudioFormat withSampleRate(int newSampleRate) {
        return new AudioFormat(newSampleRate, channels, bitsPerSample, encoding);
    }

    /**
     * Convert to mono
     * Why: Channel reduction for processing efficiency
     */
    public AudioFormat toMono() {
        return new AudioFormat(sampleRate, 1, bitsPerSample, encoding);
    }

    /**
     * Convert to stereo
     * Why: Channel expansion for output quality
     */
    public AudioFormat toStereo() {
        return new AudioFormat(sampleRate, 2, bitsPerSample, encoding);
    }

    /**
     * Get format description
     * Why: Human-readable format information
     */
    public String getDescription() {
        String channelDesc = isMono() ? "Mono" : isStereo() ? "Stereo" : channels + " channels";
        return String.format("%s %dHz %s %d-bit",
                encoding, sampleRate, channelDesc, bitsPerSample);
    }

    /**
     * Check compatibility with another format
     * Why: Format matching for audio processing
     */
    public boolean isCompatibleWith(AudioFormat other) {
        return this.encoding.equals(other.encoding) &&
                this.sampleRate == other.sampleRate &&
                this.channels == other.channels &&
                this.bitsPerSample == other.bitsPerSample;
    }

    private void validateSampleRate(int sampleRate) {
        if (sampleRate <= 0) {
            throw new IllegalArgumentException("Sample rate must be positive");
        }
        if (sampleRate < 8000 || sampleRate > 192000) {
            throw new IllegalArgumentException("Sample rate must be between 8kHz and 192kHz");
        }
    }

    private void validateChannels(int channels) {
        if (channels <= 0 || channels > 8) {
            throw new IllegalArgumentException("Channels must be between 1 and 8");
        }
    }

    private void validateBitsPerSample(int bitsPerSample) {
        if (bitsPerSample != 8 && bitsPerSample != 16 &&
                bitsPerSample != 24 && bitsPerSample != 32) {
            throw new IllegalArgumentException("Bits per sample must be 8, 16, 24, or 32");
        }
    }

    private void validateEncoding(String encoding) {
        if (encoding == null || encoding.trim().isEmpty()) {
            throw new IllegalArgumentException("Encoding cannot be null or empty");
        }
    }

    // Equals, hashCode, and toString methods (replacing Lombok annotations)
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        AudioFormat that = (AudioFormat) obj;
        return sampleRate == that.sampleRate &&
                channels == that.channels &&
                bitsPerSample == that.bitsPerSample &&
                encoding.equals(that.encoding);
    }

    @Override
    public int hashCode() {
        int result = Integer.hashCode(sampleRate);
        result = 31 * result + Integer.hashCode(channels);
        result = 31 * result + Integer.hashCode(bitsPerSample);
        result = 31 * result + encoding.hashCode();
        return result;
    }

    @Override
    public String toString() {
        return "AudioFormat{" +
                "sampleRate=" + sampleRate +
                ", channels=" + channels +
                ", bitsPerSample=" + bitsPerSample +
                ", encoding='" + encoding + '\'' +
                '}';
    }
}