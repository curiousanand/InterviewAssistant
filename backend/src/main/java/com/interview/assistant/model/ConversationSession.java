package com.interview.assistant.model;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Conversation session model for managing conversation state and context
 * 
 * Why: Maintains conversation state across real-time audio processing
 * Pattern: Domain Model - encapsulates conversation-specific state and behavior
 * Rationale: Core model for conversation flow management and context tracking
 */
public class ConversationSession {
    
    private final String sessionId;
    private final long createdAt;
    private final AtomicLong lastActivityTime;
    
    // Conversation state
    private final List<TranscriptMessage> confirmedMessages;
    private final List<TranscriptMessage> pendingMessages;
    private TranscriptMessage currentLiveMessage;
    
    // Session state tracking
    private final AtomicBoolean isCurrentlySpeaking;
    private final AtomicBoolean hasPendingAIProcessing;
    private volatile long lastSpeechTime;
    private volatile long lastSilenceTime;
    private volatile long currentSilenceDuration;
    
    // Processing metrics
    private final AtomicLong totalProcessingTime;
    private volatile long aiProcessingStartTime;
    private final List<Long> processingLatencies;
    
    // Configuration
    private static final int MAX_CONFIRMED_MESSAGES = 20;
    private static final int MAX_PROCESSING_LATENCIES = 50;
    private static final long SESSION_TIMEOUT_MS = 300000; // 5 minutes
    
    public ConversationSession(String sessionId, long createdAt) {
        this.sessionId = sessionId;
        this.createdAt = createdAt;
        this.lastActivityTime = new AtomicLong(createdAt);
        
        this.confirmedMessages = Collections.synchronizedList(new ArrayList<>());
        this.pendingMessages = Collections.synchronizedList(new ArrayList<>());
        this.currentLiveMessage = null;
        
        this.isCurrentlySpeaking = new AtomicBoolean(false);
        this.hasPendingAIProcessing = new AtomicBoolean(false);
        this.lastSpeechTime = createdAt;
        this.lastSilenceTime = createdAt;
        this.currentSilenceDuration = 0;
        
        this.totalProcessingTime = new AtomicLong(0);
        this.aiProcessingStartTime = 0;
        this.processingLatencies = Collections.synchronizedList(new ArrayList<>());
    }
    
    /**
     * Initialize conversation context
     */
    public void initializeContext() {
        // Set up initial conversation state
        this.lastActivityTime.set(System.currentTimeMillis());
    }
    
    /**
     * Handle speech detection
     */
    public void onSpeechDetected(long timestamp) {
        this.isCurrentlySpeaking.set(true);
        this.lastSpeechTime = timestamp;
        this.lastActivityTime.set(timestamp);
        this.currentSilenceDuration = 0;
    }
    
    /**
     * Handle silence detection
     */
    public void onSilenceDetected(long timestamp, SilenceDetectionResult silenceResult) {
        this.isCurrentlySpeaking.set(false);
        this.lastSilenceTime = timestamp;
        this.lastActivityTime.set(timestamp);
        this.currentSilenceDuration = silenceResult.getSilenceDuration();
    }
    
    /**
     * Update live transcript (interim results)
     */
    public void updateLiveTranscript(String text, double confidence, long timestamp) {
        this.currentLiveMessage = new TranscriptMessage(
            text, confidence, timestamp, false, MessageRole.USER
        );
        this.lastActivityTime.set(timestamp);
    }
    
    /**
     * Add confirmed transcript (final results)
     */
    public void addConfirmedTranscript(String text, double confidence, long timestamp) {
        TranscriptMessage message = new TranscriptMessage(
            text, confidence, timestamp, true, MessageRole.USER
        );
        
        synchronized (confirmedMessages) {
            confirmedMessages.add(message);
            
            // Maintain size limit
            while (confirmedMessages.size() > MAX_CONFIRMED_MESSAGES) {
                confirmedMessages.remove(0);
            }
        }
        
        // Clear live message
        this.currentLiveMessage = null;
        this.lastActivityTime.set(timestamp);
    }
    
    /**
     * Add AI response message
     */
    public void addAIResponse(String text, long timestamp) {
        TranscriptMessage message = new TranscriptMessage(
            text, 1.0, timestamp, true, MessageRole.ASSISTANT
        );
        
        synchronized (confirmedMessages) {
            confirmedMessages.add(message);
            
            // Maintain size limit
            while (confirmedMessages.size() > MAX_CONFIRMED_MESSAGES) {
                confirmedMessages.remove(0);
            }
        }
        
        this.lastActivityTime.set(timestamp);
    }
    
    /**
     * Build conversation context for AI processing
     */
    public ConversationContext buildConversationContext() {
        List<ConversationMessage> messages = new ArrayList<>();
        
        synchronized (confirmedMessages) {
            for (TranscriptMessage msg : confirmedMessages) {
                if (msg.isFinal() && !msg.getText().trim().isEmpty()) {
                    messages.add(new ConversationMessage(
                        msg.getRole() == MessageRole.USER ? "user" : "assistant",
                        msg.getText(),
                        msg.getConfidence()
                    ));
                }
            }
        }
        
        // Add pending/live message if available
        if (currentLiveMessage != null && !currentLiveMessage.getText().trim().isEmpty()) {
            messages.add(new ConversationMessage(
                "user",
                currentLiveMessage.getText(),
                currentLiveMessage.getConfidence()
            ));
        }
        
        return new ConversationContext(
            messages,
            getSystemPrompt(),
            sessionId,
            getSessionMetadata()
        );
    }
    
    /**
     * Get system prompt for AI
     */
    private String getSystemPrompt() {
        return "You are a helpful AI assistant in a real-time conversation. " +
               "Provide concise, accurate, and contextually relevant responses. " +
               "The user is speaking to you through voice, so keep responses " +
               "conversational and not too lengthy. Focus on being helpful and natural.";
    }
    
    /**
     * Get session metadata
     */
    private Map<String, Object> getSessionMetadata() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("sessionId", sessionId);
        metadata.put("createdAt", createdAt);
        metadata.put("messageCount", getMessageCount());
        metadata.put("isActive", !isSessionExpired());
        metadata.put("currentSilenceDuration", currentSilenceDuration);
        return metadata;
    }
    
    /**
     * Mark AI processing as started
     */
    public void markAIProcessingStarted() {
        this.hasPendingAIProcessing.set(true);
        this.aiProcessingStartTime = System.currentTimeMillis();
    }
    
    /**
     * Mark AI processing as completed
     */
    public void markAIProcessingCompleted() {
        this.hasPendingAIProcessing.set(false);
        
        if (aiProcessingStartTime > 0) {
            long processingTime = System.currentTimeMillis() - aiProcessingStartTime;
            totalProcessingTime.addAndGet(processingTime);
            
            synchronized (processingLatencies) {
                processingLatencies.add(processingTime);
                if (processingLatencies.size() > MAX_PROCESSING_LATENCIES) {
                    processingLatencies.remove(0);
                }
            }
            
            aiProcessingStartTime = 0;
        }
    }
    
    /**
     * Cancel pending AI processing
     */
    public void cancelPendingAIProcessing() {
        this.hasPendingAIProcessing.set(false);
        this.aiProcessingStartTime = 0;
    }
    
    /**
     * Clear processed transcript
     */
    public void clearProcessedTranscript() {
        // Clear any pending messages that have been processed
        pendingMessages.clear();
    }
    
    /**
     * Check if session has confirmed transcript
     */
    public boolean hasConfirmedTranscript() {
        synchronized (confirmedMessages) {
            return !confirmedMessages.isEmpty() || 
                   (currentLiveMessage != null && !currentLiveMessage.getText().trim().isEmpty());
        }
    }
    
    /**
     * Check if session has unprocessed transcript
     */
    public boolean hasUnprocessedTranscript() {
        return currentLiveMessage != null || !pendingMessages.isEmpty();
    }
    
    /**
     * Check if session is expired
     */
    public boolean isSessionExpired() {
        return (System.currentTimeMillis() - lastActivityTime.get()) > SESSION_TIMEOUT_MS;
    }
    
    /**
     * Cleanup session resources
     */
    public void cleanup() {
        confirmedMessages.clear();
        pendingMessages.clear();
        processingLatencies.clear();
        currentLiveMessage = null;
    }
    
    // Getters
    
    public String getSessionId() {
        return sessionId;
    }
    
    public long getCreatedAt() {
        return createdAt;
    }
    
    public long getLastActivityTime() {
        return lastActivityTime.get();
    }
    
    public boolean isCurrentlySpeaking() {
        return isCurrentlySpeaking.get();
    }
    
    public boolean hasPendingAIProcessing() {
        return hasPendingAIProcessing.get();
    }
    
    public long getCurrentSilenceDuration() {
        return currentSilenceDuration;
    }
    
    public long getTotalProcessingTime() {
        return totalProcessingTime.get();
    }
    
    public int getMessageCount() {
        synchronized (confirmedMessages) {
            return confirmedMessages.size();
        }
    }
    
    public double getAverageProcessingLatency() {
        synchronized (processingLatencies) {
            if (processingLatencies.isEmpty()) {
                return 0.0;
            }
            return processingLatencies.stream().mapToLong(Long::longValue).average().orElse(0.0);
        }
    }
    
    /**
     * Get latest user message text
     */
    public String getLatestUserMessage() {
        synchronized (confirmedMessages) {
            for (int i = confirmedMessages.size() - 1; i >= 0; i--) {
                TranscriptMessage msg = confirmedMessages.get(i);
                if (msg.getRole() == MessageRole.USER && !msg.getText().trim().isEmpty()) {
                    return msg.getText();
                }
            }
        }
        
        // Check current live message
        if (currentLiveMessage != null && 
            currentLiveMessage.getRole() == MessageRole.USER && 
            !currentLiveMessage.getText().trim().isEmpty()) {
            return currentLiveMessage.getText();
        }
        
        return null;
    }
    
    /**
     * Get session statistics
     */
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("sessionId", sessionId);
        stats.put("createdAt", createdAt);
        stats.put("lastActivity", lastActivityTime.get());
        stats.put("messageCount", getMessageCount());
        stats.put("isCurrentlySpeaking", isCurrentlySpeaking.get());
        stats.put("hasPendingAI", hasPendingAIProcessing.get());
        stats.put("currentSilenceDuration", currentSilenceDuration);
        stats.put("totalProcessingTime", totalProcessingTime.get());
        stats.put("averageLatency", getAverageProcessingLatency());
        stats.put("isExpired", isSessionExpired());
        return stats;
    }
    
    @Override
    public String toString() {
        return String.format("ConversationSession{id=%s, messages=%d, speaking=%s, processing=%s}", 
            sessionId, getMessageCount(), isCurrentlySpeaking.get(), hasPendingAIProcessing.get());
    }
    
    // Inner classes
    
    /**
     * Transcript message model
     */
    public static class TranscriptMessage {
        private final String text;
        private final double confidence;
        private final long timestamp;
        private final boolean isFinal;
        private final MessageRole role;
        
        public TranscriptMessage(String text, double confidence, long timestamp, boolean isFinal, MessageRole role) {
            this.text = text;
            this.confidence = confidence;
            this.timestamp = timestamp;
            this.isFinal = isFinal;
            this.role = role;
        }
        
        public String getText() { return text; }
        public double getConfidence() { return confidence; }
        public long getTimestamp() { return timestamp; }
        public boolean isFinal() { return isFinal; }
        public MessageRole getRole() { return role; }
        
        @Override
        public String toString() {
            return String.format("TranscriptMessage{role=%s, text='%s', final=%s, conf=%.2f}", 
                role, text, isFinal, confidence);
        }
    }
    
    /**
     * Message role enumeration
     */
    public enum MessageRole {
        USER, ASSISTANT
    }
}