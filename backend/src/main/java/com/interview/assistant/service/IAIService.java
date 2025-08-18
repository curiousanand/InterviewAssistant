package com.interview.assistant.service;

import com.interview.assistant.model.ConversationMessage;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * AI Service interface for generating intelligent responses
 * 
 * Why: Abstracts AI service implementations for flexible provider switching
 * Pattern: Strategy pattern - allows different AI providers
 * Rationale: Enables testing with mock implementations and provider independence
 */
public interface IAIService {
    
    /**
     * Generate response for user message
     * Why: Primary AI interaction for conversation responses
     * 
     * @param sessionId Session identifier for context
     * @param userMessage User's message content
     * @param language Detected or target language
     * @return Future containing AI response
     */
    CompletableFuture<AIResponse> generateResponse(String sessionId, String userMessage, String language);
    
    /**
     * Generate streaming response for real-time interaction
     * Why: Enables real-time response streaming for better UX
     * 
     * @param sessionId Session identifier for context
     * @param userMessage User's message content
     * @param language Detected or target language
     * @param callback Callback for streaming response tokens
     * @return Future containing complete response
     */
    CompletableFuture<AIResponse> generateStreamingResponse(String sessionId, String userMessage, 
                                                          String language, StreamingCallback callback);
    
    /**
     * Generate streaming response with conversation context
     * Why: Enhanced conversation processing with full context
     * 
     * @param request Chat request with conversation context
     * @param callback Callback for streaming response tokens
     * @return Future indicating processing status
     */
    CompletableFuture<Void> generateStreamingResponse(ChatRequest request, StreamingCallback callback);
    
    /**
     * Get conversation summary for context management
     * Why: Manage conversation context length and memory
     * 
     * @param sessionId Session identifier
     * @param messages List of messages to summarize
     * @return Future containing summary
     */
    CompletableFuture<String> summarizeConversation(String sessionId, java.util.List<String> messages);
    
    /**
     * Check if service is available
     * Why: Health checking and failover support
     * 
     * @return True if service is responsive
     */
    boolean isServiceAvailable();
    
    /**
     * Get service configuration
     * Why: Service introspection and monitoring
     * 
     * @return Service configuration information
     */
    ServiceConfiguration getConfiguration();
    
    /**
     * AI Response value object
     */
    interface AIResponse {
        String getContent();
        int getTokensUsed();
        double getProcessingTimeMs();
        String getModel();
        boolean isSuccess();
        String getErrorMessage();
    }
    
    /**
     * Streaming callback interface for real-time responses
     */
    interface StreamingCallback {
        void onToken(String token);
        void onComplete(AIResponse response);
        void onError(String error);
        
        // Enhanced streaming methods for conversation orchestration
        default void onTokenReceived(String token, boolean isComplete) {
            onToken(token);
            if (isComplete) {
                onComplete(null); // Called with complete response elsewhere
            }
        }
    }
    
    /**
     * Service configuration value object
     */
    interface ServiceConfiguration {
        String getProviderName();
        String getModel();
        int getMaxTokens();
        double getTemperature();
        String getEndpoint();
    }
    
    /**
     * Chat request data model for enhanced conversation processing
     */
    class ChatRequest {
        private final List<ConversationMessage> messages;
        private final String systemPrompt;
        private final boolean enableStreaming;
        private final String model;
        private final double temperature;
        private final int maxTokens;
        
        public ChatRequest(List<ConversationMessage> messages, String systemPrompt, boolean enableStreaming) {
            this(messages, systemPrompt, enableStreaming, "gpt-3.5-turbo", 0.7, 1000);
        }
        
        public ChatRequest(List<ConversationMessage> messages, String systemPrompt, boolean enableStreaming,
                          String model, double temperature, int maxTokens) {
            this.messages = messages != null ? List.copyOf(messages) : List.of();
            this.systemPrompt = systemPrompt != null ? systemPrompt : "";
            this.enableStreaming = enableStreaming;
            this.model = model != null ? model : "gpt-3.5-turbo";
            this.temperature = Math.max(0.0, Math.min(2.0, temperature));
            this.maxTokens = Math.max(1, maxTokens);
        }
        
        public List<ConversationMessage> getMessages() { return messages; }
        public String getSystemPrompt() { return systemPrompt; }
        public boolean isStreamingEnabled() { return enableStreaming; }
        public String getModel() { return model; }
        public double getTemperature() { return temperature; }
        public int getMaxTokens() { return maxTokens; }
        
        public int getMessageCount() {
            return messages.size();
        }
        
        public int getTotalTokenEstimate() {
            // Rough estimation: 4 characters per token
            int totalChars = systemPrompt.length() + 
                messages.stream().mapToInt(msg -> msg.getContent().length()).sum();
            return totalChars / 4;
        }
        
        @Override
        public String toString() {
            return String.format("ChatRequest{messages=%d, model=%s, streaming=%s, tokens~%d}", 
                getMessageCount(), model, enableStreaming, getTotalTokenEstimate());
        }
    }
}