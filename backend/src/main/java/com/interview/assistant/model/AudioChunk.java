package com.interview.assistant.model;

import java.util.Arrays;

/**
 * Audio chunk data model for streaming audio processing
 * 
 * Why: Represents a discrete chunk of audio data with metadata for processing
 * Pattern: Value Object - immutable data structure for audio chunks
 * Rationale: Core data structure for real-time audio stream processing
 */
public class AudioChunk {
    
    private final byte[] data;
    private final long timestamp;
    private final int sampleRate;
    private final int channels;
    private final long sequenceNumber;
    
    // Static counter for sequence numbering
    private static volatile long globalSequenceCounter = 0;
    
    public AudioChunk(byte[] data, long timestamp) {
        this(data, timestamp, 16000, 1); // Default to 16kHz mono
    }
    
    public AudioChunk(byte[] data, long timestamp, int sampleRate, int channels) {
        if (data == null) {
            throw new IllegalArgumentException("Audio data cannot be null");
        }
        if (data.length == 0) {
            throw new IllegalArgumentException("Audio data cannot be empty");
        }
        if (sampleRate <= 0) {
            throw new IllegalArgumentException("Sample rate must be positive");
        }
        if (channels <= 0) {
            throw new IllegalArgumentException("Channels must be positive");
        }
        
        this.data = Arrays.copyOf(data, data.length); // Defensive copy
        this.timestamp = timestamp;
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.sequenceNumber = ++globalSequenceCounter;
    }
    
    /**
     * Get audio data as byte array
     */
    public byte[] getData() {
        return Arrays.copyOf(data, data.length); // Defensive copy
    }
    
    /**
     * Get audio data length in bytes
     */
    public int getDataLength() {
        return data.length;
    }
    
    /**
     * Get duration in milliseconds based on sample rate and data length
     */
    public double getDurationMs() {
        int sampleSizeBytes = 2; // 16-bit samples = 2 bytes per sample
        int totalSamples = data.length / (sampleSizeBytes * channels);
        return (double) totalSamples / sampleRate * 1000.0;
    }
    
    /**
     * Get number of samples in this chunk
     */
    public int getSampleCount() {
        int sampleSizeBytes = 2; // 16-bit samples
        return data.length / (sampleSizeBytes * channels);
    }
    
    /**
     * Calculate RMS energy of the audio chunk
     */
    public double calculateRMSEnergy() {
        if (data.length < 2) {
            return 0.0;
        }
        
        double sum = 0.0;
        int sampleCount = 0;
        
        // Process 16-bit PCM samples
        for (int i = 0; i < data.length - 1; i += 2) {
            // Convert bytes to 16-bit signed integer
            short sample = (short) ((data[i + 1] << 8) | (data[i] & 0xFF));
            double normalizedSample = sample / 32768.0; // Normalize to [-1, 1]
            sum += normalizedSample * normalizedSample;
            sampleCount++;
        }
        
        return sampleCount > 0 ? Math.sqrt(sum / sampleCount) : 0.0;
    }
    
    /**
     * Check if this chunk contains silence based on energy threshold
     */
    public boolean isSilence(double threshold) {
        return calculateRMSEnergy() < threshold;
    }
    
    /**
     * Get peak amplitude in this chunk
     */
    public double getPeakAmplitude() {
        if (data.length < 2) {
            return 0.0;
        }
        
        double maxAmplitude = 0.0;
        
        for (int i = 0; i < data.length - 1; i += 2) {
            short sample = (short) ((data[i + 1] << 8) | (data[i] & 0xFF));
            double normalizedSample = Math.abs(sample / 32768.0);
            maxAmplitude = Math.max(maxAmplitude, normalizedSample);
        }
        
        return maxAmplitude;
    }
    
    /**
     * Convert to float array for processing
     */
    public float[] toFloatArray() {
        if (data.length < 2) {
            return new float[0];
        }
        
        int sampleCount = getSampleCount();
        float[] floats = new float[sampleCount];
        
        for (int i = 0, j = 0; i < data.length - 1; i += 2, j++) {
            short sample = (short) ((data[i + 1] << 8) | (data[i] & 0xFF));
            floats[j] = sample / 32768.0f; // Normalize to [-1, 1]
        }
        
        return floats;
    }
    
    /**
     * Create a copy of this chunk with new timestamp
     */
    public AudioChunk withTimestamp(long newTimestamp) {
        return new AudioChunk(this.data, newTimestamp, this.sampleRate, this.channels);
    }
    
    /**
     * Combine this chunk with another chunk
     */
    public AudioChunk combineWith(AudioChunk other) {
        if (this.sampleRate != other.sampleRate || this.channels != other.channels) {
            throw new IllegalArgumentException("Cannot combine chunks with different audio formats");
        }
        
        byte[] combinedData = new byte[this.data.length + other.data.length];
        System.arraycopy(this.data, 0, combinedData, 0, this.data.length);
        System.arraycopy(other.data, 0, combinedData, this.data.length, other.data.length);
        
        // Use the earlier timestamp
        long combinedTimestamp = Math.min(this.timestamp, other.timestamp);
        
        return new AudioChunk(combinedData, combinedTimestamp, this.sampleRate, this.channels);
    }
    
    // Getters
    
    public long getTimestamp() {
        return timestamp;
    }
    
    public int getSampleRate() {
        return sampleRate;
    }
    
    public int getChannels() {
        return channels;
    }
    
    public long getSequenceNumber() {
        return sequenceNumber;
    }
    
    /**
     * Get audio format information
     */
    public AudioFormat getAudioFormat() {
        return new AudioFormat(sampleRate, channels, 16); // 16-bit samples
    }
    
    /**
     * Get chunk statistics
     */
    public ChunkStatistics getStatistics() {
        return new ChunkStatistics(
            getDataLength(),
            getSampleCount(),
            getDurationMs(),
            calculateRMSEnergy(),
            getPeakAmplitude(),
            timestamp
        );
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        AudioChunk other = (AudioChunk) obj;
        return timestamp == other.timestamp &&
               sampleRate == other.sampleRate &&
               channels == other.channels &&
               sequenceNumber == other.sequenceNumber &&
               Arrays.equals(data, other.data);
    }
    
    @Override
    public int hashCode() {
        int result = Arrays.hashCode(data);
        result = 31 * result + Long.hashCode(timestamp);
        result = 31 * result + Integer.hashCode(sampleRate);
        result = 31 * result + Integer.hashCode(channels);
        result = 31 * result + Long.hashCode(sequenceNumber);
        return result;
    }
    
    @Override
    public String toString() {
        return String.format("AudioChunk{seq=%d, bytes=%d, duration=%.1fms, timestamp=%d, rms=%.3f}", 
            sequenceNumber, data.length, getDurationMs(), timestamp, calculateRMSEnergy());
    }
    
    // Inner classes
    
    public static class AudioFormat {
        private final int sampleRate;
        private final int channels;
        private final int bitsPerSample;
        
        public AudioFormat(int sampleRate, int channels, int bitsPerSample) {
            this.sampleRate = sampleRate;
            this.channels = channels;
            this.bitsPerSample = bitsPerSample;
        }
        
        public int getSampleRate() { return sampleRate; }
        public int getChannels() { return channels; }
        public int getBitsPerSample() { return bitsPerSample; }
        
        @Override
        public String toString() {
            return String.format("%dHz_%dch_%dbit", sampleRate, channels, bitsPerSample);
        }
    }
    
    public static class ChunkStatistics {
        private final int dataLength;
        private final int sampleCount;
        private final double durationMs;
        private final double rmsEnergy;
        private final double peakAmplitude;
        private final long timestamp;
        
        public ChunkStatistics(int dataLength, int sampleCount, double durationMs, 
                             double rmsEnergy, double peakAmplitude, long timestamp) {
            this.dataLength = dataLength;
            this.sampleCount = sampleCount;
            this.durationMs = durationMs;
            this.rmsEnergy = rmsEnergy;
            this.peakAmplitude = peakAmplitude;
            this.timestamp = timestamp;
        }
        
        // Getters
        public int getDataLength() { return dataLength; }
        public int getSampleCount() { return sampleCount; }
        public double getDurationMs() { return durationMs; }
        public double getRmsEnergy() { return rmsEnergy; }
        public double getPeakAmplitude() { return peakAmplitude; }
        public long getTimestamp() { return timestamp; }
        
        @Override
        public String toString() {
            return String.format("Stats{len=%d, samples=%d, dur=%.1fms, rms=%.3f, peak=%.3f}", 
                dataLength, sampleCount, durationMs, rmsEnergy, peakAmplitude);
        }
    }
}