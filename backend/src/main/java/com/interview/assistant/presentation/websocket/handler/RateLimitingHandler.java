package com.interview.assistant.presentation.websocket.handler;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting handler for WebSocket connections
 * 
 * Why: Prevents abuse and ensures fair resource usage
 * Pattern: Token bucket algorithm for rate limiting
 * Rationale: Protects backend services from excessive client requests
 */
@Component
public class RateLimitingHandler {
    
    private final Map<String, RateLimitState> clientLimits = new ConcurrentHashMap<>();
    
    // Default rate limits
    private final int MESSAGES_PER_MINUTE = 60;
    private final int AUDIO_CHUNKS_PER_MINUTE = 300; // ~5 per second for real-time audio
    private final int BURST_LIMIT = 10; // Allow short bursts
    
    /**
     * Check if client can send message
     * Why: Prevent clients from overwhelming the server
     * 
     * @param clientId Client identifier (session ID or IP)
     * @param messageType Type of message being sent
     * @return True if message is allowed
     */
    public boolean isAllowed(String clientId, MessageType messageType) {
        RateLimitState state = clientLimits.computeIfAbsent(clientId, k -> new RateLimitState());
        
        return switch (messageType) {
            case AUDIO_DATA -> checkAudioLimit(state);
            case TEXT_MESSAGE -> checkMessageLimit(state);
            case HEARTBEAT -> true; // Always allow heartbeats
            case SESSION_CONTROL -> checkMessageLimit(state); // Use same limit as text messages
        };
    }
    
    /**
     * Record message attempt
     * Why: Track usage for rate limiting calculations
     */
    public void recordAttempt(String clientId, MessageType messageType, boolean allowed) {
        RateLimitState state = clientLimits.get(clientId);
        if (state != null) {
            if (allowed) {
                state.recordSuccess(messageType);
            } else {
                state.recordRejection(messageType);
            }
        }
    }
    
    /**
     * Get rate limit status for client
     * Why: Provide feedback on current rate limit status
     */
    public RateLimitStatus getStatus(String clientId) {
        RateLimitState state = clientLimits.get(clientId);
        if (state == null) {
            return new RateLimitStatus(0, 0, 0, MESSAGES_PER_MINUTE, AUDIO_CHUNKS_PER_MINUTE);
        }
        
        return new RateLimitStatus(
            state.getMessagesInCurrentWindow(),
            state.getAudioChunksInCurrentWindow(),
            state.getTotalRejections(),
            MESSAGES_PER_MINUTE,
            AUDIO_CHUNKS_PER_MINUTE
        );
    }
    
    /**
     * Clean up expired rate limit states
     * Why: Prevent memory leaks from inactive clients
     */
    public void cleanupExpiredStates() {
        long cutoffTime = Instant.now().toEpochMilli() - (5 * 60 * 1000); // 5 minutes ago
        
        clientLimits.entrySet().removeIf(entry -> 
            entry.getValue().getLastActivity() < cutoffTime
        );
    }
    
    /**
     * Reset rate limits for client
     * Why: Administrative function for troubleshooting
     */
    public void resetLimits(String clientId) {
        clientLimits.remove(clientId);
    }
    
    /**
     * Check audio message rate limit
     */
    private boolean checkAudioLimit(RateLimitState state) {
        state.cleanupOldEntries();
        
        int currentAudioCount = state.getAudioChunksInCurrentWindow();
        int currentBurstCount = state.getBurstCount();
        
        // Allow burst of audio chunks, but enforce per-minute limit
        if (currentBurstCount >= BURST_LIMIT && currentAudioCount >= AUDIO_CHUNKS_PER_MINUTE) {
            return false;
        }
        
        if (currentAudioCount >= AUDIO_CHUNKS_PER_MINUTE) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check text message rate limit
     */
    private boolean checkMessageLimit(RateLimitState state) {
        state.cleanupOldEntries();
        
        int currentMessageCount = state.getMessagesInCurrentWindow();
        
        return currentMessageCount < MESSAGES_PER_MINUTE;
    }
    
    /**
     * Message types for rate limiting
     */
    public enum MessageType {
        AUDIO_DATA,
        TEXT_MESSAGE,
        HEARTBEAT,
        SESSION_CONTROL
    }
    
    /**
     * Rate limit state for a client
     */
    private static class RateLimitState {
        private final Map<Long, AtomicInteger> messageCountByMinute = new ConcurrentHashMap<>();
        private final Map<Long, AtomicInteger> audioCountByMinute = new ConcurrentHashMap<>();
        private final AtomicInteger totalRejections = new AtomicInteger(0);
        private volatile long lastActivity = Instant.now().toEpochMilli();
        private volatile long lastBurstReset = Instant.now().toEpochMilli();
        private final AtomicInteger burstCount = new AtomicInteger(0);
        
        void recordSuccess(MessageType messageType) {
            lastActivity = Instant.now().toEpochMilli();
            long currentMinute = getCurrentMinute();
            
            switch (messageType) {
                case AUDIO_DATA -> {
                    audioCountByMinute.computeIfAbsent(currentMinute, k -> new AtomicInteger(0)).incrementAndGet();
                    updateBurstCount();
                }
                case TEXT_MESSAGE, SESSION_CONTROL -> 
                    messageCountByMinute.computeIfAbsent(currentMinute, k -> new AtomicInteger(0)).incrementAndGet();
            }
        }
        
        void recordRejection(MessageType messageType) {
            lastActivity = Instant.now().toEpochMilli();
            totalRejections.incrementAndGet();
        }
        
        void cleanupOldEntries() {
            long currentMinute = getCurrentMinute();
            long cutoffTime = currentMinute - 2; // Keep last 2 minutes
            
            messageCountByMinute.entrySet().removeIf(entry -> entry.getKey() < cutoffTime);
            audioCountByMinute.entrySet().removeIf(entry -> entry.getKey() < cutoffTime);
        }
        
        int getMessagesInCurrentWindow() {
            long currentMinute = getCurrentMinute();
            return messageCountByMinute.getOrDefault(currentMinute, new AtomicInteger(0)).get();
        }
        
        int getAudioChunksInCurrentWindow() {
            long currentMinute = getCurrentMinute();
            return audioCountByMinute.getOrDefault(currentMinute, new AtomicInteger(0)).get();
        }
        
        int getBurstCount() {
            long now = Instant.now().toEpochMilli();
            
            // Reset burst count every 10 seconds
            if (now - lastBurstReset > 10000) {
                burstCount.set(0);
                lastBurstReset = now;
            }
            
            return burstCount.get();
        }
        
        void updateBurstCount() {
            getBurstCount(); // This will reset if needed
            burstCount.incrementAndGet();
        }
        
        int getTotalRejections() {
            return totalRejections.get();
        }
        
        long getLastActivity() {
            return lastActivity;
        }
        
        private long getCurrentMinute() {
            return Instant.now().toEpochMilli() / 60000; // Convert to minute buckets
        }
    }
    
    /**
     * Rate limit status value object
     */
    public static class RateLimitStatus {
        private final int currentMessages;
        private final int currentAudioChunks;
        private final int totalRejections;
        private final int messageLimit;
        private final int audioLimit;
        
        public RateLimitStatus(int currentMessages, int currentAudioChunks, int totalRejections,
                              int messageLimit, int audioLimit) {
            this.currentMessages = currentMessages;
            this.currentAudioChunks = currentAudioChunks;
            this.totalRejections = totalRejections;
            this.messageLimit = messageLimit;
            this.audioLimit = audioLimit;
        }
        
        // Getters
        public int getCurrentMessages() { return currentMessages; }
        public int getCurrentAudioChunks() { return currentAudioChunks; }
        public int getTotalRejections() { return totalRejections; }
        public int getMessageLimit() { return messageLimit; }
        public int getAudioLimit() { return audioLimit; }
        
        public boolean isNearMessageLimit() {
            return currentMessages > (messageLimit * 0.8);
        }
        
        public boolean isNearAudioLimit() {
            return currentAudioChunks > (audioLimit * 0.8);
        }
    }
}