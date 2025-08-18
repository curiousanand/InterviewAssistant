package com.interview.assistant.model;

import com.interview.assistant.service.StreamingAudioProcessor;

import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Audio session model for continuous stream processing
 * 
 * Why: Maintains state for real-time audio processing and conversation flow
 * Pattern: Domain Model - encapsulates session-specific audio processing state
 * Rationale: Central model for managing streaming audio sessions with VAD and buffering
 */
public class AudioSession {
    
    private final String sessionId;
    private final StreamingAudioProcessor.AudioSessionConfig config;
    private final long createdAt;
    private final AtomicLong lastActivityTime;
    private final AtomicLong chunksReceived;
    
    // Audio buffering
    private final Queue<AudioChunk> audioBuffer;
    private final Queue<VADResult> vadResults;
    private final int maxBufferSize;
    private final int maxVADHistorySize;
    
    // Speech state
    private final AtomicBoolean isCurrentlySpeaking;
    private volatile long lastSpeechTime;
    private volatile long speechStartTime;
    
    // Processing state
    private volatile long lastTranscriptionTime;
    private final AtomicBoolean hasUnprocessedAudio;
    private volatile int processedChunkCount;
    private final List<Long> processingLatencies;
    
    // Constants
    private static final int DEFAULT_BUFFER_SIZE = 300; // 30 seconds at 100ms chunks
    private static final int DEFAULT_VAD_HISTORY_SIZE = 50; // 5 seconds of VAD history
    private static final int MAX_PROCESSING_LATENCIES = 100;
    
    public AudioSession(String sessionId, StreamingAudioProcessor.AudioSessionConfig config) {
        this.sessionId = sessionId;
        this.config = config;
        this.createdAt = System.currentTimeMillis();
        this.lastActivityTime = new AtomicLong(createdAt);
        this.chunksReceived = new AtomicLong(0);
        
        this.audioBuffer = new ConcurrentLinkedQueue<>();
        this.vadResults = new ConcurrentLinkedQueue<>();
        this.maxBufferSize = DEFAULT_BUFFER_SIZE;
        this.maxVADHistorySize = DEFAULT_VAD_HISTORY_SIZE;
        
        this.isCurrentlySpeaking = new AtomicBoolean(false);
        this.lastSpeechTime = createdAt;
        this.speechStartTime = 0;
        
        this.lastTranscriptionTime = 0;
        this.hasUnprocessedAudio = new AtomicBoolean(false);
        this.processedChunkCount = 0;
        this.processingLatencies = new ArrayList<>();
    }
    
    /**
     * Add audio chunk to session buffer
     */
    public void addAudioChunk(AudioChunk chunk) {
        long startTime = System.nanoTime();
        
        audioBuffer.offer(chunk);
        chunksReceived.incrementAndGet();
        lastActivityTime.set(chunk.getTimestamp());
        hasUnprocessedAudio.set(true);
        
        // Maintain buffer size limit
        while (audioBuffer.size() > maxBufferSize) {
            audioBuffer.poll();
        }
        
        // Record processing latency
        long latency = System.nanoTime() - startTime;
        synchronized (processingLatencies) {
            processingLatencies.add(latency / 1000); // Convert to microseconds
            if (processingLatencies.size() > MAX_PROCESSING_LATENCIES) {
                processingLatencies.remove(0);
            }
        }
    }
    
    /**
     * Update VAD state for the session
     */
    public void updateVADState(VADResult vadResult) {
        vadResults.offer(vadResult);
        
        // Maintain VAD history size limit
        while (vadResults.size() > maxVADHistorySize) {
            vadResults.poll();
        }
    }
    
    /**
     * Set speech state with timestamp
     */
    public void setSpeechState(boolean isSpeaking, long timestamp) {
        boolean wasChanged = isCurrentlySpeaking.compareAndSet(!isSpeaking, isSpeaking);
        
        if (wasChanged) {
            if (isSpeaking) {
                speechStartTime = timestamp;
            } else {
                lastSpeechTime = timestamp;
            }
        }
    }
    
    /**
     * Get recent VAD results within specified time window
     */
    public List<VADResult> getRecentVADResults(long timeWindowMs) {
        long cutoffTime = System.currentTimeMillis() - timeWindowMs;
        List<VADResult> recentResults = new ArrayList<>();
        
        for (VADResult result : vadResults) {
            if (result.getTimestamp() >= cutoffTime) {
                recentResults.add(result);
            }
        }
        
        return recentResults;
    }
    
    /**
     * Check if session should trigger transcription
     */
    public boolean shouldTriggerTranscription() {
        // Trigger if we have unprocessed audio and it's been quiet or enough time passed
        if (!hasUnprocessedAudio.get()) {
            return false;
        }
        
        long now = System.currentTimeMillis();
        long timeSinceLastTranscription = now - lastTranscriptionTime;
        
        // Trigger transcription if:
        // 1. It's been more than 2 seconds since last transcription, OR
        // 2. We detected a pause and have accumulated speech
        return timeSinceLastTranscription > 2000 || 
               (!isCurrentlySpeaking.get() && timeSinceLastTranscription > 500);
    }
    
    /**
     * Get audio buffer for transcription processing
     */
    public byte[] getAudioBufferForTranscription() {
        if (audioBuffer.isEmpty()) {
            return new byte[0];
        }
        
        // Collect all unprocessed audio chunks
        List<AudioChunk> chunks = new ArrayList<>();
        int chunksSinceLastProcessing = chunksReceived.intValue() - processedChunkCount;
        
        // Get the most recent chunks for transcription
        AudioChunk[] bufferArray = audioBuffer.toArray(new AudioChunk[0]);
        int startIndex = Math.max(0, bufferArray.length - chunksSinceLastProcessing);
        
        for (int i = startIndex; i < bufferArray.length; i++) {
            chunks.add(bufferArray[i]);
        }
        
        // Concatenate audio data
        int totalLength = chunks.stream().mapToInt(chunk -> chunk.getData().length).sum();
        byte[] combinedAudio = new byte[totalLength];
        
        int offset = 0;
        for (AudioChunk chunk : chunks) {
            System.arraycopy(chunk.getData(), 0, combinedAudio, offset, chunk.getData().length);
            offset += chunk.getData().length;
        }
        
        return combinedAudio;
    }
    
    /**
     * Mark audio as processed for transcription
     */
    public void markAudioAsProcessed() {
        processedChunkCount = chunksReceived.intValue();
        lastTranscriptionTime = System.currentTimeMillis();
        hasUnprocessedAudio.set(false);
    }
    
    /**
     * Get remaining audio buffer for final processing
     */
    public byte[] getRemainingAudioBuffer() {
        if (audioBuffer.isEmpty()) {
            return new byte[0];
        }
        
        // Get all remaining audio
        int totalLength = audioBuffer.stream().mapToInt(chunk -> chunk.getData().length).sum();
        byte[] remainingAudio = new byte[totalLength];
        
        int offset = 0;
        for (AudioChunk chunk : audioBuffer) {
            System.arraycopy(chunk.getData(), 0, remainingAudio, offset, chunk.getData().length);
            offset += chunk.getData().length;
        }
        
        return remainingAudio;
    }
    
    /**
     * Get average processing latency in microseconds
     */
    public double getAverageProcessingLatency() {
        synchronized (processingLatencies) {
            if (processingLatencies.isEmpty()) {
                return 0.0;
            }
            return processingLatencies.stream().mapToLong(Long::longValue).average().orElse(0.0);
        }
    }
    
    /**
     * Cleanup session resources
     */
    public void cleanup() {
        audioBuffer.clear();
        vadResults.clear();
        synchronized (processingLatencies) {
            processingLatencies.clear();
        }
    }
    
    // Getters
    
    public String getSessionId() {
        return sessionId;
    }
    
    public StreamingAudioProcessor.AudioSessionConfig getConfig() {
        return config;
    }
    
    public long getCreatedAt() {
        return createdAt;
    }
    
    public long getLastActivityTime() {
        return lastActivityTime.get();
    }
    
    public long getChunksReceived() {
        return chunksReceived.get();
    }
    
    public int getBufferSize() {
        return audioBuffer.size();
    }
    
    public boolean isCurrentlySpeaking() {
        return isCurrentlySpeaking.get();
    }
    
    public long getLastSpeechTime() {
        return lastSpeechTime;
    }
    
    public long getSpeechStartTime() {
        return speechStartTime;
    }
    
    public boolean hasUnprocessedAudio() {
        return hasUnprocessedAudio.get();
    }
    
    public long getLastTranscriptionTime() {
        return lastTranscriptionTime;
    }
    
    /**
     * Get session statistics for monitoring
     */
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("sessionId", sessionId);
        stats.put("createdAt", createdAt);
        stats.put("lastActivity", lastActivityTime.get());
        stats.put("chunksReceived", chunksReceived.get());
        stats.put("bufferSize", audioBuffer.size());
        stats.put("vadResultsCount", vadResults.size());
        stats.put("isCurrentlySpeaking", isCurrentlySpeaking.get());
        stats.put("lastSpeechTime", lastSpeechTime);
        stats.put("hasUnprocessedAudio", hasUnprocessedAudio.get());
        stats.put("averageLatency", getAverageProcessingLatency());
        stats.put("config", config.toString());
        return stats;
    }
    
    @Override
    public String toString() {
        return String.format("AudioSession{id=%s, chunks=%d, speaking=%s, buffer=%d}", 
            sessionId, chunksReceived.get(), isCurrentlySpeaking.get(), audioBuffer.size());
    }
}